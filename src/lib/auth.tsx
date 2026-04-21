import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  clearCart,
  getCart,
  mirrorCartDeltaToServer,
  subscribeToCart,
  syncCartWithServer,
} from './cart'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // When a user signs in, reconcile their local cart with the server cart
  // (union merge), then mirror any subsequent local mutations up. On
  // sign-out we stop mirroring but leave local cart untouched so a user
  // signing back in gets the same items.
  const userId = session?.user?.id
  // Track the last-mirrored snapshot so we can compute precise deltas on
  // each subscribeToCart fire, avoiding full cart rewrites.
  const prevCartRef = useRef<string[]>([])
  // Gate on mirror writes so we can disable them during sign-out (we want
  // to clear the local cart but NOT wipe the server cart — the server cart
  // is the user's cross-device store and gets repopulated on next sign-in).
  const mirrorEnabledRef = useRef(false)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    ;(async () => {
      const merged = await syncCartWithServer(userId)
      if (cancelled) return
      prevCartRef.current = merged

      // Only start mirroring AFTER the initial sync completes — otherwise
      // the writeCart() inside syncCartWithServer would retrigger a server
      // push of items we just pulled down.
      mirrorEnabledRef.current = true
      unsubscribe = subscribeToCart(() => {
        if (!mirrorEnabledRef.current) return
        const curr = getCart()
        const prev = prevCartRef.current
        prevCartRef.current = curr
        // Fire and forget — errors surface via console.warn.
        mirrorCartDeltaToServer(userId, prev, curr)
      })
    })()

    return () => {
      cancelled = true
      mirrorEnabledRef.current = false
      if (unsubscribe) unsubscribe()
    }
  }, [userId])

  const signInWithEmail: AuthContextValue['signInWithEmail'] = async (email) => {
    // Magic-link redirect target. VITE_SITE_URL is the stable public origin
    // (e.g. https://primroseknowledgestudio.com). We fall back to the current
    // origin only in dev — otherwise the link baked into the email would point
    // at whatever origin the user happened to be on when they clicked "Send",
    // which for localhost means ERR_CONNECTION_REFUSED the moment the link is
    // opened from a phone, another browser, or after the dev server stops.
    const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    })
    return { error: error ? error.message : null }
  }

  // Verify a 6-digit OTP code from an existing magic-link email. Every email
  // sent via signInWithOtp embeds both a link and a numeric code; verifying
  // the code here lets a user complete sign-in even when they're currently
  // rate-limited on email sends (Supabase default: 1/60s per address), or
  // when the magic link got broken by an email client rewrite.
  const verifyEmailOtp: AuthContextValue['verifyEmailOtp'] = async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email',
    })
    return { error: error ? error.message : null }
  }

  const signOut = async () => {
    // Disable the server mirror BEFORE clearing the cart, so the clear
    // affects only localStorage. Server cart is kept intact — when this
    // user signs back in, syncCartWithServer pulls it down again.
    mirrorEnabledRef.current = false
    clearCart()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signInWithEmail, verifyEmailOtp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
