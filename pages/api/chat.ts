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

// Helper function to add items to the cart with a robust, explicit update logic
async function addItemToCart(userId: mongoose.Types.ObjectId, product: any, size: number) {
  // Find the user's cart
  let userCart = await Cart.findOne({ userId });
  let message = "";

  const newItem = {
      productId: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      size: size,
      quantity: 1,
  };

  if (!userCart) {
      // If no cart exists, create a new one in memory
      userCart = new Cart({
          userId: userId,
          items: [newItem],
      });
      message = `I've added the ${product.name} in size ${size} to your cart.`;
  } else {
      // If cart exists, check if the item is already there
      const existingItemIndex = userCart.items.findIndex(
          (item: any) => item.productId.equals(product._id) && item.size === size
      );

      if (existingItemIndex > -1) {
          // If item exists, increment the quantity
          userCart.items[existingItemIndex].quantity += 1;
          message = `It seems "${product.name}" (Size: ${size}) is already in your cart. I have increased the quantity to ${userCart.items[existingItemIndex].quantity}.`;
      } else {
          // If item doesn't exist, push a new item
          userCart.items.push(newItem);
          message = `I've added the ${product.name} in size ${size} to your cart.`;
      }
  }

  // Save the cart regardless of whether it's a new or existing document
  await userCart.save();

  return { cart: userCart, message };
}

// New helper function to remove items from the cart with robust, explicit logic
async function removeItemFromCart(userId: mongoose.Types.ObjectId, product: any, size: number) {
  let userCart = await Cart.findOne({ userId });
  let message = "";

  if (!userCart) {
      message = `Could not find your cart.`;
      return { cart: null, message };
  }

  const itemIndex = userCart.items.findIndex(
      (item: any) => item.productId.equals(product._id) && item.size === size
  );

  if (itemIndex > -1) {
      // Use splice to remove the item from the array
      userCart.items.splice(itemIndex, 1);
      await userCart.save();
      message = `I've removed the ${product.name} in size ${size} from your cart.`;
      if (userCart.items.length === 0) {
        // If the cart is now empty, delete the document
        await Cart.findOneAndDelete({ userId: userId });
        userCart = null;
        message = `I've removed the ${product.name} in size ${size} from your cart. Your cart is now empty.`;
      }
  } else {
      message = `Could not find ${product.name} (Size: ${size}) in your cart.`;
  }
  
  return { cart: userCart, message };
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
  
  let actionResponse = '';
  if (!chatHistoryDoc || chatHistoryDoc.messages.length === 0) {
      chatHistoryDoc = await ChatHistory.create({ userId, messages: [] });
      actionResponse = "What type of shoes do you need?";
      chatHistoryDoc.messages.push({ role: 'bot', text: actionResponse });
      await chatHistoryDoc.save();

      return res.status(200).json({
          success: true,
          response: actionResponse,
          products: [],
          cart: null,
          orderId: null,
      });
  }

  chatHistoryDoc.messages.push({ role: 'user', text: message });

  let products: any[] = [];
  let cart: any = null;
  let orderId: string | null = null;
  
  const allProducts = await Product.find({});
  const productNames = allProducts.map(p => p.name);
  const lastBotMessage = chatHistoryDoc.messages.filter((m:ChatMessage)=> m.role === 'bot').pop()?.text.toLowerCase() || '';
 
  // Helper function to extract product name and size from a message
  function extractProductFromMessage(text: string) {
      let extractedProductName: string | null = null;
      const lowerText = text.toLowerCase();
  
      const sortedProductNames = [...productNames].sort((a, b) => b.length - a.length);

      for (const pName of sortedProductNames) {
        const lowerPName = pName.toLowerCase();
        // Create a regex to match the product name words, allowing for some variations
        // This is a more flexible check than a simple 'includes'
        const pNameRegex = new RegExp(pName.split(' ').join('.*'), 'i');
        if (lowerText.match(pNameRegex)) {
            extractedProductName = pName;
            break;
        }
      }
      
      const sizeMatch = text.match(/\b(size|sizes)?\s*(\d+)\b/i);
      let extractedSize: number | null = sizeMatch ? parseInt(sizeMatch[2]) : null;

      return [extractedProductName, extractedSize];
  }

  const [extractedProductName, extractedSize] = extractProductFromMessage(message);
  
  // A variable to hold the product name from the last bot message for multi-turn conversations
  let productNameFromLastBotMessage: string | null = null;
  for (const pName of productNames) {
      if (lastBotMessage.toLowerCase().includes(pName.toLowerCase())) {
          productNameFromLastBotMessage = pName;
          break;
      }
  }

  try {
    // --- Start: Intent Detection and Action Execution (Refactored to solve logical problems) ---

    // Intent: Checkout/Place Order
    if (lastBotMessage.includes('would you like to proceed with placing this order?') && message.toLowerCase() === 'yes') {
      const userCart = await Cart.findOne({ userId });
      if (userCart && userCart.items.length > 0) {
        const newOrder = await Order.create({
          userId: userId,
          items: userCart.items,
          totalAmount: userCart.items.reduce((total: number, item: any) => total + item.price * item.quantity, 0),
          status: 'pending',
        });
        
        await Cart.findOneAndDelete({ userId: userId });

        const orderItems = userCart.items.map((item: { name: any; size: any; }) => `${item.name} (Size: ${item.size})`).join(', ');
        actionResponse = `Your order for ${orderItems} has been placed successfully! Your cart is now empty. Your order ID is #${newOrder._id.toString().slice(-6)}.`;
        orderId = newOrder._id.toString();
        cart = { userId: userId.toString(), items: [] };
      } else {
        actionResponse = `Your cart is empty. Please add some items before you can checkout.`;
      }
    } 
    // Intent: View cart
    else if (message.toLowerCase().includes('what is in my cart') || message.toLowerCase().includes('view cart') || message.toLowerCase().includes('show my cart')) {
      const userCart = await Cart.findOne({ userId });
      if (userCart) {
        if (userCart.items.length > 0) {
          const cartItems = userCart.items.map((item: any) => 
            `- ${item.name} (Size: ${item.size}) - Quantity: ${item.quantity}`
          ).join('\n');
          actionResponse = `Your cart contains:\n${cartItems}`;
          cart = userCart;
        } else {
          // Proactively remove the cart document if it exists but is empty.
          await Cart.findOneAndDelete({ userId: userId });
          actionResponse = `Your cart is currently empty.`;
          cart = null;
        }
      } else {
        actionResponse = `Your cart is currently empty.`;
        cart = null;
      }
    }
    // Intent: Remove from cart - Primary check with product and size in one message
    else if (message.toLowerCase().includes('remove') && extractedProductName && extractedSize) {
      const product = await Product.findOne({
      name: {
      $regex: new RegExp(extractedProductName as string, 'i')
        }
      });

      if (product) {
        const size = typeof extractedSize === 'string' ? parseInt(extractedSize, 10) : extractedSize;
const { cart: updatedCart, message: cartMessage } = await removeItemFromCart(userId, product, size);

        cart = updatedCart;
        actionResponse = cartMessage;
      } else {
        actionResponse = `Sorry, I couldn't find a product named "${extractedProductName}".`;
      }
    }
    // Intent: Remove from cart - Prompt for size after the user says "remove [product]"
    else if (message.toLowerCase().includes('remove') && extractedProductName && !extractedSize) {
        actionResponse = `I can remove the ${extractedProductName}. What size was that?`;
    }
    // Intent: Remove from cart - User provides size after being asked
    else if (lastBotMessage.includes('size') && lastBotMessage.includes('remove') && !isNaN(parseInt(message))) {
        const productMatch = lastBotMessage.match(/the (.*?) (shoes|loafers)/i);
        const productName = productMatch ? productMatch[1] : null;
        const size = parseInt(message);

        if (productName && size) {
            const product = await Product.findOne({ name: { $regex: new RegExp(productName, 'i') } });
            if (product) {
                const { cart: updatedCart, message: cartMessage } = await removeItemFromCart(userId, product, size);
                cart = updatedCart;
                actionResponse = cartMessage;
            } else {
                actionResponse = `Sorry, I couldn't find that product to remove.`;
            }
        } else {
            actionResponse = `Sorry, I'm not sure which item you're referring to.`;
        }
    }
    // Intent: Handle "please remove that" response
    else if (message.toLowerCase().includes('please remove that') && lastBotMessage.includes('already in your cart')) {
        const productMatch = lastBotMessage.match(/"([^"]+)"/);
        const sizeMatch = lastBotMessage.match(/size (\d+)/);
        if (productMatch && sizeMatch) {
            const productName = productMatch[1];
            const size = parseInt(sizeMatch[1]);
            const product = await Product.findOne({ name: { $regex: new RegExp(productName, 'i') } });
            if (product) {
                const { cart: updatedCart, message: cartMessage } = await removeItemFromCart(userId, product, size);
                cart = updatedCart;
                actionResponse = cartMessage;
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
    // Intent: Add to cart - Direct "yes" response to confirmation
    else if (message.toLowerCase() === 'yes' && lastBotMessage.match(/would you like to add (this|them) to your cart\?/i) && productNameFromLastBotMessage) {
        const sizeMatch = lastBotMessage.match(/size (\d+)/i);
        if (sizeMatch) {
            const productName = productNameFromLastBotMessage;
            const size = parseInt(sizeMatch[1]);
            const product = await Product.findOne({ name: { $regex: new RegExp(productName, 'i') } });
            if (product) {
                const { cart: updatedCart, message: cartMessage } = await addItemToCart(userId, product, size);
                cart = updatedCart;
                actionResponse = cartMessage;
            } else {
                actionResponse = `Sorry, I couldn't find that product to add to your cart.`;
            }
        } else {
            actionResponse = `I'm not sure which product you're referring to.`;
        }
    }
    // Intent: Add to cart - Direct "yes" response to "add another one?"
    else if (message.toLowerCase() === 'yes' && lastBotMessage.includes('already in your cart') && productNameFromLastBotMessage) {
        const sizeMatch = lastBotMessage.match(/size (\d+)/);
        if (sizeMatch) {
            const productName = productNameFromLastBotMessage;
            const size = parseInt(sizeMatch[1]);
            const product = await Product.findOne({ name: { $regex: new RegExp(productName, 'i') } });
            if (product) {
                const { cart: updatedCart, message: cartMessage } = await addItemToCart(userId, product, size);
                cart = updatedCart;
                actionResponse = cartMessage;
            } else {
                actionResponse = `Sorry, I couldn't find that product.`;
            }
        } else {
            actionResponse = `Sorry, I'm not sure which item you're referring to.`;
        }
    }
    // Intent: Add to cart - Single message with product and size
    else if (extractedProductName && extractedSize && !lastBotMessage.includes('what size would you like for the')) {
        const product = await Product.findOne({ 
            name: { $regex: extractedProductName ?? '', $options: 'i' } 
        });

        if (product) {
            if (!product.sizes.includes(extractedSize)) {
                actionResponse = `Size ${extractedSize} is not available for ${product.name}. Available sizes are: ${product.sizes.join(', ')}.`;
            } else {
                const { cart: updatedCart, message: cartMessage } = await addItemToCart(userId, product, extractedSize);
                cart = updatedCart;
                actionResponse = cartMessage;
            }
        } else {
            actionResponse = `Sorry, I couldn't find a product named "${extractedProductName}".`;
        }
    }
    // Intent: Add to cart - User provides size after being asked
    else if (!isNaN(parseInt(message)) && lastBotMessage.includes('what size would you like for the')) {
        const productMatch = lastBotMessage.match(/for the (.*)\?/);
        if (productMatch && productMatch[1]) {
            const productName = productMatch[1];
            const size = parseInt(message);
            const product = await Product.findOne({
                name: { $regex: new RegExp(productName, 'i') },
            });

            if (product) {
                if (!product.sizes.includes(size)) {
                    actionResponse = `Size ${size} is not available for the ${product.name}. Available sizes are: ${product.sizes.join(', ')}.`;
                } else {
                    const { cart: updatedCart, message: cartMessage } = await addItemToCart(userId, product, size);
                    cart = updatedCart;
                    actionResponse = cartMessage;
                }
            } else {
                actionResponse = `Sorry, I couldn't find that product.`;
            }
        } else {
            actionResponse = `I'm not sure which product you're referring to.`;
        }
    }
    // Intent: Add to cart - Initial prompt for size
    else if (extractedProductName && !extractedSize) {
        actionResponse = `What size would you like for the ${extractedProductName}?`;
    }
    // Fallback to LLM if no specific intent is found
    else {
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

    // Add bot response to history
    chatHistoryDoc.messages.push({ role: 'bot', text: actionResponse });
    await chatHistoryDoc.save();

    res.status(200).json({
      success: true,
      response: actionResponse,
      products,
      cart,
      orderId,
    });

  } catch (error) {
    console.error('Gemini API or Chatbot action error:', error);
    res.status(500).json({ success: false, message: 'Error processing your request with AI.', error: (error as Error).message });
  }
}
