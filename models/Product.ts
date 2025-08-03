// models/Product.ts
import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String, // URL to product image
    default: '[https://placehold.co/300x300/cccccc/333333?text=No+Image](https://placehold.co/300x300/cccccc/333333?text=No+Image)',
  },
  price: {
    type: Number,
    required: true,
  },
  sizes: {
    type: [Number], // Array of available sizes
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: 'A comfortable and stylish shoe.',
  },
});
// types/Product.ts
export interface IProduct {
  name: string;
  image?: string;
  price: number;
  sizes: number[];
  category: string;
  description?: string;
}

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
