// supabase/functions/stripe-webhook/index.ts
// Receives Stripe webhook events and records / reverses purchases.
// Registered in Stripe Dashboard → Developers → Webhooks.
//
// Handles:
//   checkout.session.completed — insert purchases rows for each video in the session
//                                and send a confirmation email via Resend
//   charge.refunded            — stamp refunded_at on the matching purchases rows so
//                                get-video-access immediately denies playback
//
// Env vars required:
//   STRIPE_SECRET_KEY            — Stripe API key
//   STRIPE_WEBHOOK_SECRET        — webhook signing secret
//   SUPABASE_URL                 — (auto-injected by Supabase runtime)
//   SUPABASE_SERVICE_ROLE_KEY    — (auto-injected)
// Optional (email is skipped if absent):
//   RESEND_API_KEY               — Resend API key
//   RESEND_FROM                  — verified sender, e.g. 'Primrose Knowledge Studio <no-reply@yourdomain.com>'
//   SITE_URL                     — e.g. 'https://primroseknowledgestudio.com', used for library link

import Stripe from 'npm:stripe@^17'
import { createClient } from 'npm:@supabase/supabase-js@^2'

// Minimal shape for video rows used in the email render.
interface VideoForEmail {
  id: string
  title: string
  price: number
}

// Escape a string for safe interpolation into HTML.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendConfirmationEmail(params: {
  to: string
  videos: VideoForEmail[]
  amountTotal: number
  sessionId: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.log('[email] RESEND_API_KEY not set — skipping confirmation email')
    return
  }

  const from = Deno.env.get('RESEND_FROM') || 'Primrose Knowledge Studio <onboarding@resend.dev>'
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://primroseknowledgestudio.com').replace(/\/$/, '')
  const libraryUrl = `${siteUrl}/library`

  const itemsHtml = params.videos
    .map(
      (v) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(v.title)}</td><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;">$${v.price.toFixed(2)}</td></tr>`,
    )
    .join('')

  const itemsText = params.videos
    .map((v) => `  • ${v.title} — $${v.price.toFixed(2)}`)
    .join('\n')

  const plural = params.videos.length === 1 ? 'video' : 'videos'

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(90deg,#4338CA,#8B5CF6);padding:28px 32px;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;">Thanks for your purchase!</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.92;">Your ${plural} ${params.videos.length === 1 ? 'is' : 'are'} ready to watch.</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        Sign in with this email address on any device and your library will appear automatically. Each video can be watched up to 5 times.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 16px;">
        <thead><tr><th align="left" style="padding:8px 0;color:#6b7280;font-weight:600;">Item</th><th align="right" style="padding:8px 0;color:#6b7280;font-weight:600;">Price</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot><tr><td style="padding:12px 0;font-weight:700;">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;">$${params.amountTotal.toFixed(2)} CAD</td></tr></tfoot>
      </table>
      <div style="margin:24px 0 8px;text-align:center;">
        <a href="${libraryUrl}" style="display:inline-block;background:#4169e1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Open my library →</a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
        Order reference: ${escapeHtml(params.sessionId)}<br>
        Questions? Reply to this email or contact <a href="mailto:primrosewatson@gmail.com" style="color:#4169e1;">primrosewatson@gmail.com</a>.
      </p>
    </div>
  </div>
</body></html>`

  const text = `Thanks for your purchase!

Your ${plural} ${params.videos.length === 1 ? 'is' : 'are'} ready to watch. Sign in with this email address on any device and your library will appear automatically. Each video can be watched up to 5 times.

${itemsText}

Total: $${params.amountTotal.toFixed(2)} CAD

Open your library: ${libraryUrl}

Order reference: ${params.sessionId}
Questions? Reply to this email or contact primrosewatson@gmail.com.`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: `Your Primrose Knowledge Studio ${plural} — ready to watch`,
      html,
      text,
      reply_to: 'primrosewatson@gmail.com',
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text().catch(() => '')
    throw new Error(`Resend ${resendRes.status}: ${errText.slice(0, 500)}`)
  }
}

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

    // Fetch titles + prices so we can record each purchase row AND render
    // the confirmation email.
    const { data: videos, error: vErr } = await supabase
      .from('videos')
      .select('id, title, price')
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

    // Fire the confirmation email. Non-fatal — a send failure shouldn't
    // abort the webhook (purchases are already recorded, Stripe doesn't
    // need to retry). Any errors get logged and surface in the Supabase
    // function logs.
    try {
      await sendConfirmationEmail({
        to: email,
        videos,
        amountTotal,
        sessionId: session.id,
      })
      console.log(`Sent confirmation email to ${email}`)
    } catch (e) {
      console.error('[email] confirmation send failed:', (e as Error).message)
    }
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
