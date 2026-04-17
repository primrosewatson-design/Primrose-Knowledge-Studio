import { Link } from 'react-router-dom'

export default function CheckoutCancel() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg bg-amber-50 p-8 text-center">
        <div className="mb-4 text-6xl">↩️</div>
        <h1 className="mb-2 text-3xl font-bold text-amber-700">Checkout Cancelled</h1>
        <p className="mb-6 text-gray-700">
          No charge was made. Your cart is still saved — you can return to checkout any time.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/how-to-pay"
            className="inline-block rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
          >
            Return to Cart
          </Link>
          <Link
            to="/how-to-choose"
            className="inline-block rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50"
          >
            Browse Videos
          </Link>
        </div>
      </div>
    </div>
  )
}
