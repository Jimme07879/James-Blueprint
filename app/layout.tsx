import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The James Blueprint',
  description: 'Private personal productivity operating system'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
