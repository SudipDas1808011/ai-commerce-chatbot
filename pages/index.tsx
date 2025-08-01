// pages/index.tsx
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import Chatbot from '../components/Chatbot';
import styles from '../styles/home.module.css';

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
      <div className={styles.page}>
        <p className={styles.sectionTitle}>Loading authentication...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.page}>
        <h1 className={styles.storeTitle}>Welcome to AI Shoe Store!</h1>
        <p className={styles.greeting}>Sign in or sign up to explore our amazing collection.</p>
        <div className={styles.nav}>
          <Link href="/auth/signin" className={styles.navLink}>
            Sign In
          </Link>
          <Link href="/auth/signup" className={styles.navLink}>
            Sign Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>Product Catalog - AI Shoe Store</title>
      </Head>

      <div className={styles.header}>
        <h1 className={styles.storeTitle}>AI Shoe Store</h1>
        <nav className={styles.nav}>
          <span className={styles.greeting}>
            Welcome, {session.user?.name || session.user?.email || 'Guest'}!
          </span>
          <Link href="/cart" className={styles.navLink}>
            My Cart
          </Link>
          <button onClick={() => signOut()} className={styles.signOutButton}>
            Sign Out
          </button>
        </nav>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Our Products</h2>
        {loading && <p className={styles.greeting}>Loading products...</p>}
        {error && <p className={styles.greeting}>{error}</p>}

        <div className={styles.productScroll}>
          {products.map((product) => (
            <div key={product._id} className={styles.productCard}>
              <Image
                src={product.image}
                alt={product.name}
                width={320}
                height={200}
                unoptimized
                className={styles.productImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/320x160/cccccc/333333?text=Image+Error';
                }}
              />
              <div>
                <h3 className={styles.productName}>{product.name}</h3>
                <p className={styles.productDescription}>{product.description}</p>
                <p className={styles.productPrice}>${product.price.toFixed(2)}</p>
                <p className={styles.productSizes}>Sizes: {product.sizes.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.chatSection}>
        <h2 className={styles.sectionTitle}>Need Help?</h2>
        <Chatbot />
      </section>
    </div>
  );
}
