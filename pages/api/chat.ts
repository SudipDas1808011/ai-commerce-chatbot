// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import dbConnect from '../../lib/mongodb';
import Product from '../../models/Product';
import Cart from '../../models/Cart';
import Order from '../../models/Order';
import ChatHistory from '../../models/ChatHistory';
import mongoose from 'mongoose';

// Initialize GoogleGenerativeAI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Define an interface for chat messages to provide type safety
interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  await dbConnect();
  
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    console.warn('Authentication failed for /api/chat.ts: Session or user ID missing.');
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  let chatHistoryDoc = await ChatHistory.findOne({ userId });
  if (!chatHistoryDoc) {
    chatHistoryDoc = await ChatHistory.create({ userId, messages: [] });
  }

  // Push user message to history immediately
  chatHistoryDoc.messages.push({ role: 'user', text: message });

  let actionResponse = '';
  let products: any[] = [];
  let cart: any = null;
  let orderId: string | null = null;
  
  const allProducts = await Product.find({});
  const productNames = allProducts.map(p => p.name);
  const lastBotMessage = chatHistoryDoc.messages.filter((m:ChatMessage)=> m.role === 'bot').pop()?.text.toLowerCase() || '';
 
  try {
    // --- Start: Intent Detection and Action Execution (refactored for reliability) ---

    function extractProduct() {
      let extractedProductName: string | null = null;
        const sortedProductNames = [...productNames].sort((a, b) => b.length - a.length);
       for (const pName of sortedProductNames) {
            if (message.toLowerCase().includes(pName.toLowerCase())) {
                extractedProductName = pName;
                break;
            }
        }
        const sizeMatch = message.match(/\b(size|sizes)?\s*(\d+)\b/i);
        let extractedSize: number | null = sizeMatch ? parseInt(sizeMatch[2]) : null;

        return [extractedProductName, extractedSize];
    }

   async function handleBotResponse(response: string) {

    console.log(`[Bot Response] ${response}`);

    if(lastBotMessage.includes('added') && lastBotMessage.includes('cart')){
      let [extractedProductName, extractedSize] = extractProduct();

      const product = await Product.findOne({ 
        name: { $regex: extractedProductName ?? '', $options: 'i' } 
      });

      const newItem = {
        productId: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        size: extractedSize,
        quantity: 1,
      };

      const updatedCart = await Cart.findOneAndUpdate(
        { userId: userId }, 
        { $push: { items: newItem }, $set: { updatedAt: new Date() } },
        { new: true, upsert: true }
      );

      cart = updatedCart;
    }
}


    // Intent: Checkout/Place Order
    if (message.toLowerCase().includes('checkout') || message.toLowerCase().includes('place my order') ||  (message.toLowerCase() === 'yes' && lastBotMessage.includes('would you like to proceed with placing this order?')) ) {
      const userCart = await Cart.findOne({ userId });
      if (userCart && userCart.items.length > 0) {
        const newOrder = await Order.create({
          userId: userId,
          items: userCart.items,
          totalAmount: userCart.items.reduce((total: number, item: any) => total + item.price * item.quantity, 0),
          status: 'pending',
        });
        
        // Use findOneAndDelete to ensure the cart is completely removed from the database
        await Cart.findOneAndDelete({ userId: userId });

        const orderItems = userCart.items.map((item: { name: any; size: any; }) => `${item.name} (Size: ${item.size})`).join(', ');
        actionResponse = `Your order for ${orderItems} has been placed successfully! Your cart is now empty. Your order ID is #${newOrder._id.toString().slice(-6)}.`;
        orderId = newOrder._id.toString();
        cart = { userId: userId.toString(), items: [] }; // The cart object is now correctly empty
      } else {
        actionResponse = `Your cart is empty. Please add some items before you can checkout.`;
      }
    } 
    // Intent: Add to cart with confirmation
    else if (message.toLowerCase() === 'yes' && lastBotMessage.includes('already in your cart')) {
        const productMatch = lastBotMessage.match(/"([^"]+)"/);
        const sizeMatch = lastBotMessage.match(/size (\d+)/);
        if (productMatch && sizeMatch) {
            const productName = productMatch[1];
            const size = parseInt(sizeMatch[1]);
            const product = await Product.findOne({ name: { $regex: new RegExp(productName, 'i') } });
            if (product) {
                const filter = { userId: userId, 'items.productId': product._id, 'items.size': size };
                const update = { $inc: { 'items.$.quantity': 1 }, $set: { updatedAt: new Date() } };
                const options = { new: true };
                const updatedCart = await Cart.findOneAndUpdate(filter, update, options);
                cart = updatedCart;
                actionResponse = `Added another ${productName} (Size: ${size}) to your cart.`;
            } else {
                actionResponse = `Sorry, I couldn't find that product.`;
            }
        } else {
            actionResponse = `Sorry, I'm not sure which item you're referring to.`;
        }
    }
    // Intent: Decline to add more
    else if (message.toLowerCase() === 'no' && lastBotMessage.includes('already in your cart')) {
        actionResponse = 'Okay, no problem! Let me know if there is anything else I can help you with.';
    }
    // Intent: Add to cart
    else if ((message.toLowerCase().includes('add') && message.toLowerCase().includes('cart'))) {
        

       let [extractedProductName, extractedSize] = extractProduct();

        if (extractedProductName && extractedSize) {
            const product = await Product.findOne({ 
              name: { $regex: extractedProductName ?? '', $options: 'i' } 
            });

            if (product) {
                const userCart = await Cart.findOne({ userId });
                const existingItem = userCart?.items.find((item: any) => 
                    item.productId.toString() === product._id.toString() && item.size === extractedSize
                );

                if (existingItem) {
                    actionResponse = `It seems "${product.name}" (Size: ${extractedSize}) is already in your cart. Do you want to add another one? Reply with 'yes' or 'no'.`;
                } else {
                    if (!product.sizes.includes(extractedSize)) {
                        actionResponse = `Size ${extractedSize} is not available for ${product.name}. Available sizes are: ${product.sizes.join(', ')}.`;
                    } else {
                        const newItem = {
                            productId: product._id,
                            name: product.name,
                            image: product.image,
                            price: product.price,
                            size: extractedSize,
                            quantity: 1,
                        };
                        const updatedCart = await Cart.findOneAndUpdate(
                            { userId: userId }, 
                            { $push: { items: newItem }, $set: { updatedAt: new Date() } },
                            { new: true, upsert: true }
                        );
                        cart = updatedCart;
                        actionResponse = `Added ${product.name} (Size: ${extractedSize}) to your cart.`;
                    }
                }
            } else {
                actionResponse = `Sorry, I couldn't find a product named "${extractedProductName}".`;
            }
        } else if (extractedProductName && !extractedSize) {
            actionResponse = `What size would you like for the ${extractedProductName}?`;
        } else {
            actionResponse = `Please specify which product and size you'd like to add to your cart.`;
        }
    }
    // Intent: Remove from cart
    else if (message.toLowerCase().includes('remove') && message.toLowerCase().includes('cart')) {
        let extractedProductName: string | null = null;
        const sortedProductNames = [...productNames].sort((a, b) => b.length - a.length);

        for (const pName of sortedProductNames) {
            if (message.toLowerCase().includes(pName.toLowerCase())) {
                extractedProductName = pName;
                break;
            }
        }
        const sizeMatch = message.match(/\b(size|sizes)?\s*(\d+)\b/i);
        let extractedSize: number | null = sizeMatch ? parseInt(sizeMatch[2]) : null;

        if (extractedProductName && extractedSize) {
            const product = await Product.findOne({ name: { $regex: new RegExp(extractedProductName, 'i') } });
            if (product) {
                let userCart = await Cart.findOne({ userId });
                if (userCart) {
                    const initialItemCount = userCart.items.length;
                    userCart.items = userCart.items.filter(
                        (item: any) => !(item.productId.toString() === product._id.toString() && item.size === extractedSize)
                    );
                    if (userCart.items.length < initialItemCount) {
                        userCart.updatedAt = new Date();
                        await userCart.save();
                        actionResponse = `Removed ${product.name} (Size: ${extractedSize}) from your cart.`;
                        cart = userCart;
                    } else {
                        actionResponse = `Could not find ${product.name} (Size: ${extractedSize}) in your cart.`
                    }
                } else {
                    actionResponse = `Your cart is empty.`;
                }
            } else {
                actionResponse = `Sorry, I couldn't find a product named "${extractedProductName}".`;
            }
        } else {
            actionResponse = `Please specify which product and size you'd like to remove from your cart.`;
        }
    }
    // Intent: View cart
    else if (message.toLowerCase().includes('what is in my cart') || message.toLowerCase().includes('view cart') || message.toLowerCase().includes('show my cart')) {
      const userCart = await Cart.findOne({ userId });
      if (userCart && userCart.items.length > 0) {
        const cartItems = userCart.items.map((item: any) => 
          `- ${item.name} (Size: ${item.size}) - Quantity: ${item.quantity}`
        ).join('\n');
        actionResponse = `Your cart contains:\n${cartItems}`;
        cart = userCart;
      } else {
        actionResponse = `Your cart is currently empty.`;
      }
    } else {
      // If no specific intent is found, use the generative AI model
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const initialPrompt = `You are an AI e-commerce chatbot for a shoe store. Your primary goal is to help users find and purchase shoes.
      
      When a user asks to "show products" or "browse shoes" (e.g., "Show me running shoes", "Do you have casual shoes?", "Browse sneakers"), you MUST respond by listing 3 relevant products from the available products below. For each product, include its name, price, and available sizes. Do NOT say you cannot show images.
      
      When asked to add an item to the cart, extract the product name and size. If size is missing, ask for it.
      When asked to remove an item, extract the product name and size.
      When asked to see the cart, show the items in the user's cart.
      When asked to checkout, you should first ask for a confirmation: "Would you like to proceed with placing this order?".
      
      Respond in a helpful and concise manner. If you need more information, ask for it.
      
      Available products (for reference, do not list all unless asked to browse a category):
      ${(await Product.find({})).map(p => `${p.name} (Category: ${p.category}, Sizes: ${p.sizes.join(',')})`).join('\n')}
      `;
      const messageToSend = initialPrompt + "\n\nUser's Query: " + message;
      const historyForLLM = chatHistoryDoc.messages
        .slice(-10)
        .filter((msg: ChatMessage) => msg.role === 'user' || msg.role === 'bot')
        .map((msg: ChatMessage) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        }));
      if (historyForLLM.length > 0 && historyForLLM[0].role !== 'user') {
        historyForLLM.shift();
      }
      const chat = model.startChat({
        history: historyForLLM,
        generationConfig: { maxOutputTokens: 200 },
      });
      const result = await chat.sendMessage(messageToSend);
      actionResponse = result.response.text();

      // Secondary check for order confirmation here, to ensure LLM's
      // response is followed by a database action.
      if (actionResponse.toLowerCase().includes('would you like to proceed with placing this order?')) {
        const userCart = await Cart.findOne({ userId });
        if (userCart && userCart.items.length > 0) {
            const cartItems = userCart.items.map((item: { name: any; size: any; }) => `${item.name} (Size: ${item.size})`).join(', ');
            actionResponse = `Your cart contains: ${cartItems}. Would you like to proceed with placing this order?`;
        }
      }
    }
    // --- End: Intent Detection and Action Execution (refactored for reliability) ---

    const finalBotResponse = actionResponse;

    handleBotResponse(finalBotResponse);

    // Add bot response to history
    chatHistoryDoc.messages.push({ role: 'bot', text: finalBotResponse });
    await chatHistoryDoc.save();

    res.status(200).json({
      success: true,
      response: finalBotResponse,
      products,
      cart,
      orderId,
    });

  } catch (error) {
    console.error('Gemini API or Chatbot action error:', error);
    res.status(500).json({ success: false, message: 'Error processing your request with AI.', error: (error as Error).message });
  }
}
