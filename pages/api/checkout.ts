// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next'; // Changed from getSession
import { authOptions } from '../api/auth/[...nextauth]'; // Import authOptions
import dbConnect from '../../lib/mongodb';
import Cart from '../../models/Cart';
import Order from '../../models/Order';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  // Use getServerSession with req, res, and authOptions for more robust session retrieval
  const session = await getServerSession(req, res, authOptions); 

  console.log('--- Checkout API Session Debug ---');
  console.log('Session object:', session);
  console.log('Session user ID:', session?.user?.id);
  console.log('----------------------------------');

  if (!session || !session.user?.id) {
    console.warn('Authentication failed in /api/checkout.ts: Session or user ID missing.');
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = new mongoose.Types.ObjectId(session.user.id);

  if (req.method === 'POST') {
    try {
      const cart = await Cart.findOne({ userId });

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: 'Your cart is empty.' });
      }

      const totalAmount = cart.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

      const order = await Order.create({
        userId,
        items: cart.items.map((item: any) => ({
          productId: item.productId,
          name: item.name,
          image: item.image,
          price: item.price,
          size: item.size,
          quantity: item.quantity,
        })),
        totalAmount,
        status: 'completed', // Simulate immediate completion
      });

      // Clear the user's cart after checkout
      cart.items = [];
      await cart.save();

      res.status(200).json({ success: true, message: 'Order placed successfully!', orderId: order._id });
    } catch (error) {
      console.error('Error during checkout:', error);
      res.status(500).json({ success: false, message: 'Error during checkout', error: (error as Error).message });
    }
  } else {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}
