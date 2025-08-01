// pages/auth/signup.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../../styles/signup.module.css';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/auth/signin?message=Registration successful! Please sign in.');
      } else {
        setError(data.message || 'Something went wrong.');
      }
    } catch (err) {
      setError('An error occurred during registration.');
      console.error(err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.signupBox}>
        <h1 className={styles.title}>Create Account</h1>
        {error && <p className={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            id="name"
            placeholder="Name"
            className={styles.inputField}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            id="email"
            placeholder="Email"
            className={styles.inputField}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            id="password"
            placeholder="Password"
            className={styles.inputField}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className={styles.button}>
            Sign Up
          </button>
        </form>
        <div className={styles.link}>
          <Link href="/auth/signin">Already have an account? Sign In</Link>
        </div>
      </div>
    </div>
  );
}
