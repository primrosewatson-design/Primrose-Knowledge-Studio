// Edge Function: redeem-code
//
// Deployed with verify_jwt=false at the gateway — the caller is an
// anonymous visitor who received a code from Primrose (e.g. a promo code
// given out at a talk or over email). Access is gated entirely by the
// code string. Codes are reusable — the same code can be redeemed any
// number of times. To revoke a code, delete the row via Supabase MCP.
//
// POST { code: string }
// Returns:
//   200 { video_url, video_title, note? }
//   400 { error: "bad_request" }
//   404 { error: "code_not_found" | "video_not_available" }
//   500 { error: "internal" }
//
// `redeemed_views` is incremented on every successful redemption purely as
// an analytics counter; `redeemed_at` is stamped with the most recent
// redemption time. The increment is done via the `bump_access_code_usage`
// RPC so concurrent redemptions don't clobber each other (the previous
// read-then-write pattern lost updates under load). These updates are
// best-effort and do not gate the response — a failed counter write is
// logged but still returns the video. Code lookup is case-insensitive
// because `access_codes.code` is a citext column, so `.eq('code', input)`
// matches regardless of case while treating `%` and `_` as literals (no
// LIKE wildcards — an earlier `.ilike` version was injectable).

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

  let body: { code?: unknown } = {}
  try {
    body = (await req.json()) as { code?: unknown }
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const rawCode = body.code
  if (!rawCode || typeof rawCode !== 'string') return json(400, { error: 'bad_request' })
  const code = rawCode.trim()
  if (!code) return json(400, { error: 'bad_request' })

  type CodeJoin = {
    id: string
    video_id: string
    note: string | null
    videos:
      | { title: string; video_url: string | null }
      | { title: string; video_url: string | null }[]
      | null
  }
  const { data: found, error: lookupErr } = await admin
    .from('access_codes')
    .select('id, video_id, note, videos:video_id (title, video_url)')
    .eq('code', code)
    .maybeSingle<CodeJoin>()

  if (lookupErr) {
    console.error('redeem-code lookup error:', lookupErr)
    return json(500, { error: 'internal' })
  }
  if (!found) return json(404, { error: 'code_not_found' })

  const video = Array.isArray(found.videos) ? found.videos[0] : found.videos
  if (!video || !video.video_url) return json(404, { error: 'video_not_available' })

  // Best-effort analytics: bump the view counter atomically via the
  // `bump_access_code_usage` RPC so concurrent redemptions don't clobber
  // each other. Failures are logged but do not block the response, so a
  // stats glitch never locks out a free viewer.
  const { error: bumpErr } = await admin.rpc('bump_access_code_usage', {
    p_code_id: found.id,
  })
  if (bumpErr) console.error('redeem-code counter update error:', bumpErr)

  return json(200, {
    video_url: video.video_url,
    video_title: video.title,
    note: found.note,
  })
})
