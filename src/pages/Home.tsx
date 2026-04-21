import { Link } from 'react-router-dom'

const features = [
  {
    title: 'How to View',
    description: 'Learn how to watch and navigate through our knowledge videos.',
    to: '/how-to-view',
    icon: '▶️',
    color: 'bg-blue-50'
  },
  {
    title: 'How to Choose',
    description: 'Find the right videos for your learning goals.',
    to: '/how-to-choose',
    icon: '🎬',
    color: 'bg-royal-50'
  },
  {
    title: 'How to Pay',
    description: 'Purchase and access the knowledge you need.',
    to: '/how-to-pay',
    icon: '💳',
    color: 'bg-green-50'
  },
]

const stats = [
  { number: '50+', label: 'Videos' },
  { number: '5', label: 'Views Per Video' },
  { number: '100%', label: 'Satisfaction' },
]

const testimonials = [
  {
    text: 'Life-changing content that actually makes sense. Worth every penny!',
    author: 'Alex M.'
  },
  {
    text: 'Finally, learning made simple and accessible. Highly recommended!',
    author: 'Jordan K.'
  },
  {
    text: 'Best investment I made in my learning journey.',
    author: 'Sam T.'
  },
]

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gradient-indigo to-gradient-violet px-4 py-24 text-center text-white md:py-32">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-5 h-32 w-32 rounded-full bg-white/5 blur-3xl"></div>
          <div className="absolute bottom-10 right-5 h-40 w-40 rounded-full bg-white/5 blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <div className="mb-6 inline-block">
            <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              ✨ Welcome to Primrose Knowledge Studio
            </span>
          </div>

          <h1 className="mb-6 text-5xl font-bold md:text-6xl leading-tight">
            Knowledge, Made <br /> <span className="bg-gradient-to-r from-blue-200 to-white bg-clip-text text-transparent">Accessible</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-royal-100">
            Knowledge videos from <Link to="/about" className="underline decoration-2 underline-offset-2 hover:text-white transition-colors">Primrose Watson</Link>, curated to help you understand and learn at your own pace.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/how-to-choose"
              className="inline-block rounded-lg bg-white px-8 py-3 font-semibold text-royal-700 transition-all hover:scale-105 hover:shadow-xl"
            >
              Explore Videos →
            </Link>
            <Link
              to="/how-to-view"
              className="inline-block rounded-lg border-2 border-white bg-transparent px-8 py-3 font-semibold text-white transition-all hover:bg-white/10"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {stats.map((stat, idx) => (
            <div key={idx} className="rounded-lg bg-gradient-to-br from-royal-50 to-white p-8 text-center shadow-sm">
              <div className="mb-2 text-4xl font-bold text-royal-700">{stat.number}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold text-gray-900">Get Started in 3 Steps</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-gray-600">
          A simple process to find, purchase, and enjoy Primrose Watson's content
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, idx) => (
            <Link
              key={feature.to}
              to={feature.to}
              className={`group flex gap-4 rounded-lg p-6 transition-shadow hover:shadow-md ${feature.color}`}
            >
              {/* Step Number badge */}
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-violet font-bold text-white">
                {idx + 1}
              </span>
              <div className="flex flex-1 flex-col">
                <h3 className="mb-1 font-bold text-gray-900 transition-colors group-hover:text-gradient-violet">
                  <span className="mr-2" aria-hidden="true">{feature.icon}</span>
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-700">{feature.description}</p>
                {/* Arrow indicator — rose-700 picked over the coral gradient token
                    because the latter (#f43f5e) only hits ~3.3:1 on the pastel
                    card backgrounds, failing WCAG AA for normal text. */}
                <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-rose-700 transition-transform group-hover:translate-x-1">
                  Explore <span aria-hidden="true">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features Highlight */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">Why Choose Primrose Knowledge Studio?</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex gap-4 rounded-lg bg-blue-50 p-6">
            <span className="text-2xl">🎓</span>
            <div>
              <h3 className="font-bold text-gray-900">Curated Content</h3>
              <p className="text-sm text-gray-700">Carefully curated videos from Primrose Watson</p>
            </div>
          </div>
          <div className="flex gap-4 rounded-lg bg-green-50 p-6">
            <span className="text-2xl">⏰</span>
            <div>
              <h3 className="font-bold text-gray-900">Learn at Your Pace</h3>
              <p className="text-sm text-gray-700">Watch anytime, anywhere, on any device</p>
            </div>
          </div>
          <div className="flex gap-4 rounded-lg bg-royal-50 p-6">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="font-bold text-gray-900">5 Views Per Video</h3>
              <p className="text-sm text-gray-700">Watch up to 5 times per purchased video</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">What Viewers Say</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-4 text-yellow-400 text-lg">★ ★ ★ ★ ★</div>
              <p className="mb-4 text-gray-700 italic">"{testimonial.text}"</p>
              <p className="font-semibold text-gray-900">— {testimonial.author}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl bg-gradient-to-r from-gradient-coral to-gradient-amber p-12 text-center text-white">
          <h2 className="mb-4 text-3xl font-bold">Ready to Transform Your Learning?</h2>
          <p className="mb-8 text-lg text-royal-100">
            Start exploring Primrose Watson's curated video collection today
          </p>
          <Link
            to="/how-to-choose"
            className="inline-block rounded-lg bg-white px-8 py-3 font-semibold text-royal-700 transition-all hover:scale-105 hover:shadow-xl"
          >
            Start Exploring Now
          </Link>
        </div>
      </section>
    </div>
  )
}
