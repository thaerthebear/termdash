const { useState } = React

// A friendly, plain-English first-run walkthrough so a complete beginner is never
// dropped into the dashboard wondering "what do I do?". Shown automatically on the
// first launch, and re-openable anytime from the "?" button in the header.
const TOUR_STEPS = [
  {
    icon: '👋',
    title: 'Welcome to TermDash',
    body: 'You give a team of AI agents a job — like "find and fix the bugs" — and they plan it, split the work, and build it together while you watch. Takes 20 seconds to learn.',
  },
  {
    icon: '✅',
    title: 'One thing you need: Claude',
    body: 'TermDash runs on your own Claude (the AI). The bar at the top of the home screen tells you if you\'re ready — green means go. If it\'s not green, it shows you exactly what to do.',
  },
  {
    icon: '🐝',
    title: 'Deploy a swarm in 3 steps',
    body: '1) Click "Swarm Deploy". 2) Type what you want done. 3) Pick a folder and hit 🚀 Deploy. The team launches and gets to work. That\'s the whole thing.',
  },
  {
    icon: '🎓',
    title: 'Nervous? Start with the demo',
    body: 'On the Swarm tab, click "🎓 Try a demo" — it sets up a safe practice project so you can watch the swarm work without touching any of your own files. You\'re ready!',
  },
]

window.WelcomeTour = function WelcomeTour ({ onClose }) {
  const [step, setStep] = useState(0)
  const s = TOUR_STEPS[step]
  const last = step === TOUR_STEPS.length - 1

  function done () {
    try { localStorage.setItem('td-tour-done', '1') } catch (_) {}
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={done}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '440px', maxWidth: '90vw', background: '#252526',
        border: '1px solid #3c3c3c', borderRadius: '12px', padding: '26px 26px 20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', color: '#cccccc',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>{s.icon}</div>
        <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: '#fff' }}>{s.title}</h2>
        <p style={{ margin: '0 0 22px', fontSize: '14px', lineHeight: 1.6 }}>{s.body}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* progress dots */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {TOUR_STEPS.map((_, i) => (
              <span key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: i === step ? '#569cd6' : '#3c3c3c',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={done} style={{
              background: 'transparent', border: 'none', color: '#808080',
              cursor: 'pointer', fontSize: '13px', padding: '6px 10px',
            }}>{last ? '' : 'Skip'}</button>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{
                background: 'transparent', border: '1px solid #3c3c3c', color: '#cccccc',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', padding: '6px 14px',
              }}>Back</button>
            )}
            <button onClick={() => last ? done() : setStep(step + 1)} style={{
              background: '#569cd6', border: 'none', color: '#fff',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px', padding: '6px 16px', fontWeight: 600,
            }}>{last ? "Let's go 🚀" : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
