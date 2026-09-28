import { useState } from 'react'
import { ArrowRight, Leaf } from 'lucide-react'
import heroImage from './assets/hero.png'
import './AuthScreen.css'

export default function AuthScreen({ onSubmit, demoOnly = false, onGuest }) {
  const [mode, setMode] = useState('register')
  const [values, setValues] = useState({ name: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isRegistering = mode === 'register'

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(mode, values)
    } catch (submitError) {
      setError(submitError.message || 'Unable to access your account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-visual" aria-label="Little Practice">
        <img src={heroImage} alt="A quiet, sunlit space for creative practice" />
        <div className="auth-visual-shade" />
        <a className="auth-brand" href="#home" aria-label="Little Practice home">
          <span className="auth-brand-mark"><Leaf size={19} /></span>
          <span>little<span>practice</span></span>
        </a>
        <div className="auth-visual-copy">
          <span>MAKE SPACE FOR WHAT MATTERS</span>
          <p>Good things grow<br />one small step at a time.</p>
        </div>
        <span className="auth-image-credit">A practice of your own.</span>
      </section>

      <section className="auth-main">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="auth-brand-mark"><Leaf size={18} /></span>little<span>practice</span></div>
          <div className="auth-heading">
            <span className="auth-kicker">{demoOnly ? 'PUBLIC PREVIEW' : 'YOUR NEXT CHAPTER'}</span>
            <h1>{demoOnly ? 'Explore Little Practice.' : isRegistering ? 'Start your own practice.' : 'Welcome back.'}</h1>
            <p>{demoOnly ? 'Try the interactive workspace. Your changes stay in this browser.' : isRegistering ? 'Create an account and make a little room for what you love.' : 'Sign in to pick up where you left off.'}</p>
          </div>

          {demoOnly ? <div className="auth-demo-actions">
            <button className="auth-submit" type="button" onClick={onGuest}>Explore public demo<ArrowRight size={17} /></button>
            <a href="https://github.com/shm230605/Online-Cloud-Hobby-Skills-Tracker-with-Community-Sharing">View source on GitHub</a>
          </div> : <>
            <div className="auth-mode" aria-label="Account access">
              <button type="button" className={isRegistering ? 'auth-mode-active' : ''} aria-pressed={isRegistering} onClick={() => { setMode('register'); setError('') }}>Create account</button>
              <button type="button" className={!isRegistering ? 'auth-mode-active' : ''} aria-pressed={!isRegistering} onClick={() => { setMode('login'); setError('') }}>Sign in</button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isRegistering && <>
                <label>Full name<input autoComplete="name" required maxLength={80} value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" /></label>
                <label>Username<input autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" title="Use 3–32 letters, numbers, or underscores." value={values.username} onChange={(event) => update('username', event.target.value)} placeholder="Choose a username" /></label>
              </>}
              <label>Email address<input type="email" autoComplete="email" required maxLength={255} value={values.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" /></label>
              <label>Password<input type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} required minLength={isRegistering ? 8 : undefined} maxLength={128} value={values.password} onChange={(event) => update('password', event.target.value)} placeholder={isRegistering ? 'At least 8 characters' : 'Your password'} /></label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'Please wait…' : isRegistering ? 'Create your account' : 'Sign in'}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>
            <p className="auth-privacy">Your password is protected. Practice data stays in this browser.</p>
          </>}
        </div>
      </section>
    </main>
  )
}