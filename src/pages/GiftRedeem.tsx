import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

// GiftRedeem is a PUBLIC page — no auth required — that handles the
// `/gift/:token` URL. A friend of the purchaser lands here with the token
// baked into the URL. We do NOT auto-redeem on mount; the friend has to
// click "Watch now", which posts to the redeem-gift edge function. That
// deliberate click exists so a link preview or over-eager email scanner
// can't burn the single view by opening the URL once.

type RedeemState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing'; videoUrl: string; videoTitle: string; recipientName: string | null; message: string | null }
  | { kind: 'already_redeemed' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }

export default function GiftRedeem() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<RedeemState>({ kind: 'idle' })

  const redeem = async () => {
    if (!token) {
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
        `${supabaseUrl.replace(/\/$/, '')}/functions/v1/redeem-gift`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ token }),
        },
      )
      const payload = await response.json().catch(() => ({}))

      if (response.ok && payload.video_url) {
        setState({
          kind: 'playing',
          videoUrl: payload.video_url,
          videoTitle: payload.video_title || 'Gifted video',
          recipientName: payload.recipient_name ?? null,
          message: payload.message ?? null,
        })
        return
      }

      if (payload.error === 'already_redeemed') {
        setState({ kind: 'already_redeemed' })
        return
      }
      if (payload.error === 'gift_not_found') {
        setState({ kind: 'not_found' })
        return
      }
      setState({
        kind: 'error',
        message: payload.error || `Couldn't redeem gift (${response.status}).`,
      })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message || 'Network error.' })
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="mb-2 text-3xl font-bold text-royal-700 sm:text-4xl">A video gift for you</h1>
      <p className="mb-8 text-gray-600">
        Someone bought a video from{' '}
        <Link to="/about" className="text-royal-700 underline">
          Primrose Watson
        </Link>{' '}
        and chose to share it with you.
      </p>

      {state.kind === 'idle' && (
        <div className="rounded-xl border border-royal-100 bg-royal-50/60 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">🎁</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">You've been gifted a video</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">
            This is a one-time share. Click below when you're ready to watch — the link can only be
            redeemed once.
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
          <p className="text-gray-600">Unlocking your gift…</p>
        </div>
      )}

      {state.kind === 'playing' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
          <div className="border-b border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{state.videoTitle}</h2>
            {(state.recipientName || state.message) && (
              <div className="mt-2 text-sm text-gray-700">
                {state.recipientName && (
                  <p>
                    For <span className="font-medium">{state.recipientName}</span>
                  </p>
                )}
                {state.message && <p className="mt-1 italic">"{state.message}"</p>}
              </div>
            )}
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

      {state.kind === 'already_redeemed' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">⏳</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">Gift already redeemed</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">
            This gift link has already been used. If you'd like to watch the video again, you can buy
            your own copy.
          </p>
          <Link
            to="/how-to-choose"
            className="inline-block rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
          >
            Browse videos
          </Link>
        </div>
      )}

      {state.kind === 'not_found' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">❓</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">Gift not found</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">
            We couldn't find a gift for this link. Double-check the URL the sender shared with you.
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
