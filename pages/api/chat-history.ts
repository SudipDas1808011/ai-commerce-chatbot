// pages/api/chat-history.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import dbConnect from '../../lib/mongodb';
import ChatHistory from '../../models/ChatHistory';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  await dbConnect();
  const session = await getSession({ req });

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userId = new mongoose.Types.ObjectId(session.user.id);

  try {
    const chatHistory = await ChatHistory.findOne({ userId });
    res.status(200).json({ success: true, data: chatHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching chat history', error: (error as Error).message });
  }
}