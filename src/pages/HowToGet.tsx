import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCart, removeFromCart, subscribeToCart } from '../lib/cart'

interface Video {
  id: string
  title: string
  description: string | null
  category: string | null
  price: number
  thumbnail: string | null
  duration: string | null
  stripe_price_id: string | null
}

export default function HowToGet() {
  const [cartIds, setCartIds] = useState<string[]>(() => getCart())
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => subscribeToCart(() => setCartIds(getCart())), [])

  useEffect(() => {
    async function fetchVideos() {
      if (cartIds.length === 0) {
        setVideos([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, category, price, thumbnail, duration, stripe_price_id')
        .in('id', cartIds)
      if (!error) setVideos(data || [])
      setLoading(false)
    }
    fetchVideos()
  }, [cartIds])

  const cartItems = videos.filter((v) => cartIds.includes(v.id))
  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price), 0)

  const handleCheckout = async () => {
    setCheckoutError(null)
    setIsProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          video_ids: cartIds,
          origin: window.location.origin,
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error('No checkout URL returned')
      window.location.href = data.url
    } catch (err) {
      console.error(err)
      setCheckoutError((err as Error).message || 'Could not start checkout. Please try again.')
      setIsProcessing(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="mb-2 text-4xl font-bold text-royal-700">How to Pay</h1>
      <p className="mb-12 text-lg text-gray-600">
        Review your selections and complete your purchase securely through Stripe.
      </p>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">Shopping Cart</h2>

            {loading ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-4 border-royal-600 border-t-transparent"></div>
                <p className="text-sm text-gray-600">Loading…</p>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="py-8 text-center">
                <p className="mb-4 text-gray-600">Your cart is empty</p>
                <Link
                  to="/how-to-choose"
                  className="inline-block rounded-lg bg-royal-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
                >
                  Browse Videos
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 border-b border-gray-200 pb-4 last:border-b-0">
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        width="96"
                        height="64"
                        className="h-16 w-24 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      {item.category && <p className="text-sm text-gray-600">{item.category}</p>}
                      {!item.stripe_price_id && (
                        <p className="mt-1 text-xs text-amber-600">
                          ⚠ Not yet available for purchase
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-gray-900">${Number(item.price).toFixed(2)}</span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-sm text-red-600 transition-colors hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="h-fit rounded-lg border-2 border-gray-200 bg-white p-6">
          <h2 className="mb-6 text-xl font-bold text-gray-900">Order Summary</h2>

          <div className="mb-6 space-y-3 border-b border-gray-200 pb-6">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal ({cartItems.length} {cartItems.length === 1 ? 'video' : 'videos'})</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500">Taxes calculated at checkout</p>
          </div>

          <div className="mb-6 flex justify-between">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-royal-700">${subtotal.toFixed(2)}</span>
          </div>

          {checkoutError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{checkoutError}</div>
          )}

          {cartItems.length > 0 ? (
            <button
              onClick={handleCheckout}
              disabled={isProcessing || cartItems.some((i) => !i.stripe_price_id)}
              className="w-full rounded-lg bg-gradient-to-r from-gradient-coral to-gradient-amber px-6 py-3 font-semibold text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {isProcessing ? 'Redirecting to Stripe…' : 'Proceed to Checkout'}
            </button>
          ) : (
            <Link
              to="/how-to-choose"
              className="block w-full rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-gray-700"
            >
              Browse Videos
            </Link>
          )}

          <div className="mt-6 space-y-3 border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>🔒</span> Secure payment via Stripe
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>📧</span> Access sent to your email
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>🎯</span> 5 views per purchased video
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
