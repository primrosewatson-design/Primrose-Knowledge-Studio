import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

// CodeRedeem is a PUBLIC page — no auth required — that handles the
// `/code/:code` URL. A visitor lands here with an admin-issued access
// code baked into the URL. Codes are reusable by default — the visitor
// clicks "Watch now" to unlock the video, and can come back and watch
// again. To retire a code, delete the row in `access_codes` via MCP.

type RedeemState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing'; videoUrl: string; videoTitle: string; note: string | null }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }

export default function CodeRedeem() {
  const { code } = useParams<{ code: string }>()
  const [state, setState] = useState<RedeemState>({ kind: 'idle' })

  const redeem = async () => {
    if (!code) {
      setState({ kind: 'not_found' })
      return
    }
    setState({ kind: 'loading' })

    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
    if (!supabaseUrl || !anonKey) {
      setState({ kind: 'error', message: 'This link is misconfigured. Please contact the sender.' })
      return
    }

    try {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/functions/v1/redeem-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ code }),
        },
      )
      const payload = await response.json().catch(() => ({}))

      if (response.ok && payload.video_url) {
        setState({
          kind: 'playing',
          videoUrl: payload.video_url,
          videoTitle: payload.video_title || 'Your free video',
          note: payload.note ?? null,
        })
        return
      }

      if (payload.error === 'code_not_found') {
        setState({ kind: 'not_found' })
        return
      }
      // Map known edge-function error codes to friendly copy. Anything
      // we don't recognise falls back to a generic message — we never
      // leak raw internal error strings to the viewer.
      const friendlyMessage =
        payload.error === 'video_not_available'
          ? "This video isn't available right now. Please contact the sender."
          : payload.error === 'bad_request'
            ? 'This link looks incomplete. Please check the address and try again.'
            : "Sorry, we couldn't unlock your video. Please try again in a moment."
      setState({ kind: 'error', message: friendlyMessage })
    } catch {
      setState({
        kind: 'error',
        message: 'We couldn\u2019t reach the server. Check your connection and try again.',
      })
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="mb-2 text-3xl font-bold text-royal-700 sm:text-4xl">Redeem your free video</h1>
      <p className="mb-8 text-gray-600">
        You've received an access code from{' '}
        <Link to="/about" className="text-royal-700 underline">
          Primrose Watson
        </Link>
        . Click below to unlock your free video.
      </p>

      {state.kind === 'idle' && (
        <div className="rounded-xl border border-royal-100 bg-royal-50/60 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">🎟️</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">Watch a free video</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">
            Your code: <span className="font-mono font-semibold text-gray-900">{code}</span>
          </p>
          <button
            onClick={redeem}
            className="rounded-lg bg-gradient-to-r from-gradient-coral to-gradient-amber px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            ▶ Watch now
          </button>
        </div>
      )}

      {state.kind === 'loading' && (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-royal-600 border-t-transparent"></div>
          <p className="text-gray-600">Unlocking your video…</p>
        </div>
      )}

      {state.kind === 'playing' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{state.videoTitle}</h2>
            {state.note && <p className="mt-2 text-sm text-gray-700">{state.note}</p>}
          </div>
          <div className="relative aspect-video w-full bg-black">
            <iframe
              key={state.videoUrl}
              src={state.videoUrl}
              title={state.videoTitle}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
          <div className="bg-gray-50 p-4 sm:p-6">
            <p className="text-sm text-gray-700">
              Enjoyed this? Browse the full collection at{' '}
              <Link to="/how-to-choose" className="text-royal-700 underline">
                Primrose Knowledge Studio
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {state.kind === 'not_found' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">❓</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">Code not found</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">
            We couldn't find a video for this code. Double-check the code you were given.
          </p>
          <Link
            to="/"
            className="inline-block rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
          >
            Go home
          </Link>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">⚠️</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">Something went wrong</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">{state.message}</p>
          <button
            onClick={redeem}
            className="inline-block rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
