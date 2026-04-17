import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { clearCart } from '../lib/cart'

export default function CheckoutSuccess() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')

  // Clear cart on successful return from Stripe — the webhook records the purchase server-side.
  useEffect(() => {
    clearCart()
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg bg-green-50 p-8 text-center">
        <div className="mb-4 text-6xl">✅</div>
        <h1 className="mb-2 text-3xl font-bold text-green-700">Payment Successful!</h1>
        <p className="mb-6 text-gray-700">
          Thank you for your purchase. A receipt has been sent to your email.
        </p>
        {sessionId && (
          <div className="mb-6 rounded-lg bg-white p-4">
            <p className="text-xs text-gray-500">Stripe session</p>
            <p className="break-all font-mono text-xs text-gray-700">{sessionId}</p>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-gray-700">
            Your videos are now associated with your email and ready to watch.
          </p>
          <p className="text-sm text-gray-600">
            Each purchased video can be viewed up to 5 times.
          </p>
        </div>
        <Link
          to="/how-to-choose"
          className="mt-8 inline-block rounded-lg bg-royal-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
        >
          Continue Browsing
        </Link>
      </div>
    </div>
  )
}
