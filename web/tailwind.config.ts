import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7c6fff',
          dark: '#6254d6',
        },
        surface: {
          DEFAULT: '#0f0f1a',
          card: '#1a1a2e',
          hover: '#252540',
        },
      },
    },
  },
  plugins: [],
};

export default config;
