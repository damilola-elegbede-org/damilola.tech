import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type HealthResponse = {
  status: 'ok' | 'error';
  website: 'up' | 'down';
  timestamp: string;
  environment: string;
  checks: {
    app: 'ok' | 'error';
  };
};

export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    return NextResponse.json(
      {
        status: 'ok',
        website: 'up',
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
        checks: { app: 'ok' },
      } satisfies HealthResponse,
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Health-Endpoint': '/api/v1/health',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        website: 'down',
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
        checks: { app: 'error' },
      } satisfies HealthResponse,
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Health-Endpoint': '/api/v1/health',
        },
      }
    );
  }
}
