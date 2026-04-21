import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

// Auth context + hook live here (separate from the AuthProvider component)
// so that src/lib/auth.tsx only exports a component. That lets Vite's
// react-refresh HMR hot-swap the provider in isolation — mixing
// non-component exports in a .tsx file forces full reloads and trips
// the react-refresh/only-export-components lint rule.

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
