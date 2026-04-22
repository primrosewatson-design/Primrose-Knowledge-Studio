import { useState } from 'react'
import { supabase } from '../lib/supabase'

// GiftModal — lets a purchaser create (or view) the single gift link for one
// of their purchased videos. The server enforces one-gift-per-purchase via
// UNIQUE(purchase_id), and the POST is idempotent: calling it twice just
// returns the same token. That means retries/double-clicks are safe.

interface GiftModalProps {
  open: boolean
  onClose: () => void
  videoId: string
  videoTitle: string
}

type ModalState =
  | { kind: 'form' }
  | { kind: 'loading' }
  | {
      kind: 'ready'
      url: string
      recipientName: string | null
      recipientEmail: string | null
      message: string | null
      redeemedAt: string | null
      alreadyExists: boolean
    }
  | { kind: 'error'; message: string }

export default function GiftModal({ open, onClose, videoId, videoTitle }: GiftModalProps) {
  const [state, setState] = useState<ModalState>({ kind: 'form' })
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const reset = () => {
    setState({ kind: 'form' })
    setRecipientName('')
    setRecipientEmail('')
    setMessage('')
    setCopied(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const createGift = async () => {
    setState({ kind: 'loading' })

    // Same pattern as videoAccess.ts — grab a fresh session, call the edge
    // function with an explicit Authorization header so we never fall through
    // to the anon key (which would fail the sub-claim check in-function).
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session?.access_token) {
      setState({
        kind: 'error',
        message:
          "We couldn't verify your sign-in. Please refresh the page and try again.",
      })
      return
    }
    const accessToken = sessionData.session.access_token
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
    if (!supabaseUrl || !anonKey) {
      setState({ kind: 'error', message: 'Supabase is not configured.' })
      return
    }

    try {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/functions/v1/create-gift`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            video_id: videoId,
            recipient_email: recipientEmail.trim() || undefined,
            recipient_name: recipientName.trim() || undefined,
            message: message.trim() || undefined,
          }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setState({
          kind: 'error',
          message: payload.error || `Couldn't create gift link (${response.status}).`,
        })
        return
      }
      // The server returns a fully-qualified URL when SITE_URL is set on the
      // edge function; if it's not, fall back to building it from the browser
      // origin so we never show a bare /gift/<token> relative path.
      const url =
        typeof payload.url === 'string' && payload.url.startsWith('http')
          ? payload.url
          : `${window.location.origin}/gift/${payload.token}`
      setState({
        kind: 'ready',
        url,
        recipientName: payload.recipient_name ?? null,
        recipientEmail: payload.recipient_email ?? null,
        message: payload.message ?? null,
        redeemedAt: payload.redeemed_at ?? null,
        alreadyExists: !!payload.already_exists,
      })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message || 'Network error.' })
    }
  }

  const copyToClipboard = async () => {
    if (state.kind !== 'ready') return
    try {
      await navigator.clipboard.writeText(state.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Some browsers block clipboard in non-secure contexts — nothing we can
      // do automatically. The URL is visible in the input so the user can copy manually.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
              Gift "{videoTitle}"
            </h2>
            <p className="mt-1 text-xs text-gray-600 sm:text-sm">
              Each purchase includes one single-use gift link for a friend.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-gray-500 transition-colors hover:text-gray-700"
            aria-label="Close gift modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {state.kind === 'form' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Create a one-time link you can send to a friend. They'll be able to watch the full
                video once — no account required.
              </p>

              <div>
                <label htmlFor="gift-name" className="mb-1 block text-sm font-medium text-gray-900">
                  Friend's name <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  id="gift-name"
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/20"
                  placeholder="e.g. Alex"
                />
              </div>

              <div>
                <label htmlFor="gift-email" className="mb-1 block text-sm font-medium text-gray-900">
                  Friend's email <span className="text-gray-500">(optional, for your records)</span>
                </label>
                <input
                  id="gift-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  maxLength={320}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/20"
                  placeholder="friend@example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  We don't email them directly — you'll copy the link and send it yourself.
                </p>
              </div>

              <div>
                <label htmlFor="gift-message" className="mb-1 block text-sm font-medium text-gray-900">
                  Message <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="gift-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/20"
                  placeholder="Thought you'd enjoy this."
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={handleClose}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createGift}
                  className="rounded-lg bg-royal-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-royal-700"
                >
                  Create gift link
                </button>
              </div>
            </div>
          )}

          {state.kind === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-8 text-gray-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-royal-600 border-t-transparent"></div>
              <span className="text-sm">Creating your gift link…</span>
            </div>
          )}

          {state.kind === 'ready' && (
            <div className="space-y-4">
              {state.alreadyExists && (
                <div className="rounded-lg bg-royal-50 p-3 text-sm text-royal-800">
                  You already created a gift link for this video — here it is again.
                </div>
              )}

              <div>
                <label htmlFor="gift-url" className="mb-1 block text-sm font-medium text-gray-900">
                  Your gift link
                </label>
                <div className="flex gap-2">
                  <input
                    id="gift-url"
                    type="text"
                    readOnly
                    value={state.url}
                    className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/20"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={copyToClipboard}
                    className="rounded-lg bg-royal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Send this link however you like — text, email, whichever. It can only be redeemed
                  once.
                </p>
              </div>

              {state.redeemedAt ? (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  ⏳ This gift was already redeemed on {new Date(state.redeemedAt).toLocaleDateString()}.
                </div>
              ) : (
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                  ✓ Not yet redeemed. Your friend will see the video the first time they click.
                </div>
              )}

              {(state.recipientName || state.recipientEmail || state.message) && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Saved details</p>
                  {state.recipientName && (
                    <p className="mt-1">
                      For: <span className="text-gray-900">{state.recipientName}</span>
                    </p>
                  )}
                  {state.recipientEmail && (
                    <p className="mt-1">
                      Email: <span className="text-gray-900">{state.recipientEmail}</span>
                    </p>
                  )}
                  {state.message && (
                    <p className="mt-1">
                      Message: <span className="italic text-gray-900">"{state.message}"</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="rounded-lg bg-gray-200 px-5 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {state.message}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => setState({ kind: 'form' })}
                  className="rounded-lg bg-royal-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-royal-700"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
