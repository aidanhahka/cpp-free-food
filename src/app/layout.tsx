import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CPP Free Food 🍕 — Cal Poly Pomona Event Calendar',
  description: 'Find every campus event at Cal Poly Pomona that has free food. Updated daily with events from clubs, student organizations, and campus departments.',
  keywords: 'Cal Poly Pomona, CPP, free food, campus events, clubs, student organizations, Pomona',
  openGraph: {
    title: 'CPP Free Food — Cal Poly Pomona',
    description: 'Never miss free food on campus again.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
