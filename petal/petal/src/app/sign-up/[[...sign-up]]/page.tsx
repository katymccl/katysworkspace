import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fff0f5 0%, #fce4ec 40%, #f8bbd0 100%)',
      flexDirection: 'column',
      gap: '24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌸</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, color: '#c2185b', fontStyle: 'italic', margin: 0 }}>petal</h1>
        <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, color: '#ad1457', opacity: 0.7, marginTop: 6 }}>your little task garden</p>
      </div>
      <SignUp />
    </div>
  )
}
