import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkTonix Dashboard',
  description: 'WorkTonix Web Management Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-gray-200 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
