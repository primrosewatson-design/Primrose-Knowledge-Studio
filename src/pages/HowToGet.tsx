import { useState } from 'react'

interface CartItem {
  id: string
  title: string
  price: number
  category: string
}

interface CheckoutForm {
  email: string
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zipCode: string
  cardNumber: string
  expiryDate: string
  cvv: string
}

const MOCK_CART_ITEMS: CartItem[] = [
  {
    id: '1',
    title: 'Getting Started with React',
    price: 29.99,
    category: 'React'
  },
  {
    id: '4',
    title: 'State Management with React Hooks',
    price: 39.99,
    category: 'React'
  },
  {
    id: '3',
    title: 'Tailwind CSS Mastery',
    price: 24.99,
    category: 'CSS'
  }
]

export default function HowToGet() {
  const [cartItems, setCartItems] = useState<CartItem[]>(MOCK_CART_ITEMS)
  const [showCheckout, setShowCheckout] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [form, setForm] = useState<CheckoutForm>({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  })
  const [orderComplete, setOrderComplete] = useState(false)

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0)
  const tax = subtotal * 0.08
  const total = subtotal + tax

  const removeFromCart = (id: string) => {
    setCartItems(cartItems.filter(item => item.id !== id))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false)
      setOrderComplete(true)
      setShowCheckout(false)
    }, 2000)
  }

  if (orderComplete) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-green-50 p-8 text-center">
          <div className="mb-4 text-6xl">✅</div>
          <h1 className="mb-2 text-3xl font-bold text-green-700">Order Complete!</h1>
          <p className="mb-6 text-gray-700">
            Thank you for your purchase! A confirmation email has been sent to {form.email}
          </p>
          <div className="mb-6 rounded-lg bg-white p-4">
            <p className="mb-2 text-sm text-gray-600">Order ID: #{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            <p className="font-bold text-gray-900">Amount Paid: ${total.toFixed(2)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-gray-700">
              Your videos are now available in your library. You can start watching immediately!
            </p>
            <p className="text-sm text-gray-600">
              Check your email for access instructions and your receipt.
            </p>
          </div>
          <button
            onClick={() => {
              setOrderComplete(false)
              setCartItems(MOCK_CART_ITEMS)
              setForm({
                email: '',
                firstName: '',
                lastName: '',
                address: '',
                city: '',
                state: '',
                zipCode: '',
                cardNumber: '',
                expiryDate: '',
                cvv: ''
              })
            }}
            className="mt-8 rounded-lg bg-royal-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="mb-2 text-4xl font-bold text-royal-700">How to Get</h1>
      <p className="mb-12 text-lg text-gray-600">
        Complete your purchase and gain instant access to your selected videos.
      </p>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">Shopping Cart</h2>

            {cartItems.length === 0 ? (
              <p className="text-center text-gray-600">Your cart is empty</p>
            ) : (
              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-gray-900">${item.price.toFixed(2)}</span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-600 transition-colors hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Form */}
          {showCheckout && (
            <div className="mt-8 rounded-lg border-2 border-royal-200 bg-white p-6">
              <h2 className="mb-6 text-2xl font-bold text-gray-900">Billing Information</h2>
              <form onSubmit={handleSubmitOrder} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleInputChange}
                    required
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </div>

                {/* Name */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleInputChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleInputChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Street Address</label>
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleInputChange}
                    required
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                  />
                </div>

                {/* City, State, Zip */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900">City</label>
                    <input
                      type="text"
                      name="city"
                      value={form.city}
                      onChange={handleInputChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900">State</label>
                    <input
                      type="text"
                      name="state"
                      value={form.state}
                      onChange={handleInputChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900">Zip Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={form.zipCode}
                      onChange={handleInputChange}
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Payment Information */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="mb-4 font-semibold text-gray-900">Payment Information</h3>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900">Card Number</label>
                    <input
                      type="text"
                      name="cardNumber"
                      value={form.cardNumber}
                      onChange={handleInputChange}
                      required
                      placeholder="1234 5678 9012 3456"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900">Expiry Date</label>
                      <input
                        type="text"
                        name="expiryDate"
                        value={form.expiryDate}
                        onChange={handleInputChange}
                        required
                        placeholder="MM/YY"
                        className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900">CVV</label>
                      <input
                        type="text"
                        name="cvv"
                        value={form.cvv}
                        onChange={handleInputChange}
                        required
                        placeholder="123"
                        className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-royal-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Stripe Notice */}
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-gray-700">
                    💳 Your payment is securely processed by <strong>Stripe</strong>. Your card information is never stored on our servers.
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                  >
                    {isProcessing ? 'Processing...' : `Pay $${total.toFixed(2)}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCheckout(false)}
                    className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="h-fit rounded-lg border-2 border-gray-200 bg-white p-6">
          <h2 className="mb-6 text-xl font-bold text-gray-900">Order Summary</h2>

          <div className="mb-6 space-y-3 border-b border-gray-200 pb-6">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal ({cartItems.length} items)</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Tax (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
          </div>

          <div className="mb-6 flex justify-between">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-royal-700">${total.toFixed(2)}</span>
          </div>

          {cartItems.length > 0 && (
            <button
              onClick={() => setShowCheckout(!showCheckout)}
              className="w-full rounded-lg bg-royal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-royal-700"
            >
              {showCheckout ? 'Hide Checkout' : 'Proceed to Checkout'}
            </button>
          )}

          {cartItems.length === 0 && (
            <a
              href="/how-to-choose"
              className="block w-full rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-gray-700"
            >
              Browse Videos
            </a>
          )}

          {/* Trust Signals */}
          <div className="mt-6 space-y-3 border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>🔒</span> Secure Stripe payment
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>📧</span> Instant access via email
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>🎯</span> 5 views per video
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
