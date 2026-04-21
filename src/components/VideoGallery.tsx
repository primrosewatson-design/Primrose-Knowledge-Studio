import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { addToCart, getCart, subscribeToCart } from '../lib/cart'
import AuthModal from './AuthModal'

interface Video {
  id: string
  title: string
  description: string
  thumbnail: string
  duration: string
  category: string
  price: number
  stripe_price_id: string | null
}

type PlayerState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing'; url: string; views_used: number; views_remaining: number }
  | { kind: 'needs_signin' }
  | { kind: 'not_purchased' }
  | { kind: 'view_limit' }
  | { kind: 'error'; message: string }

export default function VideoGallery() {
  const { user } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState>({ kind: 'idle' })
  const [cartIds, setCartIds] = useState<string[]>(() => getCart())
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => subscribeToCart(() => setCartIds(getCart())), [])

  useEffect(() => {
    async function fetchVideos() {
      // Explicit column list — video_url is deliberately excluded (access-gated via edge function).
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, thumbnail, duration, category, price, stripe_price_id')
        .order('created_at', { ascending: false })
      if (error) {
        setError('Failed to load videos.')
      } else {
        setVideos(data || [])
      }
      setLoading(false)
    }
    fetchVideos()
  }, [])

  const openVideo = async (video: Video) => {
    setSelectedVideo(video)
    if (!user) {
      setPlayerState({ kind: 'needs_signin' })
      return
    }
    setPlayerState({ kind: 'loading' })
    try {
      const { data, error } = await supabase.functions.invoke('get-video-access', {
        body: { video_id: video.id },
      })
      if (error) {
        // supabase-js surfaces non-2xx as an error object. The function also
        // returns a JSON body we can inspect via error.context (FunctionsHttpError).
        const ctx = (error as { context?: Response }).context
        let payload: { error?: string } = {}
        if (ctx && typeof (ctx as Response).json === 'function') {
          try {
            payload = await (ctx as Response).clone().json()
          } catch {
            /* ignore */
          }
        }
        if (payload.error === 'not_signed_in') return setPlayerState({ kind: 'needs_signin' })
        if (payload.error === 'not_purchased') return setPlayerState({ kind: 'not_purchased' })
        if (payload.error === 'view_limit_reached') return setPlayerState({ kind: 'view_limit' })
        return setPlayerState({ kind: 'error', message: payload.error || error.message })
      }
      if (!data?.video_url) {
        return setPlayerState({ kind: 'error', message: 'No video URL returned' })
      }
      setPlayerState({
        kind: 'playing',
        url: data.video_url,
        views_used: data.views_used,
        views_remaining: data.views_remaining,
      })
    } catch (err) {
      setPlayerState({ kind: 'error', message: (err as Error).message })
    }
  }

  const closePlayer = () => {
    setSelectedVideo(null)
    setPlayerState({ kind: 'idle' })
  }

  const categories = ['All', ...Array.from(new Set(videos.map((v) => v.category).filter(Boolean)))]

  const filteredVideos = videos.filter((video) => {
    const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="w-full">
      {/* Search Bar */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search videos by title or topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-royal-600 focus:outline-none focus:ring-2 focus:ring-royal-600/20"
        />
      </div>

      {/* Category Filter */}
      <div className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Filter by category</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-royal-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-royal-600 border-t-transparent"></div>
          <p className="text-gray-600">Loading videos...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="py-12 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Video Grid */}
      {!loading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="overflow-hidden rounded-lg bg-white shadow-md transition-transform hover:scale-105 hover:shadow-lg"
            >
              {/* Thumbnail */}
              <div className="relative h-40 overflow-hidden bg-gray-200">
                <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
                <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-sm text-white">
                  {video.duration}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-gray-900">{video.title}</h3>
                <p className="mb-3 line-clamp-2 text-sm text-gray-600">{video.description}</p>

                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700">
                    {video.category}
                  </span>
                  <span className="font-semibold text-gray-900">${video.price}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openVideo(video)}
                    className="flex-1 rounded-md border border-royal-600 bg-white py-2 text-center font-medium text-royal-700 transition-colors hover:bg-royal-50"
                  >
                    Watch
                  </button>
                  {cartIds.includes(video.id) ? (
                    <Link
                      to="/how-to-pay"
                      className="flex-1 rounded-md bg-gradient-violet py-2 text-center font-medium text-white transition-colors hover:opacity-90"
                    >
                      In Cart →
                    </Link>
                  ) : (
                    <button
                      onClick={() => addToCart(video.id)}
                      className="flex-1 rounded-md bg-royal-600 py-2 text-center font-medium text-white transition-colors hover:bg-royal-700"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredVideos.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">No videos found.</p>
        </div>
      )}

      {/* Video Player Modal (paywall-gated) */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900">{selectedVideo.title}</h2>
              <button
                onClick={closePlayer}
                className="text-gray-500 transition-colors hover:text-gray-700"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body: switches based on access state */}
            {playerState.kind === 'loading' && (
              <div className="flex h-96 items-center justify-center bg-black text-white">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
                  <p className="text-sm text-white/80">Checking your access…</p>
                </div>
              </div>
            )}

            {playerState.kind === 'playing' && (
              <div className="relative bg-black">
                <iframe
                  width="100%"
                  height="500"
                  src={playerState.url}
                  title={selectedVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-96 w-full md:h-[500px]"
                />
              </div>
            )}

            {playerState.kind === 'needs_signin' && (
              <div className="bg-gray-50 p-10 text-center">
                <div className="mb-3 text-5xl">🔒</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">Sign in to watch</h3>
                <p className="mx-auto mb-6 max-w-md text-gray-700">
                  Sign in with the email you used to buy this video. If you haven't purchased it yet,
                  add it to your cart first.
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    onClick={() => setAuthOpen(true)}
                    className="rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
                  >
                    Sign in with email
                  </button>
                  {!cartIds.includes(selectedVideo.id) && (
                    <button
                      onClick={() => {
                        addToCart(selectedVideo.id)
                        closePlayer()
                      }}
                      className="rounded-lg border border-royal-600 bg-white px-6 py-3 font-semibold text-royal-700 transition-colors hover:bg-royal-50"
                    >
                      Add to Cart — ${selectedVideo.price}
                    </button>
                  )}
                </div>
              </div>
            )}

            {playerState.kind === 'not_purchased' && (
              <div className="bg-gray-50 p-10 text-center">
                <div className="mb-3 text-5xl">🎟️</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">You haven't purchased this yet</h3>
                <p className="mx-auto mb-6 max-w-md text-gray-700">
                  This video is ${selectedVideo.price}. Each purchase unlocks up to 5 views from any device
                  where you're signed in.
                </p>
                {cartIds.includes(selectedVideo.id) ? (
                  <Link
                    to="/how-to-pay"
                    className="inline-block rounded-lg bg-gradient-to-r from-gradient-coral to-gradient-amber px-8 py-3 font-semibold text-white transition-transform hover:scale-[1.02]"
                  >
                    Go to Checkout →
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      addToCart(selectedVideo.id)
                      closePlayer()
                    }}
                    className="rounded-lg bg-royal-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
                  >
                    Add to Cart — ${selectedVideo.price}
                  </button>
                )}
              </div>
            )}

            {playerState.kind === 'view_limit' && (
              <div className="bg-gray-50 p-10 text-center">
                <div className="mb-3 text-5xl">🎬</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">View limit reached</h3>
                <p className="mx-auto max-w-md text-gray-700">
                  You've watched this video 5 times — the maximum for a single purchase. If you'd like to
                  keep watching, please contact{' '}
                  <a href="mailto:primrosewatson@gmail.com" className="text-royal-700 underline">
                    primrosewatson@gmail.com
                  </a>
                  .
                </p>
              </div>
            )}

            {playerState.kind === 'error' && (
              <div className="bg-gray-50 p-10 text-center">
                <div className="mb-3 text-5xl">⚠️</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">Something went wrong</h3>
                <p className="mx-auto max-w-md text-gray-700">{playerState.message}</p>
              </div>
            )}

            <div className="border-t border-gray-200 p-6">
              <div className="mb-2">
                <span className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700">
                  {selectedVideo.category}
                </span>
              </div>
              <p className="mb-4 text-gray-700">{selectedVideo.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-600">
                  Duration: {selectedVideo.duration}
                  {playerState.kind === 'playing' && (
                    <>
                      {' '}
                      · Views: {playerState.views_used}/5 (<strong>{playerState.views_remaining} left</strong>)
                    </>
                  )}
                </span>
                <button
                  onClick={closePlayer}
                  className="rounded-md bg-gray-200 px-6 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Sign in to watch"
        subtitle="Use the same email you used to purchase. We'll email you a one-click sign-in link."
      />
    </div>
  )
}
