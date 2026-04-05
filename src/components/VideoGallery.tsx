import { useState } from 'react'

interface Video {
  id: string
  title: string
  description: string
  thumbnail: string
  duration: string
  category: string[]
  videoUrl: string
}

const MOCK_VIDEOS: Video[] = [
  {
    id: '1',
    title: 'Getting Started with React',
    description: 'Learn the fundamentals of React and how to build your first component.',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324ef6be?w=400&h=225&fit=crop',
    duration: '12:45',
    category: ['React', 'Beginner'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: '2',
    title: 'Advanced TypeScript Patterns',
    description: 'Explore advanced TypeScript techniques to write more robust and type-safe code.',
    thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=225&fit=crop',
    duration: '28:30',
    category: ['TypeScript', 'Advanced'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: '3',
    title: 'Tailwind CSS Mastery',
    description: 'Master utility-first CSS with Tailwind and create stunning designs quickly.',
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=225&fit=crop',
    duration: '18:15',
    category: ['CSS', 'Design'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: '4',
    title: 'State Management with React Hooks',
    description: 'Understand useState, useEffect, and custom hooks for effective state management.',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06a6881c946?w=400&h=225&fit=crop',
    duration: '22:00',
    category: ['React', 'Intermediate'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: '5',
    title: 'Database Design Fundamentals',
    description: 'Learn best practices for designing scalable and efficient databases.',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-adf4198c8581?w=400&h=225&fit=crop',
    duration: '31:20',
    category: ['Database', 'Intermediate'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: '6',
    title: 'Web Performance Optimization',
    description: 'Techniques to optimize your web applications for speed and user experience.',
    thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=225&fit=crop',
    duration: '25:45',
    category: ['Performance', 'Advanced'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  }
]

const CATEGORIES = ['All', 'React', 'TypeScript', 'CSS', 'Design', 'Database', 'Performance', 'Beginner', 'Intermediate', 'Advanced']

export default function VideoGallery() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)

  const filteredVideos = MOCK_VIDEOS.filter(video => {
    const matchesCategory = selectedCategory === 'All' || video.category.includes(selectedCategory)
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          video.description.toLowerCase().includes(searchQuery.toLowerCase())
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
          {CATEGORIES.map(category => (
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

      {/* Video Grid */}
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
              {/* Duration Badge */}
              <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-sm text-white">
                {video.duration}
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-gray-900">
                {video.title}
              </h3>
              <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                {video.description}
              </p>

              {/* Category Tags */}
              <div className="flex flex-wrap gap-2">
                {video.category.map(cat => (
                  <span
                    key={cat}
                    className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Watch Button */}
              <button
                onClick={() => setSelectedVideo(video)}
                className="mt-4 w-full rounded-md bg-royal-600 py-2 text-center font-medium text-white transition-colors hover:bg-royal-700"
              >
                Watch Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredVideos.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">No videos found in this category.</p>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl">
            {/* Modal Header */}
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

            {/* Video Player */}
            <div className="relative bg-black">
              <iframe
                width="100%"
                height="500"
                src={selectedVideo.videoUrl}
                title={selectedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-96 w-full md:h-[500px]"
              />
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedVideo.category.map(cat => (
                  <span
                    key={cat}
                    className="inline-block rounded-full bg-royal-100 px-3 py-1 text-xs font-medium text-royal-700"
                  >
                    {cat}
                  </span>
                ))}
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
