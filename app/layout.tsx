import './globals.css';
import './home-fix.css';
import './blueprint-blue.css';
import type { Metadata } from 'next';
import HomeDebtorsPanel from './HomeDebtorsPanel';
import HomeSageSales from './HomeSageSales';
import BlueprintTidyPatch from './BlueprintTidyPatch';

export const metadata: Metadata = {
  title: 'Blueprint OS',
  description: 'James personal and CEO operating system'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<HomeSageSales /><HomeDebtorsPanel /><BlueprintTidyPatch /></body>
    </html>
  );
}
