import 'dotenv/config';

export const config = {
  apiKey: process.env.DK_API_KEY || '',
  apiBaseUrl: process.env.DK_API_BASE_URL || 'http://localhost:3000',
};

export function validateConfig(): void {
  if (!config.apiKey) {
    throw new Error('DK_API_KEY environment variable is required');
  }
}
