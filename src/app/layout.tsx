import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { TrackingProvider } from '@/components/providers/TrackingProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Damilola Elegbede | Distinguished Engineer',
  description:
    'Distinguished Engineer with 15+ years designing mission-critical systems at Verily Life Sciences and Qualcomm. Specializing in AI infrastructure, system architecture, platform engineering, and org-scale technical leadership.',
  keywords: [
    'Distinguished Engineer',
    'Staff Engineer',
    'Principal Engineer',
    'AI Infrastructure',
    'System Architecture',
    'Platform Engineering',
    'Cloud Transformation',
    'Multi-Agent Orchestration',
  ],
  authors: [{ name: 'Damilola Elegbede' }],
  openGraph: {
    title: 'Damilola Elegbede | Distinguished Engineer',
    description:
      'Architecting systems for org-scale impact — AI infrastructure, cloud platforms, and distributed foundations',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Damilola Elegbede | Distinguished Engineer',
    description:
      'Architecting systems for org-scale impact — AI infrastructure, cloud platforms, and distributed foundations',
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
        <TrackingProvider>{children}</TrackingProvider>
      </body>
    </html>
  );
}
