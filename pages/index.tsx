// pages/index.tsx
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import Chatbot from '../components/Chatbot'; 

interface Product {
  _id: string;
  name: string;
  image: string;
  price: number;
  sizes: number[];
  category: string;
  description: string;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success) {
          setProducts(data.data);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError('Failed to fetch products.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">Loading authentication...</p>
      </div>
    );
  }

  // Handle unauthenticated state explicitly
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 p-6">
        <h1 className="text-5xl font-extrabold text-blue-800 mb-8 animate-fade-in">Welcome to AI Shoe Store!</h1>
        <p className="text-xl text-gray-700 mb-10">Sign in or sign up to explore our amazing collection.</p>
        <div className="flex space-x-6">
          <Link href="/auth/signin" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-full shadow-lg transition duration-300 transform hover:scale-105">
            Sign In
          </Link>
          <Link href="/auth/signup" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-8 rounded-full shadow-lg transition duration-300 transform hover:scale-105">
            Sign Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head>
        <title>Product Catalog - AI Shoe Store</title>
      </Head>

      <header className="bg-white shadow-lg py-5 px-8 flex justify-between items-center sticky top-0 z-20 border-b border-gray-100">
        <h1 className="text-3xl font-bold text-gray-800">AI Shoe Store</h1>
        <nav className="flex items-center space-x-6">
          {/* Safely access session.user properties using optional chaining and nullish coalescing */}
          <span className="text-gray-700 font-medium text-lg">Welcome, {session.user?.name || session.user?.email || 'Guest'}!</span>
          <Link href="/cart" className="text-blue-600 hover:text-blue-800 font-semibold text-lg transition duration-200">
            My Cart
          </Link>
          <button
            onClick={() => signOut()}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-5 rounded-full shadow-md transition duration-300"
          >
            Sign Out
          </button>
        </nav>
      </header>

      <main className="flex-grow container mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="md:col-span-2">
          <h2 className="text-4xl font-bold text-gray-800 mb-8">Our Products</h2>
          {loading && <p className="text-gray-600 text-lg">Loading products...</p>}
          {error && <p className="text-red-500 text-lg">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div key={product._id} className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition duration-300 hover:scale-103 hover:shadow-2xl border border-gray-100">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={300}
                  height={300}
                  className="w-full h-56 object-cover rounded-t-2xl"
                  unoptimized={true} // Added unoptimized prop here
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/300x300/cccccc/333333?text=Image+Error';
                  }}
                />
                <div className="p-5">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-700 text-sm mb-3">{product.description}</p>
                  <p className="text-2xl font-extrabold text-indigo-600 mb-4">${product.price.toFixed(2)}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-600 mb-4">
                    Sizes: {product.sizes.join(', ')}
                  </div>
                  {/* Add to cart functionality will be handled by chatbot or direct button later */}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-1 bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Chat with our AI</h2>
          <Chatbot /> {/* Chatbot component will go here */}
        </div>
      </main>
    </div>
  );
}