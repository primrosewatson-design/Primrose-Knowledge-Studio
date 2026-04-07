import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Video {
  id: string
  title: string
  description: string
  thumbnail: string
  duration: string
  category: string
  video_url: string
  price: number
}

export default function VideoGallery() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)

  useEffect(() => {
    async function fetchVideos() {
      const { data, error } = await supabase.from('videos').select('*').order('created_at')
      if (error) {
        setError('Failed to load videos.')
      } else {
        setVideos(data || [])
      }
      setLoading(false)
    }
    fetchVideos()
  }, [])

  const categories = ['All', ...Array.from(new Set(videos.map(v => v.category).filter(Boolean)))]

  const filteredVideos = videos.filter(video => {
    const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
          {categories.map(category => (
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
          {filteredVideos.map(video => (
            <div
              key={video.id}
              className="overflow-hidden rounded-lg bg-white shadow-md transition-transform hover:scale-105 hover:shadow-lg"
            >
              {/* Thumbnail */}
              <div className="relative h-40 overflow-hidden bg-gray-200">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-sm text-white">
                  {video.duration}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-gray-900">
                  {video.title}
                </h3>
                <p className="mb-3 line-clamp-2 text-sm text-gray-600">
                  {video.description}
                </p>

                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700">
                    {video.category}
                  </span>
                  <span className="font-semibold text-gray-900">${video.price}</span>
                </div>

                <button
                  onClick={() => setSelectedVideo(video)}
                  className="w-full rounded-md bg-royal-600 py-2 text-center font-medium text-white transition-colors hover:bg-royal-700"
                >
                  Watch Now
                </button>
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

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900">{selectedVideo.title}</h2>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-gray-500 transition-colors hover:text-gray-700"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="relative bg-black">
              <iframe
                width="100%"
                height="500"
                src={selectedVideo.video_url}
                title={selectedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-96 w-full md:h-[500px]"
              />
            </div>

            <div className="p-6">
              <div className="mb-4">
                <span className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700">
                  {selectedVideo.category}
                </span>
              </div>
              <p className="mb-4 text-gray-700">{selectedVideo.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Duration: {selectedVideo.duration}</span>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="rounded-md bg-gray-200 px-6 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
