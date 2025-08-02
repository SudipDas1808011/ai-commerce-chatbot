// scripts/seed.ts
import dotenv from 'dotenv'; // Import dotenv
dotenv.config(); // Load environment variables - MUST BE THE FIRST EXECUTABLE LINE

import dbConnect from '../lib/mongodb.js'; // Corrected import path with .js extension
import Product from '../models/Product.js'; // Corrected import path with .js extension

const products = [
  {
    name: 'Nike Air Max',
    image: 'https://placehold.co/300x300/a8dadc/000000?text=Nike+Air+Max+270',
    price: 150.00,
    sizes: [7, 8, 9, 10, 11, 12],
    category: 'running',
    description: 'Experience comfort and style with the Nike Air Max 270. Perfect for daily runs or casual wear.',
  },
  {
    name: 'Adidas Ultraboost',
    image: 'https://placehold.co/300x300/fca311/000000?text=Adidas+Ultraboost+22',
    price: 180.00,
    sizes: [7, 8, 9, 10, 11, 12],
    category: 'running',
    description: 'The ultimate running shoe with incredible energy return and adaptive fit.',
  },
  {
    name: 'Puma Suede Classic',
    image: 'https://placehold.co/300x300/e0e0e0/000000?text=Puma+Suede+Classic',
    price: 70.00,
    sizes: [6, 7, 8, 9, 10, 11],
    category: 'casual',
    description: 'A timeless classic, the Puma Suede offers comfort and iconic style for everyday use.',
  },
  {
    name: 'Converse Chuck Taylor All Star',
    image: 'https://placehold.co/300x300/8d99ae/000000?text=Converse+Chuck+Taylor',
    price: 60.00,
    sizes: [5, 6, 7, 8, 9, 10],
    category: 'casual',
    description: 'The original basketball shoe, now an iconic streetwear staple.',
  },
  {
    name: 'New Balance 990v5',
    image: 'https://placehold.co/300x300/457b9d/000000?text=New+Balance+990v5',
    price: 175.00,
    sizes: [8, 9, 10, 11, 12, 13],
    category: 'running',
    description: 'Premium comfort and stability for serious runners and everyday wearers alike.',
  },
  {
    name: 'Vans Old Skool',
    image: 'https://placehold.co/300x300/1d3557/ffffff?text=Vans+Old+Skool',
    price: 65.00,
    sizes: [6, 7, 8, 9, 10, 11],
    category: 'skate',
    description: 'The classic skate shoe with iconic side stripe, built for durability and style.',
  },
  { // Added to match user's query
    name: 'Nike Air Zoom Pegasus 40',
    image: 'https://placehold.co/300x300/a8dadc/000000?text=Nike+Air+Zoom+Pegasus+40',
    price: 130.00,
    sizes: [7, 8, 9, 10, 11, 12, 13],
    category: 'running',
    description: 'The latest iteration of the Pegasus line, offering responsive cushioning and a smooth ride.',
  },
  { // Added for testing common names
    name: 'Brooks Ghost',
    image: 'https://placehold.co/300x300/a8dadc/000000?text=Brooks+Ghost+15',
    price: 140.00,
    sizes: [8, 9, 10, 11, 12, 13, 14],
    category: 'running',
    description: 'A balanced and soft cushioning experience, perfect for daily runs.',
  },
  { // Added for testing common names
    name: 'Hoka Clifton',
    image: 'https://placehold.co/300x300/a8dadc/000000?text=Hoka+Clifton+9',
    price: 145.00,
    sizes: [9, 10, 11, 12, 13, 14, 15],
    category: 'running',
    description: 'Lightweight and plush, the Clifton 9 offers a smooth and stable ride.',
  },
  // --- NEW PRODUCTS ADDED BELOW TO MATCH CHATBOT'S "SHOW PRODUCTS" OUTPUT ---
  {
    name: 'SwiftStride Running Shoes',
    image: 'https://placehold.co/300x300/a8dadc/000000?text=SwiftStride+Running+Shoes',
    price: 89.99,
    sizes: [7, 8, 9, 10, 11, 12],
    category: 'running',
    description: 'Lightweight and responsive, designed for your fastest runs.',
  },
  {
    name: 'CozyComfort Casual Loafers',
    image: 'https://placehold.co/300x300/fca311/000000?text=CozyComfort+Casual+Loafers',
    price: 65.00,
    sizes: [7, 7.5, 8, 8.5, 9, 9.5, 10],
    category: 'casual',
    description: 'Ultimate comfort for everyday wear, perfect for relaxing.',
  },
  {
    name: 'UrbanBeat Fashion Sneakers',
    image: 'https://placehold.co/300x300/e0e0e0/000000?text=UrbanBeat+Fashion+Sneakers',
    price: 75.50,
    sizes: [7, 8, 9, 10, 11],
    category: 'casual', // Assuming casual, adjust if needed
    description: 'Stylish and trendy sneakers for the urban explorer.',
  },
];

async function seedProducts() {
  console.log('Attempting to connect to MongoDB...');
  await dbConnect();
  console.log('Successfully connected to MongoDB.');

  try {
    console.log('Deleting existing products...');
    await Product.deleteMany({}); // Clear existing products
    console.log('Existing products deleted.');
    
    console.log(`Inserting ${products.length} new products...`);
    await Product.insertMany(products); // Insert new products
    console.log('Products seeded successfully!');
  } catch (error) {
    console.error('Error seeding products:', error);
  } finally {
    console.log('Seeding process finished. Exiting...');
    process.exit();
  }
}

seedProducts();
