// Edge Function: create-gift
//
// Deployed with verify_jwt=false at the gateway. Full JWT verification happens
// in-function (same approach as get-video-access — see that file's header for
// why). Caller must send a Bearer access token in the Authorization header.
//
// POST { video_id: string, recipient_email?: string, recipient_name?: string, message?: string }
// Returns:
//   200 { token, url, recipient_email, recipient_name, message, redeemed_at, redeemed_views, already_exists }
//   401 { error: "not_signed_in" }
//   402 { error: "not_purchased" }
//   400 { error: "bad_request" }
//   500 { error: "internal" }
//
// One gift per purchase (enforced by UNIQUE on video_gifts.purchase_id). If a
// gift already exists for this purchase, the same token is returned — the call
// is idempotent, which makes it safe to retry from the client.

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

let cachedJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null
function getJwks(supabaseUrl: string) {
  if (cachedJwks) return cachedJwks
  cachedJwks = jose.createRemoteJWKSet(
    new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`),
  )
  return cachedJwks
}

// Same two-strategy verification as get-video-access — HS256 first, JWKS fallback.
async function verifyJwt(
  jwt: string,
  supabaseUrl: string,
  hmacSecret: string | undefined,
): Promise<{ sub: string; email: string } | null> {
  const expectedIssuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
  const expectedAudience = 'authenticated'

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
    } catch {
      /* fall through */
    }
  }

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
  } catch {
    /* fall through */
  }

  return null
}

// 24 random bytes → 48-char hex token. Keeps URLs short-ish while giving us
// 192 bits of entropy (effectively unguessable in any realistic brute-force budget).
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')
  const siteUrl = Deno.env.get('SITE_URL') || ''
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

  let body: {
    video_id?: unknown
    recipient_email?: unknown
    recipient_name?: unknown
    message?: unknown
  } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const videoId = body.video_id
  if (!videoId || typeof videoId !== 'string') return json(400, { error: 'bad_request' })

  // Optional recipient details — purely metadata; the gift is tied to the
  // token, not the email. Anyone with the URL can redeem.
  const recipientEmail =
    typeof body.recipient_email === 'string' && body.recipient_email.trim()
      ? body.recipient_email.trim().slice(0, 320)
      : null
  const recipientName =
    typeof body.recipient_name === 'string' && body.recipient_name.trim()
      ? body.recipient_name.trim().slice(0, 120)
      : null
  const giftMessage =
    typeof body.message === 'string' && body.message.trim()
      ? body.message.trim().slice(0, 500)
      : null

  // Resolve the caller's purchase row for this video. Matches by user_id OR
  // email — same logic as get-video-access — so pre-auth Stripe purchases
  // still count. Unique-on-(user_id, video_id) means at most one row.
  type PurchaseRow = { id: string }
  const { data: purchases, error: purchaseErr } = await admin
    .from('purchases')
    .select('id')
    .eq('video_id', videoId)
    .is('refunded_at', null)
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .limit(1)
    .returns<PurchaseRow[]>()
  if (purchaseErr) return json(500, { error: 'internal' })
  if (!purchases || purchases.length === 0) return json(402, { error: 'not_purchased' })
  const purchaseId = purchases[0].id

  // Idempotency: if a gift already exists for this purchase, return it.
  type GiftRow = {
    token: string
    recipient_email: string | null
    recipient_name: string | null
    message: string | null
    redeemed_at: string | null
    redeemed_views: number
  }
  const { data: existing, error: existingErr } = await admin
    .from('video_gifts')
    .select('token, recipient_email, recipient_name, message, redeemed_at, redeemed_views')
    .eq('purchase_id', purchaseId)
    .maybeSingle<GiftRow>()
  if (existingErr) {
    console.error('create-gift existing lookup error:', existingErr)
    return json(500, { error: 'internal' })
  }

  if (existing) {
    return json(200, {
      token: existing.token,
      url: siteUrl
        ? `${siteUrl.replace(/\/$/, '')}/gift/${existing.token}`
        : `/gift/${existing.token}`,
      recipient_email: existing.recipient_email,
      recipient_name: existing.recipient_name,
      message: existing.message,
      redeemed_at: existing.redeemed_at,
      redeemed_views: existing.redeemed_views,
      already_exists: true,
    })
  }

  const token = generateToken()
  const { error: insErr } = await admin.from('video_gifts').insert({
    purchase_id: purchaseId,
    giver_user_id: userId,
    video_id: videoId,
    token,
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    message: giftMessage,
  })
  if (insErr) {
    console.error('create-gift insert error:', insErr)
    return json(500, { error: 'internal' })
  }

  return json(200, {
    token,
    url: siteUrl ? `${siteUrl.replace(/\/$/, '')}/gift/${token}` : `/gift/${token}`,
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    message: giftMessage,
    redeemed_at: null,
    redeemed_views: 0,
    already_exists: false,
  })
})
