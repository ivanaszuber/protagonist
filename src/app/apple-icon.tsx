import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #0D0820 0%, #1A1238 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #FFB0A3, #FF7A65 60%, #CC4A33)',
            boxShadow: '0 0 30px rgba(255,122,101,0.6)',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
