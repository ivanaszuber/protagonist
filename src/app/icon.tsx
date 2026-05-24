import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: 'linear-gradient(135deg, #0D0820 0%, #1A1238 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 96,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,122,101,0.2) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #FFB0A3, #FF7A65 60%, #CC4A33)',
            boxShadow: '0 0 60px rgba(255,122,101,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{ width: 12, height: 12, borderRadius: '50%', background: '#1A0E3A' }}
              />
            </div>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{ width: 12, height: 12, borderRadius: '50%', background: '#1A0E3A' }}
              />
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 6,
              background: 'rgba(255,255,255,0.5)',
              borderRadius: 3,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
