// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from 'next-auth'; // Import NextAuthOptions
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '../../../lib/mongodb'
import User from '../../../models/User';
import bcrypt from 'bcryptjs';

// Define authOptions to be exported
export const authOptions: NextAuthOptions = { // Export authOptions
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('Authorize callback started.');
        await dbConnect(); // Ensure DB connection is established
        console.log('DB Connected in authorize.');

        const user = await User.findOne({ email: credentials?.email });
        console.log('User found in DB:', user ? user.email : 'No user found');

        if (user && credentials?.password) {
          const isMatch = await bcrypt.compare(credentials.password, user.password);
          console.log('Password match result:', isMatch);
          if (isMatch) {
            console.log('User authorized:', { id: user._id.toString(), name: user.name, email: user.email });
            return { id: user._id.toString(), name: user.name, email: user.email };
          }
        }
        console.log('Authorization failed. Returning null.');
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      console.log('JWT callback - initial token:', token);
      console.log('JWT callback - user:', user);
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        console.log('JWT callback - updated token (with user data):', token);
      }
      return token;
    },
    async session({ session, token }) {
      console.log('Session callback - initial session:', session);
      console.log('Session callback - token:', token);
      // Ensure session.user exists before assigning properties
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        console.log('Session callback - updated session (with user data):', session);
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', // Custom sign-in page
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions); // Export NextAuth with the defined options

