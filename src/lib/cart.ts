// Minimal cart persisted to localStorage.
// Stores only video IDs — display data is fetched from Supabase at render time.

const STORAGE_KEY = 'pks.cart.v1'
const EVENT_NAME = 'pks:cart-change'

export function getCart(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function addToCart(videoId: string): string[] {
  const cart = getCart()
  if (!cart.includes(videoId)) cart.push(videoId)
  writeCart(cart)
  return cart
}

export function removeFromCart(videoId: string): string[] {
  const cart = getCart().filter((id) => id !== videoId)
  writeCart(cart)
  return cart
}

export function clearCart(): void {
  writeCart([])
}

function writeCart(cart: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function subscribeToCart(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT_NAME, cb)
    window.removeEventListener('storage', cb)
  }
}
