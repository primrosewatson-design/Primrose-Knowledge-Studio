// Edge Function: redeem-gift
//
// Deployed with verify_jwt=false at the gateway — recipient is an anonymous
// visitor who received a link from the purchaser. Access is gated entirely
// by the gift token, which is 192 bits of entropy (see create-gift for how
// it's minted).
//
// POST { token: string }
// Returns:
//   200 { video_url, video_title, recipient_name?, message? }
//   400 { error: "bad_request" }
//   403 { error: "already_redeemed" }
//   404 { error: "gift_not_found" | "video_not_available" }
//   500 { error: "internal" }
//
// Single-use: the gift starts at redeemed_views=0. The UPDATE below uses the
// `eq('redeemed_views', 0)` predicate as optimistic-concurrency — if two
// clients race to redeem, only one wins and the other sees "already_redeemed".

import { createClient } from 'npm:@supabase/supabase-js@^2'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: { token?: unknown } = {}
  try {
    body = (await req.json()) as { token?: unknown }
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const token = body.token
  if (!token || typeof token !== 'string') return json(400, { error: 'bad_request' })

  // Look up the gift with its joined video. PostgREST returns the FK join
  // either as a single object or an array depending on cardinality — we
  // normalise below.
  type GiftJoin = {
    id: string
    video_id: string
    redeemed_views: number
    recipient_name: string | null
    message: string | null
    videos: { title: string; video_url: string | null } | { title: string; video_url: string | null }[] | null
  }
  const { data: gift, error: giftErr } = await admin
    .from('video_gifts')
    .select(
      'id, video_id, redeemed_views, recipient_name, message, videos:video_id (title, video_url)',
    )
    .eq('token', token)
    .maybeSingle<GiftJoin>()

  if (giftErr) {
    console.error('redeem-gift lookup error:', giftErr)
    return json(500, { error: 'internal' })
  }
  if (!gift) return json(404, { error: 'gift_not_found' })

  if (gift.redeemed_views >= 1) {
    return json(403, { error: 'already_redeemed' })
  }

  const video = Array.isArray(gift.videos) ? gift.videos[0] : gift.videos
  if (!video || !video.video_url) return json(404, { error: 'video_not_available' })

  // Atomic bump via optimistic-concurrency: the eq('redeemed_views', 0)
  // predicate means only the first caller to land here actually mutates the
  // row. Any concurrent caller gets back an empty update set and we return
  // already_redeemed to them.
  const { data: updated, error: updErr } = await admin
    .from('video_gifts')
    .update({
      redeemed_views: 1,
      redeemed_at: new Date().toISOString(),
    })
    .eq('id', gift.id)
    .eq('redeemed_views', 0)
    .select('id')

  if (updErr) {
    console.error('redeem-gift update error:', updErr)
    return json(500, { error: 'internal' })
  }
  if (!updated || updated.length === 0) {
    return json(403, { error: 'already_redeemed' })
  }

  return json(200, {
    video_url: video.video_url,
    video_title: video.title,
    recipient_name: gift.recipient_name,
    message: gift.message,
  })
})
