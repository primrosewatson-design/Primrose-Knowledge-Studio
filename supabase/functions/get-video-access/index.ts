// Edge Function: get-video-access
//
// Deployed with verify_jwt=false at the gateway. We do the full JWT check
// (signature + issuer + audience + expiry) inside the function using `jose`.
// That split exists because the gateway-level verify_jwt=true was rejecting
// otherwise-valid access tokens in production — shifting the check in-function
// lets us log and respond consistently without relying on the opaque gateway.
//
// POST { video_id: string }
// Returns:
//   200 { video_url, views_used, views_remaining }   — access granted, view counted
//   401 { error: "not_signed_in" }                   — no / invalid JWT
//   402 { error: "not_purchased" }                   — signed in but hasn't bought this video
//   400 { error: "bad_request" }                     — missing/invalid video_id
//   404 { error: "video_not_found" | "video_not_available" }
//   500 { error: "internal" }
//
// Note: the 5-view cap has been removed. Purchasers now have unlimited views
// on the original purchase; the single-share flow lives in the separate
// `create-gift` / `redeem-gift` functions. We still bump `video_views.view_count`
// for analytics (lets us see how often a given purchase is re-watched).

import { createClient } from 'npm:@supabase/supabase-js@^2'
import * as jose from 'npm:jose@^5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Cache the JWKS fetcher per cold-start. jose handles the internal key cache
// + rotation; we just need to avoid re-creating the fetcher per request.
let cachedJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null
function getJwks(supabaseUrl: string) {
  if (cachedJwks) return cachedJwks
  cachedJwks = jose.createRemoteJWKSet(
    new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`),
  )
  return cachedJwks
}

// Verify signature + claims on a Supabase access token. Strategy:
//   1. HS256 via SUPABASE_JWT_SECRET — default/legacy signing mode, works for
//      virtually every Supabase project.
//   2. JWKS fallback (RS256/ES256) for projects using asymmetric signing.
// Returns null on any failure — signature mismatch, wrong issuer/audience,
// expired token, missing sub claim, malformed JWT, etc.
async function verifyJwt(
  jwt: string,
  supabaseUrl: string,
  hmacSecret: string | undefined,
): Promise<{ sub: string; email: string } | null> {
  const expectedIssuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
  const expectedAudience = 'authenticated'

  // 1) HS256
  if (hmacSecret) {
    try {
      const key = new TextEncoder().encode(hmacSecret)
      const { payload } = await jose.jwtVerify(jwt, key, {
        issuer: expectedIssuer,
        audience: expectedAudience,
      })
      if (typeof payload.sub === 'string' && payload.sub) {
        const emailClaim = typeof payload.email === 'string' ? payload.email : ''
        return { sub: payload.sub, email: emailClaim.toLowerCase() }
      }
    } catch (err) {
      // Fall through to JWKS. A failed HS256 verify is expected for
      // projects that opted into asymmetric signing.
      console.log('get-video-access: HS256 verify failed, trying JWKS:', (err as Error).message)
    }
  }

  // 2) JWKS
  try {
    const jwks = getJwks(supabaseUrl)
    const { payload } = await jose.jwtVerify(jwt, jwks, {
      issuer: expectedIssuer,
      audience: expectedAudience,
    })
    if (typeof payload.sub === 'string' && payload.sub) {
      const emailClaim = typeof payload.email === 'string' ? payload.email : ''
      return { sub: payload.sub, email: emailClaim.toLowerCase() }
    }
  } catch (err) {
    console.warn('get-video-access: JWKS verify failed:', (err as Error).message)
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json(401, { error: 'not_signed_in' })

  const claims = await verifyJwt(jwt, url, jwtSecret)
  if (!claims) return json(401, { error: 'not_signed_in' })
  const userId = claims.sub
  const email = claims.email

  // Parse body
  let body: { video_id?: unknown } = {}
  try {
    body = (await req.json()) as { video_id?: unknown }
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const videoId = body.video_id
  if (!videoId || typeof videoId !== 'string') return json(400, { error: 'bad_request' })

  // Look up the video including video_url (service_role can read it).
  const { data: video, error: videoErr } = await admin
    .from('videos')
    .select('id, video_url')
    .eq('id', videoId)
    .maybeSingle()
  if (videoErr) return json(500, { error: 'internal' })
  if (!video) return json(404, { error: 'video_not_found' })
  if (!video.video_url) return json(404, { error: 'video_not_available' })

  // Check purchase. Match by user_id OR email (covers pre-auth purchases).
  // Refunded purchases (refunded_at IS NOT NULL) are excluded — charge.refunded
  // webhook stamps that column, so playback is revoked the moment Stripe processes the refund.
  type PurchaseRow = {
    id: string
    user_id: string | null
    email: string | null
    refunded_at: string | null
  }
  const { data: purchases, error: purchaseErr } = await admin
    .from('purchases')
    .select('id, user_id, email, refunded_at')
    .eq('video_id', videoId)
    .is('refunded_at', null)
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .returns<PurchaseRow[]>()
  if (purchaseErr) return json(500, { error: 'internal' })
  if (!purchases || purchases.length === 0) return json(402, { error: 'not_purchased' })

  // Opportunistically backfill user_id on email-matched rows.
  const orphanIds = purchases
    .filter((p) => !p.user_id && p.email && p.email.toLowerCase() === email)
    .map((p) => p.id)
  if (orphanIds.length > 0) {
    await admin.from('purchases').update({ user_id: userId }).in('id', orphanIds)
  }

  // Track views for analytics — no cap, unlimited replays for purchasers.
  const { data: existingView } = await admin
    .from('video_views')
    .select('id, view_count')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .maybeSingle()

  const currentCount = existingView?.view_count ?? 0
  const nextCount = currentCount + 1

  if (existingView) {
    const { error: updErr } = await admin
      .from('video_views')
      .update({ view_count: nextCount, last_viewed_at: new Date().toISOString() })
      .eq('id', existingView.id)
    if (updErr) return json(500, { error: 'internal' })
  } else {
    const { error: insErr } = await admin.from('video_views').insert({
      user_id: userId,
      video_id: videoId,
      view_count: nextCount,
      last_viewed_at: new Date().toISOString(),
    })
    if (insErr) return json(500, { error: 'internal' })
  }

  // views_remaining kept in the response shape for backwards-compat with the
  // client wrapper, but the purchaser now has unlimited views — surface a
  // large sentinel so the client never shows a "view limit reached" state.
  return json(200, {
    video_url: video.video_url,
    views_used: nextCount,
    views_remaining: Number.MAX_SAFE_INTEGER,
  })
})
