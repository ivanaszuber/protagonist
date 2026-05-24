import Link from 'next/link'

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0D0820',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        color: '#F0ECFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #FFD4C8, #FF7A65 60%, #CC4A33)',
          marginBottom: '32px',
          boxShadow: '0 0 40px rgba(255,122,101,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
        }}
      >
        ✦
      </div>

      <h1
        style={{
          fontSize: '36px',
          fontWeight: 700,
          marginBottom: '12px',
          lineHeight: 1.2,
        }}
      >
        <span style={{ color: '#FF7A65' }}>Protagonist</span>
      </h1>

      <p
        style={{
          fontSize: '16px',
          color: '#9B8EC4',
          maxWidth: '400px',
          lineHeight: 1.7,
          marginBottom: '40px',
        }}
      >
        Your life, as an RPG. Talk to Arc, get your quests, live your day.
      </p>

      <Link
        href="/dashboard"
        style={{
          display: 'inline-block',
          background: '#FF7A65',
          color: '#0D0820',
          padding: '14px 32px',
          borderRadius: '100px',
          fontSize: '15px',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 0 24px rgba(255,122,101,0.35)',
        }}
      >
        Open Your Day →
      </Link>
    </main>
  )
}
