// Cart state is held in localStorage for UI instancy — getCart() stays
// synchronous so components can render without flicker. When a user is
// signed in, AuthProvider mirrors local changes to the `cart_items`
// Supabase table and merges server state into local on sign-in, so the
// cart follows the user across devices.
//
// Stores only video IDs — display data is fetched from Supabase at render time.

import { supabase } from './supabase'

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

/**
 * Merge the local cart with the server's cart for this user. Union semantics:
 * items found locally that aren't on the server get pushed up; items on the
 * server but not local get pulled down. After this returns, local and server
 * both hold the full union.
 *
 * Returns the merged cart so callers can decide whether to fire a change event.
 */
export async function syncCartWithServer(userId: string): Promise<string[]> {
  const local = new Set(getCart())

  const { data, error } = await supabase
    .from('cart_items')
    .select('video_id')
    .eq('user_id', userId)
  if (error) {
    // Non-fatal: keep local state, log for visibility.
    console.warn('[cart] failed to fetch server cart:', error.message)
    return [...local]
  }

  const remote = new Set((data ?? []).map((r) => r.video_id as string))
  const union = new Set([...local, ...remote])

  // Push any local-only items to the server.
  const toInsert = [...local].filter((id) => !remote.has(id))
  if (toInsert.length > 0) {
    const rows = toInsert.map((video_id) => ({ user_id: userId, video_id }))
    const { error: insertErr } = await supabase
      .from('cart_items')
      .upsert(rows, { onConflict: 'user_id,video_id', ignoreDuplicates: true })
    if (insertErr) {
      console.warn('[cart] failed to push local items to server:', insertErr.message)
    }
  }

  const merged = [...union]
  writeCart(merged)
  return merged
}

/**
 * Apply an add/remove delta to the server cart. Idempotent via upsert and
 * `.in()` delete — safe to call even when the server is already in sync.
 */
export async function mirrorCartDeltaToServer(
  userId: string,
  previous: string[],
  next: string[],
): Promise<void> {
  const prev = new Set(previous)
  const curr = new Set(next)
  const toInsert = [...curr].filter((id) => !prev.has(id))
  const toDelete = [...prev].filter((id) => !curr.has(id))

  if (toInsert.length > 0) {
    const rows = toInsert.map((video_id) => ({ user_id: userId, video_id }))
    const { error } = await supabase
      .from('cart_items')
      .upsert(rows, { onConflict: 'user_id,video_id', ignoreDuplicates: true })
    if (error) console.warn('[cart] server insert failed:', error.message)
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
      .in('video_id', toDelete)
    if (error) console.warn('[cart] server delete failed:', error.message)
  }
}

