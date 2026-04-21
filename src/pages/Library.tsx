import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import AuthModal from '../components/AuthModal'

// A row in the purchased-library list. `views_used` is best-effort — pulled
// from video_views but falls back to 0 if the user has never actually watched.
interface LibraryItem {
  video_id: string
  purchased_at: string
  title: string
  thumbnail: string | null
  duration: string | null
  category: string | null
  price: number
  views_used: number
}

type PlayerState =
  | { kind: 'idle' }
  | { kind: 'loading'; videoId: string }
  | { kind: 'playing'; videoId: string; title: string; url: string; views_used: number; views_remaining: number }
  | { kind: 'view_limit'; videoId: string; title: string }
  | { kind: 'error'; videoId: string; title: string; message: string }

const MAX_VIEWS = 5

export default function Library() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [player, setPlayer] = useState<PlayerState>({ kind: 'idle' })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // RLS on purchases: SELECT allowed where user_id = auth.uid() OR
        // lower(email) = JWT email. So this picks up rows that were paid for
        // before the user ever signed in, provided the Stripe receipt email
        // matches the account email.
        const purchasesRes = await supabase
          .from('purchases')
          .select(
            'video_id, created_at, refunded_at, videos:video_id (id, title, thumbnail, duration, category, price)',
          )
          .is('refunded_at', null)
          .order('created_at', { ascending: false })

        if (purchasesRes.error) throw purchasesRes.error

        // RLS on video_views: SELECT allowed where user_id = auth.uid().
        const viewsRes = await supabase
          .from('video_views')
          .select('video_id, view_count')

        if (viewsRes.error) throw viewsRes.error

        const viewByVideo = new Map<string, number>()
        for (const row of viewsRes.data ?? []) {
          viewByVideo.set(row.video_id, row.view_count ?? 0)
        }

        // Dedupe purchases by video_id — defensively, in case the webhook
        // ever inserts a duplicate for the same video.
        const seen = new Set<string>()
        const rows: LibraryItem[] = []
        for (const p of purchasesRes.data ?? []) {
          // PostgREST returns the FK join either as a single object or an array
          // depending on the relationship cardinality. Normalise to single.
          const v = Array.isArray(p.videos) ? p.videos[0] : p.videos
          if (!v || seen.has(p.video_id)) continue
          seen.add(p.video_id)
          rows.push({
            video_id: p.video_id,
            purchased_at: p.created_at,
            title: v.title,
            thumbnail: v.thumbnail,
            duration: v.duration,
            category: v.category,
            price: v.price,
            views_used: viewByVideo.get(p.video_id) ?? 0,
          })
        }

        if (!cancelled) setItems(rows)
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load your library.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const watch = async (item: LibraryItem) => {
    setPlayer({ kind: 'loading', videoId: item.video_id })
    try {
      const { data, error } = await supabase.functions.invoke('get-video-access', {
        body: { video_id: item.video_id },
      })
      if (error) {
        const ctx = (error as { context?: Response }).context
        let payload: { error?: string; views_used?: number } = {}
        if (ctx && typeof (ctx as Response).json === 'function') {
          try {
            payload = await (ctx as Response).clone().json()
          } catch {
            /* ignore */
          }
        }
        if (payload.error === 'view_limit_reached') {
          // Bump the local views_used so the card immediately shows the correct state
          setItems((prev) =>
            prev.map((it) =>
              it.video_id === item.video_id ? { ...it, views_used: MAX_VIEWS } : it,
            ),
          )
          return setPlayer({ kind: 'view_limit', videoId: item.video_id, title: item.title })
        }
        return setPlayer({
          kind: 'error',
          videoId: item.video_id,
          title: item.title,
          message: payload.error || error.message,
        })
      }
      if (!data?.video_url) {
        return setPlayer({
          kind: 'error',
          videoId: item.video_id,
          title: item.title,
          message: 'No video URL returned',
        })
      }
      // Update local views_used so the card reflects the just-used view
      setItems((prev) =>
        prev.map((it) =>
          it.video_id === item.video_id ? { ...it, views_used: data.views_used } : it,
        ),
      )
      setPlayer({
        kind: 'playing',
        videoId: item.video_id,
        title: item.title,
        url: data.video_url,
        views_used: data.views_used,
        views_remaining: data.views_remaining,
      })
    } catch (err) {
      setPlayer({
        kind: 'error',
        videoId: item.video_id,
        title: item.title,
        message: (err as Error).message,
      })
    }
  }

  const closePlayer = () => setPlayer({ kind: 'idle' })

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.purchased_at < b.purchased_at ? 1 : a.purchased_at > b.purchased_at ? -1 : 0,
      ),
    [items],
  )

  // --- Unauthenticated state ------------------------------------------------
  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="mb-4 text-3xl font-bold text-royal-700 sm:text-4xl">My Library</h1>
        <div className="rounded-xl border border-royal-100 bg-royal-50/60 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">📚</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">
            Sign in to see your library
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">
            Use the same email you used when you purchased. We'll send you a one-click sign-in link —
            no password required.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => setAuthOpen(true)}
              className="rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
            >
              Sign in with email
            </button>
            <Link
              to="/how-to-choose"
              className="rounded-lg border border-royal-600 bg-white px-6 py-3 font-semibold text-royal-700 transition-colors hover:bg-royal-50"
            >
              Browse videos
            </Link>
          </div>
        </div>
        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          title="Sign in to your library"
          subtitle="Use the same email you used when you purchased."
        />
      </div>
    )
  }

  // --- Loading --------------------------------------------------------------
  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="mb-6 text-3xl font-bold text-royal-700 sm:text-4xl">My Library</h1>
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-royal-600 border-t-transparent"></div>
          <p className="text-gray-600">Loading your library…</p>
        </div>
      </div>
    )
  }

  // --- Error ----------------------------------------------------------------
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-6 text-3xl font-bold text-royal-700 sm:text-4xl">My Library</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <p className="font-medium">We couldn't load your library.</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // --- Empty ----------------------------------------------------------------
  if (sortedItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="mb-4 text-3xl font-bold text-royal-700 sm:text-4xl">My Library</h1>
        <div className="rounded-xl border border-royal-100 bg-royal-50/60 p-6 text-center sm:p-10">
          <div className="mb-3 text-5xl" aria-hidden="true">🎬</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">
            Nothing here yet
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-700 sm:text-base">
            Purchased videos will appear here with your remaining views. Browse the collection to pick
            your first video.
          </p>
          <Link
            to="/how-to-choose"
            className="inline-block rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
          >
            Browse videos
          </Link>
        </div>
      </div>
    )
  }

  // --- Library list ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-royal-700 sm:text-4xl">My Library</h1>
        <p className="mt-2 text-gray-600">
          {sortedItems.length} {sortedItems.length === 1 ? 'video' : 'videos'} purchased. Each unlocks up
          to 5 views from any device where you're signed in.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedItems.map((item) => {
          const viewsRemaining = Math.max(0, MAX_VIEWS - item.views_used)
          const exhausted = viewsRemaining === 0
          return (
            <div
              key={item.video_id}
              className="overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
            >
              <div className="relative h-40 overflow-hidden bg-gray-200">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    width="640"
                    height="360"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    No thumbnail
                  </div>
                )}
                {item.duration && (
                  <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-sm text-white">
                    {item.duration}
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="mb-1 line-clamp-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                {item.category && (
                  <div className="mb-3">
                    <span className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700">
                      {item.category}
                    </span>
                  </div>
                )}

                <div className="mb-4 flex items-center gap-2 text-sm">
                  {exhausted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                      View limit reached
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                      {viewsRemaining} {viewsRemaining === 1 ? 'view' : 'views'} remaining
                    </span>
                  )}
                </div>

                <button
                  onClick={() => watch(item)}
                  disabled={exhausted || (player.kind === 'loading' && player.videoId === item.video_id)}
                  className="w-full rounded-md bg-royal-600 py-2 text-center font-medium text-white transition-colors hover:bg-royal-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {exhausted
                    ? 'View limit reached'
                    : player.kind === 'loading' && player.videoId === item.video_id
                      ? 'Loading…'
                      : `▶ Watch (${item.views_used + 1}/5)`}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Player / status modal */}
      {player.kind !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-gray-900 sm:text-2xl">
                  {'title' in player ? player.title : 'Loading…'}
                </h2>
                {player.kind === 'playing' && (
                  <p className="mt-1 text-xs font-medium text-green-700 sm:text-sm">
                    View {player.views_used} of 5 ({player.views_remaining} remaining)
                  </p>
                )}
              </div>
              <button
                onClick={closePlayer}
                className="flex-shrink-0 text-gray-500 transition-colors hover:text-gray-700"
                aria-label="Close player"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {player.kind === 'loading' && (
              <div className="flex aspect-video items-center justify-center bg-black text-white">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
                  <p className="text-sm text-white/80">Loading your video…</p>
                </div>
              </div>
            )}

            {player.kind === 'playing' && (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  key={player.url}
                  src={player.url}
                  title={player.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            )}

            {player.kind === 'view_limit' && (
              <div className="bg-gray-50 p-6 text-center sm:p-10">
                <div className="mb-3 text-5xl" aria-hidden="true">🎬</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">View limit reached</h3>
                <p className="mx-auto max-w-md text-gray-700">
                  You've watched this video 5 times — the maximum for a single purchase. Contact{' '}
                  <a href="mailto:primrosewatson@gmail.com" className="text-royal-700 underline">
                    primrosewatson@gmail.com
                  </a>{' '}
                  if you'd like to keep watching.
                </p>
              </div>
            )}

            {player.kind === 'error' && (
              <div className="bg-gray-50 p-6 text-center sm:p-10">
                <div className="mb-3 text-5xl" aria-hidden="true">⚠️</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">Something went wrong</h3>
                <p className="mx-auto max-w-md text-gray-700">{player.message}</p>
              </div>
            )}

            <div className="flex justify-end border-t border-gray-200 p-4 sm:p-6">
              <button
                onClick={closePlayer}
                className="rounded-md bg-gray-200 px-5 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
