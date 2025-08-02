// pages/cart.tsx
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface CartItem {
  _id: string;
  productId: {
    _id: string;
    name: string;
    image: string;
    price: number;
  };
  name: string;
  image: string;
  price: number;
  size: number;
  quantity: number;
}

interface CartData {
  userId: string;
  items: CartItem[];
}

export default function CartPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true); // Corrected this line
  const [error, setError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const fetchCart = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cart');
      const data = await res.json();
      if (data.success) {
        setCart(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch cart.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCart();
    } else if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [session, status]);

  const updateCartItem = async (productId: string, size: number, action: 'increment' | 'decrement' | 'remove') => {
    try {
      const res = await fetch('/api/cart', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, size, action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCart(); // Re-fetch cart to update UI
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to update cart.');
      console.error(err);
    }
  };

  const handleCheckout = async () => {
    setCheckoutMessage(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setCheckoutMessage('Order placed successfully! Your order ID is: ' + data.orderId);
        setCart(null); // Clear cart after successful checkout
      } else {
        setCheckoutMessage(data.message || 'Failed to place order.');
      }
    } catch (err) {
      setCheckoutMessage('An error occurred during checkout.');
      console.error(err);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null; // Redirect handled by useEffect
  }

  const totalAmount = cart?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head>
        <title>My Cart - AI Shoe Store</title>
      </Head>

      <header className="bg-white shadow-lg py-5 px-8 flex justify-between items-center sticky top-0 z-10 border-b border-gray-100">
        <h1 className="text-3xl font-bold text-gray-800">My Shopping Cart</h1>
        <nav>
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-semibold text-lg transition duration-200">
            Back to Products
          </Link>
        </nav>
      </header>

      <main className="flex-grow container mx-auto p-8">
        {loading && <p className="text-gray-600 text-center text-lg">Loading cart...</p>}
        {error && <p className="text-red-500 text-center text-lg">{error}</p>}
        {checkoutMessage && (
          <div className={`p-4 mb-6 rounded-lg text-center font-medium text-lg ${checkoutMessage.includes('successfully') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {checkoutMessage}
          </div>
        )}

        {!loading && !error && (!cart || cart.items.length === 0) && (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg p-8">
            <p className="text-2xl text-gray-600 mb-6 font-medium">Your cart is empty.</p>
            <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-full shadow-lg transition duration-300 transform hover:scale-105">
              Start Shopping
            </Link>
          </div>
        )}

        {cart && cart.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="grid grid-cols-1 gap-6">
              {cart.items.map((item) => (
                <div key={item._id} className="flex items-center space-x-6 border-b pb-6 last:border-b-0 last:pb-0">
                  <Image
                        src={item.image || item.productId?.image || 'https://placehold.co/100x100/cccccc/333333?text=No+Image'}
                    alt={item.name || item.productId?.name || 'Product'}
                    width={100}
                    height={100}
                    className="rounded-xl object-cover shadow-sm"
                    unoptimized={true}
                    onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/100x100/cccccc/333333?text=Image+Error';
                    }}
                  />
                  <div className="flex-grow">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">{item.name || item.productId?.name}</h3>
                    <p className="text-gray-600 text-md mb-1">Size: {item.size}</p>
                    <p className="text-lg font-bold text-indigo-600">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateCartItem(item.productId._id, item.size, 'decrement')}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-1.5 px-3.5 rounded-full transition duration-200"
                    >
                      -
                    </button>
                    <span className="text-lg font-medium w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartItem(item.productId._id, item.size, 'increment')}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-1.5 px-3.5 rounded-full transition duration-200"
                    >
                      +
                    </button>
                    <button
                      onClick={() => updateCartItem(item.productId._id, item.size, 'remove')}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-4 rounded-full shadow-sm transition duration-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center">
              <span className="text-3xl font-extrabold text-gray-900">Total: ${totalAmount.toFixed(2)}</span>
              <button
                onClick={handleCheckout}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-8 rounded-full shadow-lg transition duration-300 transform hover:scale-105"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
