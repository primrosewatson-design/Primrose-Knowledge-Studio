// deno-lint-ignore-file no-explicit-any
// Edge Function: get-video-access
// Deploy with verify_jwt=true — caller must send a valid Supabase Auth JWT.
//
// POST { video_id: string }
// Returns:
//   200 { video_url, views_used, views_remaining }   — access granted, view counted
//   401 { error: "not_signed_in" }                   — no / invalid JWT
//   402 { error: "not_purchased" }                    — signed in but hasn't bought this video
//   403 { error: "view_limit_reached" }               — already watched 5 times
//   400 { error: "bad_request" }                      — missing/invalid video_id
//   404 { error: "video_not_found" }
//   500 { error: "internal" }

import { createClient } from 'npm:@supabase/supabase-js@^2'

const MAX_VIEWS = 5

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

  // Pull the user from the JWT. verify_jwt=true already validated it.
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json(401, { error: 'not_signed_in' })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) return json(401, { error: 'not_signed_in' })
  const user = userData.user
  const email = (user.email || '').toLowerCase()

  // Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const videoId: string | undefined = body?.video_id
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
  const { data: purchases, error: purchaseErr } = await admin
    .from('purchases')
    .select('id, user_id, email, refunded_at')
    .eq('video_id', videoId)
    .is('refunded_at', null)
    .or(`user_id.eq.${user.id},email.eq.${email}`)
  if (purchaseErr) return json(500, { error: 'internal' })
  if (!purchases || purchases.length === 0) return json(402, { error: 'not_purchased' })

  // Opportunistically backfill user_id on email-matched rows.
  const orphanIds = purchases.filter((p: any) => !p.user_id && p.email && p.email.toLowerCase() === email).map((p: any) => p.id)
  if (orphanIds.length > 0) {
    await admin.from('purchases').update({ user_id: user.id }).in('id', orphanIds)
  }

  // Check / increment views for this (user, video).
  const { data: existingView } = await admin
    .from('video_views')
    .select('id, view_count')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .maybeSingle()

  const currentCount = existingView?.view_count ?? 0
  if (currentCount >= MAX_VIEWS) {
    return json(403, {
      error: 'view_limit_reached',
      views_used: currentCount,
      views_remaining: 0,
    })
  }

  const nextCount = currentCount + 1
  if (existingView) {
    const { error: updErr } = await admin
      .from('video_views')
      .update({ view_count: nextCount, last_viewed_at: new Date().toISOString() })
      .eq('id', existingView.id)
    if (updErr) return json(500, { error: 'internal' })
  } else {
    const { error: insErr } = await admin.from('video_views').insert({
      user_id: user.id,
      video_id: videoId,
      view_count: nextCount,
      last_viewed_at: new Date().toISOString(),
    })
    if (insErr) return json(500, { error: 'internal' })
  }

  return json(200, {
    video_url: video.video_url,
    views_used: nextCount,
    views_remaining: MAX_VIEWS - nextCount,
  })
})
