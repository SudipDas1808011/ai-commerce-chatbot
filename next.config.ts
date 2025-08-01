import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['placehold.co'],
    // Optional: enable SVGs globally (use with caution)
    // dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
