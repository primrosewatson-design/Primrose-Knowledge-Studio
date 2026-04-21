import { useState } from 'react'
import { useAuth } from '../lib/useAuth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
}

// Supabase surfaces rate-limit errors as messages containing "rate limit" or
// (less commonly) the error_code "over_email_send_rate_limit". Detecting it
// lets us flip into the code-entry flow without forcing a second email.
function isRateLimitError(message: string | null): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return m.includes('rate limit') || m.includes('too many')
}

export default function AuthModal({ open, onClose, title, subtitle }: AuthModalProps) {
  const { signInWithEmail, verifyEmailOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  if (!open) return null

  // Shared send logic — reused by the initial form submit and the "Resend"
  // button in the success state. If Supabase rate-limits the email send, we
  // still advance into the "sent" state so the user can enter the 6-digit
  // code from an email they already received (the code works independently
  // of the link, so a fresh email isn't actually required).
  const sendLink = async () => {
    setError(null)
    setRateLimited(false)
    setSubmitting(true)
    const { error } = await signInWithEmail(email.trim().toLowerCase())
    setSubmitting(false)
    if (error) {
      if (isRateLimitError(error)) {
        setRateLimited(true)
        setSent(true) // show the code-entry UI so the user isn't blocked
        return false
      }
      setError(error)
      return false
    }
    setSent(true)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendLink()
  }

  const handleResend = async () => {
    await sendLink()
  }

  const handleUseDifferentEmail = () => {
    setSent(false)
    setRateLimited(false)
    setError(null)
    setCode('')
    setCodeError(null)
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError(null)
    setVerifying(true)
    const { error } = await verifyEmailOtp(email.trim().toLowerCase(), code)
    setVerifying(false)
    if (error) {
      setCodeError(error)
      return
    }
    // Session is set by Supabase; AuthProvider picks it up via onAuthStateChange.
    handleClose()
  }

  const handleClose = () => {
    setEmail('')
    setSent(false)
    setRateLimited(false)
    setError(null)
    setCode('')
    setCodeError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title || 'Sign in'}</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 transition-colors hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {subtitle && !sent && <p className="mb-4 text-sm text-gray-600">{subtitle}</p>}

        {sent ? (
          <div>
            {rateLimited ? (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900" role="alert">
                <p className="font-semibold">Too many sign-in emails</p>
                <p className="mt-1">
                  We've sent sign-in emails to <span className="font-mono">{email}</span> recently.
                  Open the most recent one and either click the link <strong>or</strong> enter the
                  6-digit code from the email below — no need to wait for another email.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
                <p className="font-semibold">Check your inbox</p>
                <p className="mt-1">
                  We sent a sign-in link to <span className="font-mono">{email}</span>. Click the
                  link <strong>or</strong> enter the 6-digit code from the email below.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            {/* Code entry — works on both the normal "sent" flow and the rate-limited flow */}
            <form onSubmit={handleVerifyCode} className="mt-4 space-y-3">
              <div>
                <label htmlFor="auth-code" className="mb-1 block text-sm font-medium text-gray-700">
                  6-digit code from email
                </label>
                <input
                  id="auth-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-lg tracking-widest text-gray-900 focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/20"
                />
              </div>

              {codeError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {codeError}
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying ? 'Signing in…' : 'Sign in with code'}
              </button>
            </form>

            {!rateLimited && (
              <button
                type="button"
                onClick={handleResend}
                disabled={submitting}
                className="mt-3 w-full rounded-lg border-2 border-royal-600 bg-white px-4 py-2.5 text-sm font-semibold text-royal-700 transition-colors hover:bg-royal-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Sending…' : "Didn't get it? Resend link"}
              </button>
            )}

            <button
              type="button"
              onClick={handleUseDifferentEmail}
              className="mt-2 w-full rounded-md px-3 py-1.5 text-center text-xs text-gray-600 hover:text-royal-700 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/20"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use the same email you used when you purchased a video.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Sending link…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
