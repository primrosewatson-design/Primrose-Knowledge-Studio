// supabase/functions/stripe-webhook/index.ts
// Receives Stripe webhook events and records completed purchases.
// Registered in Stripe Dashboard → Developers → Webhooks.

import Stripe from 'npm:stripe@^17'
import { createClient } from 'npm:@supabase/supabase-js@^2'

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-12-18.acacia',
  })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Get video IDs from metadata
    const videoIds = (session.metadata?.video_ids || '').split(',').filter(Boolean)
    const email = session.customer_details?.email || session.customer_email || 'unknown@example.com'
    const amountTotal = (session.amount_total || 0) / 100

    // Fetch the per-item amounts so we can record each purchase row
    const { data: videos, error: vErr } = await supabase
      .from('videos')
      .select('id, price')
      .in('id', videoIds)

    if (vErr) {
      console.error('Failed to fetch videos:', vErr)
      return new Response('DB error', { status: 500 })
    }

    const rows = videos.map((v) => ({
      user_id: null, // guest purchase for now
      video_id: v.id,
      email,
      amount_paid: v.price,
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string | null,
    }))

    // upsert on stripe_session_id+video_id composite isn't set up, but
    // stripe_session_id is unique per row so we simply insert and ignore duplicates
    const { error: insertErr } = await supabase
      .from('purchases')
      .insert(rows)

    if (insertErr && !insertErr.message.includes('duplicate')) {
      console.error('Failed to insert purchases:', insertErr)
      return new Response('DB error', { status: 500 })
    }

    console.log(`Recorded ${rows.length} purchase(s) for ${email} — total $${amountTotal}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
