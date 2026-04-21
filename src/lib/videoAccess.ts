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

// Single POST to the edge function. Returned as a tuple so the caller can
// distinguish a network-level failure (no Response object) from an HTTP-level
// failure we can retry on.
async function postGetVideoAccess(
  videoId: string,
  accessToken: string,
): Promise<{ response: Response } | { networkError: string }> {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
  if (!supabaseUrl || !anonKey) {
    return { networkError: 'Supabase is not configured.' }
  }
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/get-video-access`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ video_id: videoId }),
    })
    return { response }
  } catch (err) {
    return { networkError: (err as Error).message || 'Network error' }
  }
}

export async function requestVideoAccess(videoId: string): Promise<VideoAccessResult> {
  // Pull the freshest session we can. getSession() will transparently refresh
  // an expired access_token if autoRefreshToken is enabled (default).
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    return { kind: 'error', message: sessionError.message }
  }
  let accessToken = sessionData.session?.access_token
  if (!accessToken) {
    return { kind: 'not_signed_in' }
  }

  // First attempt
  let attempt = await postGetVideoAccess(videoId, accessToken)
  if ('networkError' in attempt) {
    return { kind: 'error', message: attempt.networkError }
  }

  // On 401, the token may have just gone stale between getSession() and this
  // POST (tiny window, but real). Force a refresh and retry once before
  // giving up — that way a signed-in user who hits a transient auth blip
  // doesn't get kicked back to a sign-in prompt.
  if (attempt.response.status === 401) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
    if (!refreshErr && refreshed.session?.access_token && refreshed.session.access_token !== accessToken) {
      accessToken = refreshed.session.access_token
      const retry = await postGetVideoAccess(videoId, accessToken)
      if ('networkError' in retry) {
        return { kind: 'error', message: retry.networkError }
      }
      attempt = retry
    }
  }

  const response = attempt.response
  let payload: { error?: string; video_url?: string; views_used?: number; views_remaining?: number } = {}
  try {
    payload = await response.json()
  } catch {
    /* ignore — some error paths return non-JSON */
  }

  if (!response.ok) {
    if (payload.error === 'not_purchased') return { kind: 'not_purchased' }
    if (payload.error === 'view_limit_reached') {
      return { kind: 'view_limit_reached', views_used: payload.views_used }
    }
    // Note: we intentionally do NOT return { kind: 'not_signed_in' } on 401
    // anymore. The caller is already rendering a signed-in view (Library
    // only mounts the watch button when auth.user exists), so kicking the
    // user back to a sign-in modal after a transient 401 just forces
    // pointless re-auth loops. Surface a retryable error instead.
    if (response.status === 401 || payload.error === 'not_signed_in') {
      return {
        kind: 'error',
        message:
          "We couldn't verify your access just now. Please refresh the page and try again.",
      }
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
