import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { requestVideoAccess } from '../lib/videoAccess'
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
  preview_youtube_id: string | null
}

// Modal body state. The preview iframe is always available (anyone can watch
// the first 3 min); the rest of the states drive the "unlock full video" CTA.
type FullAccess =
  | { kind: 'idle' }          // preview playing, user hasn't asked for full yet
  | { kind: 'loading' }       // unlock call in flight
  | { kind: 'playing'; url: string; views_used: number; views_remaining: number }
  | { kind: 'needs_signin' }
  | { kind: 'not_purchased' }
  | { kind: 'view_limit' }
  | { kind: 'error'; message: string }

// YouTube embed params for the preview. `end=180` caps playback at 3 minutes;
// `rel=0` prevents suggesting other creators at end; `modestbranding=1` is
// deprecated by YouTube but still suppresses some branding; `autoplay=1`
// kicks off playback since the user just intentionally clicked Preview.
function buildPreviewUrl(youtubeId: string): string {
  const params = new URLSearchParams({
    start: '0',
    end: '180',
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })
  return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`
}

export default function VideoGallery() {
  const { user } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [fullAccess, setFullAccess] = useState<FullAccess>({ kind: 'idle' })
  const [cartIds, setCartIds] = useState<string[]>(() => getCart())
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => subscribeToCart(() => setCartIds(getCart())), [])

  useEffect(() => {
    async function fetchVideos() {
      // Explicit column list — video_url is deliberately excluded (access-gated
      // via edge function); preview_youtube_id is public and drives the trailer.
      const { data, error } = await supabase
        .from('videos')
        .select(
          'id, title, description, thumbnail, duration, category, price, stripe_price_id, preview_youtube_id',
        )
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

  // Open the preview modal for a video. No auth required — the preview
  // plays for anyone with a valid preview_youtube_id.
  const openPreview = (video: Video) => {
    setSelectedVideo(video)
    setFullAccess({ kind: 'idle' })
  }

  // User clicked "Watch full video" inside the preview modal. Run the same
  // paywall-gated flow that the previous Watch button used.
  const requestFullAccess = async () => {
    if (!selectedVideo) return
    if (!user) {
      setFullAccess({ kind: 'needs_signin' })
      return
    }
    setFullAccess({ kind: 'loading' })
    const result = await requestVideoAccess(selectedVideo.id)
    switch (result.kind) {
      case 'ok':
        setFullAccess({
          kind: 'playing',
          url: result.video_url,
          views_used: result.views_used,
          views_remaining: result.views_remaining,
        })
        return
      case 'not_signed_in':
        setFullAccess({ kind: 'needs_signin' })
        return
      case 'not_purchased':
        setFullAccess({ kind: 'not_purchased' })
        return
      case 'view_limit_reached':
        setFullAccess({ kind: 'view_limit' })
        return
      case 'error':
        setFullAccess({ kind: 'error', message: result.message })
        return
    }
  }

  const closeModal = () => {
    setSelectedVideo(null)
    setFullAccess({ kind: 'idle' })
  }

  const categories = ['All', ...Array.from(new Set(videos.map((v) => v.category).filter(Boolean)))]

  const filteredVideos = videos.filter((video) => {
    const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Which iframe to show: full (if unlocked) else preview.
  const videoIframeSrc =
    fullAccess.kind === 'playing'
      ? fullAccess.url
      : selectedVideo?.preview_youtube_id
        ? buildPreviewUrl(selectedVideo.preview_youtube_id)
        : null

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
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Filter by category</h2>
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
          {filteredVideos.map((video) => {
            const hasPreview = !!video.preview_youtube_id
            return (
              <div
                key={video.id}
                className="overflow-hidden rounded-lg bg-white shadow-md transition-transform hover:scale-105 hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative h-40 overflow-hidden bg-gray-200">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    loading="lazy"
                    decoding="async"
                    width="640"
                    height="360"
                    className="h-full w-full object-cover"
                  />
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
                      onClick={() => openPreview(video)}
                      disabled={!hasPreview}
                      title={hasPreview ? 'Watch the first 3 minutes free' : 'Preview not available yet'}
                      className="flex-1 rounded-md border border-royal-600 bg-white py-2 text-center font-medium text-royal-700 transition-colors hover:bg-royal-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-white"
                    >
                      ▶ Preview
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
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredVideos.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">No videos found.</p>
        </div>
      )}

      {/* Preview Modal — shows 3-min preview by default, upgrades to full on unlock */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-gray-900 sm:text-2xl">{selectedVideo.title}</h2>
                {fullAccess.kind !== 'playing' && (
                  <p className="mt-1 text-xs font-medium text-gradient-violet sm:text-sm">
                    ▶ Free 3-minute preview
                  </p>
                )}
                {fullAccess.kind === 'playing' && (
                  <p className="mt-1 text-xs font-medium text-green-700 sm:text-sm">
                    ✓ Full video — view {fullAccess.views_used} of 5 ({fullAccess.views_remaining} remaining)
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="flex-shrink-0 text-gray-500 transition-colors hover:text-gray-700"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Video player — preview or full iframe depending on access state */}
            {videoIframeSrc ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  key={videoIframeSrc}
                  src={videoIframeSrc}
                  title={
                    fullAccess.kind === 'playing'
                      ? selectedVideo.title
                      : `${selectedVideo.title} — preview`
                  }
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-gray-100 px-6 text-center text-gray-500">
                Preview not available yet for this video.
              </div>
            )}

            {/* CTA area — changes with fullAccess state */}
            <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6">
              {fullAccess.kind === 'idle' && (
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
                      Enjoying the preview?
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-600">
                      Unlock the full {selectedVideo.duration} video — 5 views included.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {cartIds.includes(selectedVideo.id) ? (
                      <Link
                        to="/how-to-pay"
                        className="rounded-lg bg-gradient-to-r from-gradient-coral to-gradient-amber px-5 py-2.5 text-center font-semibold text-white transition-transform hover:scale-[1.02]"
                      >
                        Go to Checkout →
                      </Link>
                    ) : (
                      <button
                        onClick={() => addToCart(selectedVideo.id)}
                        className="rounded-lg bg-royal-600 px-5 py-2.5 text-center font-semibold text-white transition-colors hover:bg-royal-700"
                      >
                        Add to Cart — ${selectedVideo.price}
                      </button>
                    )}
                    <button
                      onClick={requestFullAccess}
                      className="rounded-lg border border-royal-600 bg-white px-5 py-2.5 text-center font-medium text-royal-700 transition-colors hover:bg-royal-50"
                    >
                      I've purchased — watch full
                    </button>
                  </div>
                </div>
              )}

              {fullAccess.kind === 'loading' && (
                <div className="flex items-center justify-center gap-3 py-2 text-gray-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-royal-600 border-t-transparent"></div>
                  <span className="text-sm">Checking your access…</span>
                </div>
              )}

              {fullAccess.kind === 'needs_signin' && (
                <div className="text-center sm:text-left">
                  <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Sign in to watch</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Use the email you used when you purchased. We'll email you a one-click sign-in link.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => setAuthOpen(true)}
                      className="rounded-lg bg-royal-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-royal-700"
                    >
                      Sign in with email
                    </button>
                    {!cartIds.includes(selectedVideo.id) && (
                      <button
                        onClick={() => addToCart(selectedVideo.id)}
                        className="rounded-lg border border-royal-600 bg-white px-5 py-2.5 font-medium text-royal-700 transition-colors hover:bg-royal-50"
                      >
                        Add to Cart — ${selectedVideo.price}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {fullAccess.kind === 'not_purchased' && (
                <div className="text-center sm:text-left">
                  <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
                    Get the full video
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    This video is ${selectedVideo.price}. Each purchase unlocks up to 5 views from any
                    device you sign in on.
                  </p>
                  <div className="mt-3">
                    {cartIds.includes(selectedVideo.id) ? (
                      <Link
                        to="/how-to-pay"
                        className="inline-block rounded-lg bg-gradient-to-r from-gradient-coral to-gradient-amber px-6 py-2.5 font-semibold text-white transition-transform hover:scale-[1.02]"
                      >
                        Go to Checkout →
                      </Link>
                    ) : (
                      <button
                        onClick={() => addToCart(selectedVideo.id)}
                        className="rounded-lg bg-royal-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-royal-700"
                      >
                        Add to Cart — ${selectedVideo.price}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {fullAccess.kind === 'view_limit' && (
                <div className="text-center sm:text-left">
                  <h3 className="text-base font-semibold text-gray-900 sm:text-lg">View limit reached</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    You've watched this video 5 times — the maximum for a single purchase. Contact{' '}
                    <a href="mailto:primrosewatson@gmail.com" className="text-royal-700 underline">
                      primrosewatson@gmail.com
                    </a>{' '}
                    if you'd like to keep watching.
                  </p>
                </div>
              )}

              {fullAccess.kind === 'error' && (
                <div className="text-center sm:text-left">
                  <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Something went wrong</h3>
                  <p className="mt-1 text-sm text-gray-600">{fullAccess.message}</p>
                </div>
              )}

              {fullAccess.kind === 'playing' && (
                <p className="text-sm text-gray-600">
                  You're watching the full video. Playback is counted toward your 5-view limit.
                </p>
              )}
            </div>

            {/* Meta footer */}
            <div className="border-t border-gray-200 p-4 sm:p-6">
              <div className="mb-2">
                <span className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700">
                  {selectedVideo.category}
                </span>
              </div>
              <p className="mb-4 text-sm text-gray-700 sm:text-base">{selectedVideo.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-600">Duration: {selectedVideo.duration}</span>
                <button
                  onClick={closeModal}
                  className="rounded-md bg-gray-200 px-5 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300"
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
