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
  
  console.log('Request Headers Cookie in /api/chat.ts:', req.headers.cookie);

  const session = await getServerSession(req, res, authOptions); // Changed from getSession

  console.log('Session in /api/chat.ts:', session);

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

  chatHistoryDoc.messages.push({ role: 'user', text: message });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    // System instruction for the LLM
    const initialPrompt = `You are an AI e-commerce chatbot for a shoe store. Your primary goal is to help users find and purchase shoes.
    
    When a user asks to "show products" or "browse shoes" (e.g., "Show me running shoes", "Do you have casual shoes?", "Browse sneakers"), you MUST respond by listing 3 relevant products from the available products below. For each product, include its name, price, and available sizes. Do NOT say you cannot show images.
    
    When asked to add an item to the cart, extract the product name and size. If size is missing, ask for it.
    When asked to remove an item, extract the product name and size.
    When asked to checkout, confirm the action.
    
    Respond in a helpful and concise manner. If you need more information, ask for it.
    
    Available products (for reference, do not list all unless asked to browse a category):
    ${(await Product.find({})).map(p => `${p.name} (Category: ${p.category}, Sizes: ${p.sizes.join(',')})`).join('\n')}
    `;

    // Construct messages array for Gemini API
    // Prepend the initialPrompt to the user's current message for every turn
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
      generationConfig: {
        maxOutputTokens: 200,
      },
    });

    const result = await chat.sendMessage(messageToSend); // Send the modified message
    const botResponseText = result.response.text();

    // --- Intent Detection and Action Execution ---
    let actionResponse = '';
    let products: any[] = [];
    let cart: any = null;
    let orderId: string | null = null;

    // Fetch all product names for dynamic matching
    const allProducts = await Product.find({});
    const productNames = allProducts.map(p => p.name);
    
    // Browse products intent - check botResponseText for general browsing intent
    if (botResponseText.toLowerCase().includes('show me') || botResponseText.toLowerCase().includes('browse') || botResponseText.toLowerCase().includes('here are some shoes')) {
      const categoryMatch = botResponseText.toLowerCase().match(/(running|casual|skate) shoes/);
      const category = categoryMatch ? categoryMatch[1] : '';
      
      products = await Product.find(category ? { category } : {}).limit(3);
      if (products.length > 0) {
        actionResponse = 'Here are some shoes:\n' + products.map(p => `- ${p.name} ($${p.price.toFixed(2)}, Sizes: ${p.sizes.join(', ')})`).join('\n');
      } else {
        actionResponse = 'I could not find any products matching your request.';
      }
    }
    // Add to cart intent - **CHECK USER'S ORIGINAL MESSAGE FOR INTENT**
    else if (message.toLowerCase().includes('add') && message.toLowerCase().includes('cart')) {
        let extractedProductName: string | null = null;
        // Sort product names by length in descending order to prioritize more specific names
        const sortedProductNames = [...productNames].sort((a, b) => b.length - a.length);

        for (const pName of sortedProductNames) {
            if (message.toLowerCase().includes(pName.toLowerCase())) {
                extractedProductName = pName;
                break; // Found the most specific product name, stop searching
            }
        }

        const sizeMatch = message.match(/\b(size|sizes)?\s*(\d+)\b/i);
        let extractedSize: number | null = sizeMatch ? parseInt(sizeMatch[2]) : null;
        
        console.log('--- Add to Cart Debug ---');
        console.log('User Message:', message);
        console.log('Extracted Product Name:', extractedProductName);
        console.log('Extracted Size:', extractedSize);
        console.log('-------------------------');

        if (extractedProductName && extractedSize) {
            const product = await Product.findOne({ name: { $regex: new RegExp(extractedProductName, 'i') } });
            console.log('Found Product in DB:', product ? product.name : 'None');
            if (product) {
                if (!product.sizes.includes(extractedSize)) {
                    actionResponse = `Size ${extractedSize} is not available for ${product.name}. Available sizes are: ${product.sizes.join(', ')}.`;
                } else {
                    let userCart = await Cart.findOne({ userId });
                    if (!userCart) {
                        userCart = await Cart.create({ userId, items: [] });
                    }
                    const existingItemIndex = userCart.items.findIndex(
                        (item: any) => item.productId.toString() === product._id.toString() && item.size === extractedSize
                    );

                    if (existingItemIndex > -1) {
                        userCart.items[existingItemIndex].quantity += 1;
                    } else {
                        userCart.items.push({
                            productId: product._id,
                            name: product.name,
                            image: product.image,
                            price: product.price,
                            size: extractedSize,
                            quantity: 1,
                        } as any);
                    }
                    userCart.updatedAt = new Date();
                    await userCart.save();
                    actionResponse = `Added ${product.name} (Size: ${extractedSize}) to your cart.`;
                    cart = userCart;
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
    // Remove from cart intent - **CHECK USER'S ORIGINAL MESSAGE FOR INTENT**
    else if (message.toLowerCase().includes('remove') && message.toLowerCase().includes('cart')) {
        let extractedProductName: string | null = null;
        // Sort product names by length in descending order to prioritize more specific names
        const sortedProductNames = [...productNames].sort((a, b) => b.length - a.length);

        for (const pName of sortedProductNames) {
            if (message.toLowerCase().includes(pName.toLowerCase())) {
                extractedProductName = pName;
                break; // Found the most specific product name, stop searching
            }
        }

        const sizeMatch = message.match(/\b(size|sizes)?\s*(\d+)\b/i);
        let extractedSize: number | null = sizeMatch ? parseInt(sizeMatch[2]) : null;

        console.log('--- Remove from Cart Debug ---');
        console.log('User Message:', message);
        console.log('Extracted Product Name:', extractedProductName);
        console.log('Extracted Size:', extractedSize);
        console.log('----------------------------');

        if (extractedProductName && extractedSize) {
            const product = await Product.findOne({ name: { $regex: new RegExp(extractedProductName, 'i') } });
            console.log('Found Product in DB:', product ? product.name : 'None');
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
    // Checkout intent - **MODIFIED: Now creates an order and clears the cart**
    else if (message.toLowerCase().includes('checkout') || message.toLowerCase().includes('place my order')) {
      const userCart = await Cart.findOne({ userId });
      if (userCart && userCart.items.length > 0) {
        // Create the order
        const newOrder = await Order.create({
          userId: userId,
          items: userCart.items,
          totalAmount: userCart.items.reduce((total: number, item: any) => total + item.price * item.quantity, 0),
          status: 'pending',
        });

        // Clear the user's cart
        userCart.items = [];
        await userCart.save();
        
        actionResponse = `Your order #${newOrder._id.toString().slice(-6)} has been placed successfully! Thank you for shopping with us.`;
        orderId = newOrder._id.toString();
        cart = userCart;
      } else {
        actionResponse = `Your cart is empty. Please add some items before you can checkout.`;
      }
    }

    const finalBotResponse = actionResponse || botResponseText;

    // Add bot response to history
    chatHistoryDoc.messages.push({ role: 'bot', text: finalBotResponse });
    await chatHistoryDoc.save();

    res.status(200).json({
      success: true,
      response: finalBotResponse,
      products,
      cart,
      orderId, // This will be null if checkout intent was handled by chatbot
    });

  } catch (error) {
    console.error('Gemini API or Chatbot action error:', error);
    res.status(500).json({ success: false, message: 'Error processing your request with AI.', error: (error as Error).message });
  }
}