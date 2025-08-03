// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import dbConnect from '../../lib/mongodb';
import Product from '../../models/Product';
import type { Cart as ICart, CartItem } from '../../models/Cart';
import Cart from '../../models/Cart';
import Order from '../../models/Order';
import ChatHistory from '../../models/ChatHistory';
import mongoose from 'mongoose';

// Initialize GoogleGenerativeAI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Define IProduct with the _id property, assuming it was missing.
interface IProduct {
    _id: mongoose.Types.ObjectId;
    name: string;
    image: string;
    price: number;
    category: string;
    sizes: number[];
}

// Define a new type alias that correctly represents a Mongoose document with an _id.
// This avoids conflict with the imported 'ICart' and resolves the type error.
type CartDocument = ICart & { _id: mongoose.Types.ObjectId };

// Define an interface for chat messages to provide type safety
interface ChatMessage {
    role: 'user' | 'bot';
    text: string;
    timestamp: Date;
}

// Refactored helper function to add items to the cart using findOneAndUpdate with upsert:true.
async function addItemToCart(userId: mongoose.Types.ObjectId, product: IProduct, size: number) {
    let message = "";

    const newItem: CartItem = {
        productId: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        size: size,
        quantity: 1,
    };

    try {
        // First, try to find the cart and increment the quantity of the specific item if it already exists.
        const updatedCart = await Cart.findOneAndUpdate(
            { userId, "items.productId": product._id, "items.size": size },
            { $inc: { "items.$.quantity": 1 } },
            { new: true, lean: true } // Return the updated document as a plain object
        ) as CartDocument | null;

        if (updatedCart) {
            message = `It seems "${product.name}" (Size: ${size}) is already in your cart. I have increased the quantity.`;
            return { cart: updatedCart, message };
        } else {
            // Item does not exist, so we either add it to an existing cart or create a new one.
            const cartWithNewItem = await Cart.findOneAndUpdate(
                { userId },
                { $push: { items: newItem } },
                { new: true, upsert: true, lean: true } // upsert creates the document if it doesn't exist
            ) as CartDocument | null;
            message = `I've added the ${product.name} in size ${size} to your cart.`;
            return { cart: cartWithNewItem, message };
        }
    } catch (error) {
        console.error(`[addItemToCart] An error occurred during upsert: ${(error as Error).message}`);
        message = `I encountered an error while trying to add the item to your cart. Please try again.`;
        return { cart: null, message };
    }
}

// New helper function to remove items from the cart with robust, explicit logic
async function removeItemFromCart(userId: mongoose.Types.ObjectId, product: IProduct, size: number) {
    let message = "";

    try {
        const updatedCart = await Cart.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId: product._id, size: size } } },
            { new: true, lean: true } // Return the updated document
        ) as CartDocument | null;

        if (updatedCart) {
            if (updatedCart.items.length === 0) {
                await Cart.findOneAndDelete({ userId: userId });
                message = `I've removed the ${product.name} in size ${size} from your cart. Your cart is now empty.`;
                return { cart: null, message };
            } else {
                message = `I've removed the ${product.name} in size ${size} from your cart.`;
                return { cart: updatedCart, message };
            }
        } else {
            message = `Could not find your cart or the specified item.`;
            return { cart: null, message };
        }
    } catch (error) {
        console.error(`[removeItemFromCart] An error occurred: ${(error as Error).message}`);
        message = `I encountered an error while trying to remove the item from your cart.`;
        return { cart: null, message };
    }
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error(`[handler] Database connection error: ${(error as Error).message}`);
        return res.status(500).json({ success: false, message: 'Database connection failed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const userId = new mongoose.Types.ObjectId(session.user.id);

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ message: 'Message is required' });
    }

    let chatHistoryDoc = await ChatHistory.findOne({ userId });
    let actionResponse = '';
    if (!chatHistoryDoc || chatHistoryDoc.messages.length === 0) {
        chatHistoryDoc = await ChatHistory.create({ userId, messages: [] });
        actionResponse = "What type of shoes do you need?";
        chatHistoryDoc.messages.push({ role: 'bot', text: actionResponse, timestamp: new Date() });
        await chatHistoryDoc.save();
        return res.status(200).json({
            success: true,
            response: actionResponse,
            products: [],
            cart: null,
            orderId: null,
        });
    }

    chatHistoryDoc.messages.push({ role: 'user', text: message, timestamp: new Date() });
    const allProducts = await Product.find({}) as IProduct[];
    let cart: ICart | null = await Cart.findOne({ userId }).lean() as CartDocument | null;
    let orderId: string | null = null;
    const productNames = allProducts.map(p => p.name);

    // Helper function to extract product name and size from a message
    function extractProductFromMessage(text: string): [string | null, number | null] {
        let extractedProductName: string | null = null;
        const lowerText = text.toLowerCase();
        const sortedProductNames = [...productNames].sort((a, b) => b.length - a.length);
        for (const pName of sortedProductNames) {
            const pNameRegex = new RegExp(pName.split(' ').join('.*'), 'i');
            if (lowerText.match(pNameRegex)) {
                extractedProductName = pName;
                break;
            }
        }
        const sizeMatch = text.match(/\b(size|sizes)?\s*(\d+)\b/i);
        const extractedSize: number | null = sizeMatch ? parseInt(sizeMatch[2], 10) : null;
        return [extractedProductName, extractedSize];
    }
    
    // START: New LLM-first intent detection logic.

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const initialPrompt = `You are an AI e-commerce chatbot for a shoe store. Your primary goal is to help users find and purchase shoes.
        When a user asks to "show products" or "browse shoes" (e.g., "Show me running shoes", "Do you have casual shoes?", "Browse sneakers"), you MUST respond by listing 3 relevant products from the available products below. For each product, include its name, price, and available sizes. Do NOT say you cannot show images.
        When asked to add an item to the cart, respond with "I've added the [Product Name] in size [Size] to your cart." If size is missing, ask for it.
        When asked to remove an item, respond with "I've removed the [Product Name] in size [Size] from your cart." If size is missing, ask for it.
        When asked to see the cart, show the items in the user's cart in a list.
        When asked to checkout, you should first ask for a confirmation: "Would you like to proceed with placing this order?".
        Respond in a helpful and concise manner. If you need more information, ask for it.
        Available products (for reference, do not list all unless asked to browse a category):
        ${(await Product.find({}) as IProduct[]).map(p => `${p.name} (Category: ${p.category}, Sizes: ${p.sizes.join(',')})`).join('\n')}
        `;
        const messageToSend = initialPrompt + "\n\nUser's Query: " + message;
        const historyForLLM = chatHistoryDoc.messages.slice(-10).filter((msg: ChatMessage) => msg.role === 'user' || msg.role === 'bot').map((msg: ChatMessage) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));
        if (historyForLLM.length > 0 && historyForLLM[0].role !== 'user') {
            historyForLLM.shift();
        }
        const chat = model.startChat({ history: historyForLLM, generationConfig: { maxOutputTokens: 200 } });
        const result = await chat.sendMessage(messageToSend);
        actionResponse = result.response.text();

    } catch (error) {
        console.error('Gemini API or Chatbot action error:', error);
        res.status(500).json({ success: false, message: 'Error processing your request with AI.', error: (error as Error).message });
    }

    // Now, analyze the LLM's response to perform a database action
    const lowerCaseResponse = actionResponse.toLowerCase();
    const [extractedProductName, extractedSize] = extractProductFromMessage(actionResponse);
    let newResponse = actionResponse;

    if (lowerCaseResponse.includes('added') && extractedProductName && extractedSize) {
        const product = allProducts.find(p => p.name.toLowerCase().includes(extractedProductName.toLowerCase()));
        if (product) {
            await addItemToCart(userId, product, extractedSize);
            cart = await Cart.findOne({ userId }).lean() as CartDocument | null;
            newResponse = `I've added the ${product.name} in size ${extractedSize} to your cart.`;
        } else {
            console.error(`Product '${extractedProductName}' not found after LLM response.`);
        }
    } else if (lowerCaseResponse.includes('removed') && extractedProductName && extractedSize) {
        const product = allProducts.find(p => p.name.toLowerCase().includes(extractedProductName.toLowerCase()));
        if (product) {
            await removeItemFromCart(userId, product, extractedSize);
            cart = await Cart.findOne({ userId }).lean() as CartDocument | null;
            newResponse = `I've removed the ${product.name} in size ${extractedSize} from your cart.`;
        } else {
            console.error(`Product '${extractedProductName}' not found after LLM response.`);
        }
    } else if (lowerCaseResponse.includes('order') && lowerCaseResponse.includes('has been placed') || (lowerCaseResponse.includes('your cart is now empty') && message.toLowerCase() === 'yes')) {
        const currentCart = await Cart.findOne({ userId }).lean() as CartDocument | null;
        if (currentCart && currentCart.items.length > 0) {
            const newOrder = await Order.create({
                userId: userId,
                items: currentCart.items,
                totalAmount: currentCart.items.reduce((total: number, item: CartItem) => total + item.price * item.quantity, 0),
                status: 'pending',
            });
            await Cart.findOneAndDelete({ userId: userId });
            const newOrderIdString = newOrder._id.toString();
            orderId = newOrderIdString; 
            cart = null;
            newResponse = `Thanks for ordering! Your cart has been cleared and your order ID is #${newOrderIdString.slice(-6)}.`;
        } else {
            newResponse = `Your cart is currently empty.`;
        }
    } else if (lowerCaseResponse.includes('in your cart')) {
        if (cart && cart.items.length > 0) {
            const totalCost = cart.items.reduce((total: number, item) => total + item.price * item.quantity, 0);
            const cartItems = cart.items.map((item: CartItem) =>
                `- ${item.name} (Size: ${item.size}) - Quantity: ${item.quantity} - Price: $${item.price.toFixed(2)}`
            ).join('\n');
            newResponse = `Here's what's in your cart:\n${cartItems}\nTotal: $${totalCost.toFixed(2)}`;
        } else {
            newResponse = `Your cart is currently empty.`;
        }
    }
    
    // Update the actionResponse with the new message
    actionResponse = newResponse;

    chatHistoryDoc.messages.push({ role: 'bot', text: actionResponse, timestamp: new Date() });
    await chatHistoryDoc.save();
    res.status(200).json({ success: true, response: actionResponse, products: allProducts, cart, orderId, });

}
