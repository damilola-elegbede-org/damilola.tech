import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { TrackingProvider } from '@/components/providers/TrackingProvider';
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      name: 'Damilola Elegbede',
      jobTitle: 'Distinguished Engineer',
      url: 'https://damilola.tech',
      sameAs: [
        'https://linkedin.com/in/damilola-elegbede',
        'https://github.com/damilola-elegbede',
      ],
    },
    {
      '@type': 'WebSite',
      name: 'Damilola Elegbede',
      url: 'https://damilola.tech',
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <TrackingProvider>{children}</TrackingProvider>
      </body>
    </html>
  );
}
