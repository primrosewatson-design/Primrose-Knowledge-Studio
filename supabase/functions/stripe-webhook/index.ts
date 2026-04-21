// supabase/functions/stripe-webhook/index.ts
// Receives Stripe webhook events and records / reverses purchases.
// Registered in Stripe Dashboard → Developers → Webhooks.
//
// Handles:
//   checkout.session.completed — insert purchases rows for each video in the session
//   charge.refunded            — stamp refunded_at on the matching purchases rows so
//                                get-video-access immediately denies playback

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

    // If checkout was initiated by a signed-in user, metadata carries their id.
    // Otherwise, try to resolve via email lookup against auth.users so the purchase
    // lands attached to an account immediately (falls back to null for new emails).
    let userId: string | null = session.metadata?.user_id ?? null
    if (!userId && email) {
      try {
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
        const match = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
        if (match) userId = match.id
      } catch (e) {
        console.warn('Could not resolve user by email:', (e as Error).message)
      }
    }

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
      user_id: userId,
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

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id ?? null

    if (!paymentIntentId) {
      console.warn('charge.refunded received with no payment_intent; ignoring:', charge.id)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Stamp refunded_at on any purchases tied to this payment intent.
    // get-video-access filters on refunded_at IS NULL, so this revokes playback immediately.
    const refundedAt = new Date().toISOString()
    const { data: updated, error: updErr } = await supabase
      .from('purchases')
      .update({ refunded_at: refundedAt })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .is('refunded_at', null)
      .select('id, video_id, email')

    if (updErr) {
      console.error('Failed to mark purchases refunded:', updErr)
      return new Response('DB error', { status: 500 })
    }

    console.log(
      `Refunded ${updated?.length ?? 0} purchase row(s) for payment_intent=${paymentIntentId}`,
    )
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
