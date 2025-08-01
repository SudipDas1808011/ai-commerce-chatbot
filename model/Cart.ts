// models/Cart.ts
import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: String, // Denormalized for easier access
  image: String, // Denormalized
  price: Number, // Denormalized
  size: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    default: 1,
  },
});

const CartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user has one cart
  },
  items: [CartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export interface CartItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  image: string;
  price: number;
  size: number;
  quantity: number;
}

export interface Cart {
  userId: mongoose.Types.ObjectId;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}


export default mongoose.models.Cart || mongoose.model('Cart', CartSchema);
