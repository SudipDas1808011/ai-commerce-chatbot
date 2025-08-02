// pages/api/products.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../lib/mongodb';
import Product from '../../models/Product';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const { category } = req.query;
      let products;

      if (category) {
        products = await Product.find({ category: category.toString().toLowerCase() });
      } else {
        products = await Product.find({});
      }

      res.status(200).json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server Error', error: (error as Error).message });
    }
  } else {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}