import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Damilola Elegbede | Engineering Manager',
  description:
    'Engineering Manager with 15+ years building high-performance organizations at Verily Life Sciences and Qualcomm. Specializing in cloud infrastructure, platform engineering, and developer experience.',
  keywords: [
    'Engineering Manager',
    'Cloud Infrastructure',
    'Platform Engineering',
    'GCP',
    'AWS',
    'Kubernetes',
    'Developer Experience',
    'Technical Leadership',
  ],
  authors: [{ name: 'Damilola Elegbede' }],
  openGraph: {
    title: 'Damilola Elegbede | Engineering Manager',
    description:
      'Building high-performance organizations that deliver enterprise-scale solutions',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Damilola Elegbede | Engineering Manager',
    description:
      'Building high-performance organizations that deliver enterprise-scale solutions',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
