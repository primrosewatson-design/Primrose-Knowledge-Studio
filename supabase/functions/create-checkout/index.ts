// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout Session from a list of video IDs.
// Called by the frontend when the user clicks "Proceed to Checkout".
// verify_jwt=true on this function, so the caller must pass a Supabase auth JWT
// (signed-in user session, or the anon JWT for guest checkouts).

import Stripe from 'npm:stripe@^17'
import { createClient } from 'npm:@supabase/supabase-js@^2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Try to resolve signed-in user from the JWT. If anon JWT, .getUser returns no user.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    let signedInUserId: string | null = null
    let signedInEmail: string | null = null
    if (jwt) {
      const { data } = await supabase.auth.getUser(jwt)
      if (data?.user) {
        signedInUserId = data.user.id
        signedInEmail = data.user.email ?? null
      }
    }

    const { video_ids, origin } = await req.json()

    if (!Array.isArray(video_ids) || video_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'video_ids must be a non-empty array' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // Look up the Stripe prices for each requested video
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, stripe_price_id')
      .in('id', video_ids)

    if (error) throw error

    const missing = videos.filter((v) => !v.stripe_price_id)
    if (missing.length) {
      return new Response(
        JSON.stringify({
          error: `Missing stripe_price_id for: ${missing.map((v) => v.title).join(', ')}`,
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const line_items = videos.map((v) => ({
      price: v.stripe_price_id!,
      quantity: 1,
    }))

    const baseUrl = origin || 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      metadata: {
        video_ids: video_ids.join(','),
        ...(signedInUserId ? { user_id: signedInUserId } : {}),
      },
      // Pre-fill the email if the user is signed in, so Stripe's receipt
      // + our webhook both use the same address. Falls back to guest flow otherwise.
      ...(signedInEmail ? { customer_email: signedInEmail } : { customer_creation: 'if_required' as const }),
      payment_method_types: ['card'],
    })

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-checkout error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
