import './globals.css';
import type { Metadata } from 'next';
import HomeDebtorsPanel from './HomeDebtorsPanel';

export const metadata: Metadata = {
  title: 'Blueprint OS',
  description: 'James personal and CEO operating system'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<HomeDebtorsPanel /></body>
    </html>
  );
}
