import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import dbConnect from '../../lib/mongodb';
import Cart from '../../models/Cart';
import Product from '../../models/Product';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const session = await getSession({ req });

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = new mongoose.Types.ObjectId(session.user.id);
  console.log(`[Cart API] ${req.method} request by user ${userId}`);

  switch (req.method) {
    case 'GET':
      try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        res.status(200).json({ success: true, data: cart || { userId, items: [] } });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching cart', error: (error as Error).message });
      }
      break;

    case 'POST': // Add item to cart
      try {
        const { productId, size, quantity = 1 } = req.body;

        if (!productId || !size) {
          return res.status(400).json({ success: false, message: 'Product ID and size are required.' });
        }

        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        if (!product.sizes.includes(parseInt(size))) {
          return res.status(400).json({ success: false, message: `Size ${size} is not available for this product.` });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
          cart = await Cart.create({ userId, items: [] });
        }

        const existingItemIndex = cart.items.findIndex(
          (item: any) => item.productId.toString() === productId && item.size === parseInt(size)
        );

        if (existingItemIndex > -1) {
          cart.items[existingItemIndex].quantity += quantity;
        } else {
          cart.items.push({
            productId: new mongoose.Types.ObjectId(productId),
            name: product.name,
            image: product.image,
            price: product.price,
            size: parseInt(size),
            quantity,
          } as any);
        }

        cart.updatedAt = new Date();
        await cart.save();
        res.status(200).json({ success: true, message: 'Item added to cart', data: cart });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Error adding item to cart', error: (error as Error).message });
      }
      break;

    case 'PUT': // Update item quantity or remove item entirely
      try {
        const { productId, size, action } = req.body;

        if (!productId || !size || !action) {
          return res.status(400).json({ success: false, message: 'Product ID, size, and action are required.' });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
          return res.status(404).json({ success: false, message: 'Cart not found.' });
        }

        const itemIndex = cart.items.findIndex(
          (item: any) => item.productId.toString() === productId && item.size === parseInt(size)
        );

        if (itemIndex === -1) {
          return res.status(404).json({ success: false, message: 'Item not found in cart.' });
        }

        if (action === 'remove') {
          cart.items.splice(itemIndex, 1);
        } else if (action === 'decrement') {
          if (cart.items[itemIndex].quantity > 1) {
            cart.items[itemIndex].quantity -= 1;
          } else {
            cart.items.splice(itemIndex, 1);
          }
        } else if (action === 'increment') {
          cart.items[itemIndex].quantity += 1;
        } else {
          return res.status(400).json({ success: false, message: 'Invalid action.' });
        }

        cart.updatedAt = new Date();
        await cart.save();
        res.status(200).json({ success: true, message: 'Cart updated', data: cart });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating cart item', error: (error as Error).message });
      }
      break;

    case 'DELETE': // Clear entire cart
      try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
          return res.status(404).json({ success: false, message: 'Cart not found.' });
        }

        cart.items = [];
        cart.updatedAt = new Date();
        await cart.save();

        res.status(200).json({ success: true, message: 'Cart has been cleared.', data: cart });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Error clearing cart', error: (error as Error).message });
      }
      break;

    default:
      res.status(405).json({ success: false, message: 'Method Not Allowed' });
      break;
  }
}
