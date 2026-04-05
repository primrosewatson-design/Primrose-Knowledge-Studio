import { Link } from 'react-router-dom'

const features = [
  {
    title: 'How to View',
    description: 'Learn how to watch and navigate through our knowledge videos.',
    to: '/how-to-view',
  },
  {
    title: 'How to Choose',
    description: 'Find the right videos for your learning goals.',
    to: '/how-to-choose',
  },
  {
    title: 'How to Get',
    description: 'Purchase and access the knowledge you need.',
    to: '/how-to-get',
  },
]

export default function Home() {
  return (
    <div>
      <section className="bg-royal-500 px-4 py-20 text-center text-white">
        <h1 className="mb-4 text-4xl font-bold md:text-5xl">
          Knowledge, Made Accessible
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-royal-100">
          Expert knowledge videos from Primrose Watson, crafted to help you
          understand, choose, and take action.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.to}
              to={feature.to}
              className="rounded-xl border border-royal-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="mb-2 text-xl font-semibold text-royal-700">
                {feature.title}
              </h2>
              <p className="text-gray-600">{feature.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
