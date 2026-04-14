import VideoGallery from '../components/VideoGallery'

export default function HowToChoose() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold text-royal-700">How to Choose</h1>
      <p className="mb-10 text-lg text-gray-600">
        Find the right videos for your learning goals. Browse the collection by category or topic.
      </p>
      <VideoGallery />
    </div>
  )
}
