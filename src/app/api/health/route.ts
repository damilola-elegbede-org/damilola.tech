import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const HEALTH_ENDPOINT = '/api/health';

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
    const response: HealthResponse = {
      status: 'ok',
      website: 'up',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      checks: {
        app: 'ok',
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Health-Endpoint': HEALTH_ENDPOINT,
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        website: 'down',
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
        checks: {
          app: 'error',
        },
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Health-Endpoint': HEALTH_ENDPOINT,
        },
      }
    );
  }
}
