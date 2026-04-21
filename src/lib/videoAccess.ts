import { supabase } from './supabase'

// Centralised wrapper around the `get-video-access` edge function.
//
// Why not use supabase.functions.invoke()?
// The invoke() helper is fine in principle, but its session/token handling has
// been the source of repeated 401 "missing sub claim" failures: whenever the
// in-memory session is null or stale, invoke() falls back to the anon key,
// which is a valid JWT but has no `sub` claim — so the edge function (with
// verify_jwt=true) rejects it. We side-step that entirely by:
//
//   1. Explicitly fetching the session with supabase.auth.getSession() (which
//      auto-refreshes the access token if it's about to expire).
//   2. Short-circuiting with { kind: 'not_signed_in' } if there's no session.
//   3. Calling the edge function with a plain fetch(), setting Authorization
//      and apikey headers ourselves so there is zero ambiguity about what JWT
//      reaches the gateway.
//
// This also dedupes the parsing/branching logic between Library.tsx and
// VideoGallery.tsx, which both need identical error taxonomies.

export type VideoAccessResult =
  | {
      kind: 'ok'
      video_url: string
      views_used: number
      views_remaining: number
    }
  | { kind: 'not_signed_in' }
  | { kind: 'not_purchased' }
  | { kind: 'view_limit_reached'; views_used?: number }
  | { kind: 'error'; message: string }

export async function requestVideoAccess(videoId: string): Promise<VideoAccessResult> {
  // Pull the freshest session we can. getSession() will transparently refresh
  // an expired access_token if autoRefreshToken is enabled (default).
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    return { kind: 'error', message: sessionError.message }
  }
  const session = sessionData.session
  if (!session?.access_token) {
    return { kind: 'not_signed_in' }
  }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
  if (!supabaseUrl || !anonKey) {
    return { kind: 'error', message: 'Supabase is not configured.' }
  }

  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/get-video-access`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // apikey is required by Supabase's gateway; Authorization carries the
        // user's access_token so verify_jwt=true receives a real user JWT.
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ video_id: videoId }),
    })
  } catch (err) {
    return { kind: 'error', message: (err as Error).message || 'Network error' }
  }

  let payload: { error?: string; video_url?: string; views_used?: number; views_remaining?: number } = {}
  try {
    payload = await response.json()
  } catch {
    /* ignore — some error paths return non-JSON */
  }

  if (!response.ok) {
    if (response.status === 401 || payload.error === 'not_signed_in') {
      return { kind: 'not_signed_in' }
    }
    if (payload.error === 'not_purchased') return { kind: 'not_purchased' }
    if (payload.error === 'view_limit_reached') {
      return { kind: 'view_limit_reached', views_used: payload.views_used }
    }
    return {
      kind: 'error',
      message: payload.error || `Request failed (${response.status})`,
    }
  }

  if (!payload.video_url || typeof payload.views_used !== 'number' || typeof payload.views_remaining !== 'number') {
    return { kind: 'error', message: 'Unexpected response from server.' }
  }

  return {
    kind: 'ok',
    video_url: payload.video_url,
    views_used: payload.views_used,
    views_remaining: payload.views_remaining,
  }
}
