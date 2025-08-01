// models/ChatHistory.ts
import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  role: {
    type: String, // 'user' or 'bot'
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ChatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user has one chat history
  },
  messages: [ChatMessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.ChatHistory || mongoose.model('ChatHistory', ChatHistorySchema);
