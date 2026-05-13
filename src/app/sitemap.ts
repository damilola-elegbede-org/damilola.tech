import type { MetadataRoute } from 'next';

const BASE_URL = 'https://damilola.tech';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/consulting`,
      lastModified: new Date('2026-05-03'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/projects/cortex/case-study`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/projects/cortex/activity`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: new Date('2026-01-27'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/docs/about`,
      lastModified: new Date('2026-01-27'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/docs/ai-assistant`,
      lastModified: new Date('2026-01-27'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/docs/privacy`,
      lastModified: new Date('2026-01-27'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
