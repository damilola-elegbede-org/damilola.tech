import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A2540',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
        }}
      >
        <div style={{ color: 'white', fontSize: 64, fontWeight: 700, marginBottom: 16 }}>
          Damilola Elegbede
        </div>
        <div style={{ color: '#0066FF', fontSize: 44, fontWeight: 600, marginBottom: 24 }}>
          Distinguished Engineer
        </div>
        <div style={{ color: '#8B9EB0', fontSize: 24 }}>
          AI Infrastructure · System Architecture · Platform Engineering
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 80,
            color: '#8B9EB0',
            fontSize: 18,
          }}
        >
          damilola.tech
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
