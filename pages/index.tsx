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

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 p-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-blue-800 mb-6">Welcome to AI Shoe Store!</h1>
        <p className="text-lg sm:text-xl text-gray-700 mb-8">Sign in or sign up to explore our amazing collection.</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/auth/signin" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-md transition duration-300 transform hover:scale-105">
            Sign In
          </Link>
          <Link href="/auth/signup" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full shadow-md transition duration-300 transform hover:scale-105">
            Sign Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Product Catalog - AI Shoe Store</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">AI Shoe Store</h1>
          <nav className="flex flex-col sm:flex-row items-center gap-4">
            <span className="text-gray-700 font-medium text-base sm:text-lg">
              Welcome, {session.user?.name || session.user?.email || 'Guest'}!
            </span>
            <Link href="/cart" className="text-blue-600 hover:text-blue-800 font-semibold text-base sm:text-lg transition duration-200">
              My Cart
            </Link>
            <button
              onClick={() => signOut()}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full shadow transition duration-300"
            >
              Sign Out
            </button>
          </nav>
        </header>

        {/* Product Section - Horizontally Scrollable */}
        <section className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Our Products</h2>
          {loading && <p className="text-gray-600 text-base sm:text-lg">Loading products...</p>}
          {error && <p className="text-red-500 text-base sm:text-lg">{error}</p>}

          <div className="overflow-x-auto">
            <div className="flex gap-5 px-1 sm:px-0 min-w-[100%] sm:min-w-0">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="w-[280px] sm:w-[320px] flex-shrink-0 bg-white rounded-lg shadow border p-4 flex flex-col justify-between"
                >
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={320}
                    height={200}
                    unoptimized
                    className="w-full h-[160px] object-cover rounded mb-3"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/320x160/cccccc/333333?text=Image+Error';
                    }}
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">{product.name}</h3>
                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">{product.description}</p>
                    <p className="text-lg font-bold text-indigo-600 mb-1">${product.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">Sizes: {product.sizes.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Chatbot Section */}
        <section className="bg-white rounded-lg shadow border p-4 sm:p-6 mt-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Need Help?</h2>
          <Chatbot />
        </section>
      </div>
    </div>
  );
}
