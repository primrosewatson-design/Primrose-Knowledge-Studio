# Primrose Knowledge Studio

Online video learning platform by Primrose Watson — Canadian lawyer and legal academic. Single-creator platform (not a marketplace).

## Tech Stack

- **Framework:** React 19.2.4 + TypeScript 5.9.3
- **Build:** Vite 8.0.1
- **Styling:** Tailwind CSS 4.2.2 (via @tailwindcss/vite plugin)
- **Routing:** React Router DOM 7.14.0
- **Backend:** Supabase 2.101.1 (project ref: gixlcfhgiyshmmkrvqej)
- **Deployment:** Vercel (SPA rewrite config in vercel.json)
- **Repo:** github.com/primrosewatson-design/Primrose-Knowledge-Studio

## Routes & Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Home.tsx | Hero, stats, feature cards, testimonials, CTAs |
| `/how-to-view` | HowToView.tsx | Step-by-step guide: Select → Pay → View |
| `/how-to-choose` | HowToChoose.tsx | Video gallery (live Supabase data) |
| `/how-to-pay` | HowToGet.tsx | Shopping cart + Stripe checkout |
| `/about` | About.tsx | Primrose Watson bio, credentials, headshot |
| `/library` | Library.tsx | Auth-gated list of purchased videos — unlimited replays + one gift link per purchase |
| `/auth/callback` | AuthCallback.tsx | Magic-link redirect target |
| `/gift/:token` | GiftRedeem.tsx | Public single-use gift redemption page (no auth required) |

**Layout:** MainLayout.tsx wraps all routes (header nav with conditional "My Library" link for signed-in users, footer with LinkedIn/Instagram).

## Components

- **VideoGallery.tsx** — Fetches from Supabase `videos` table. Search, category filter, video cards with price, Preview button (free 30-second YouTube clip), modal player with iframe embed. Purchasers get unlimited replays.
- **AuthModal.tsx** — Magic-link sign-in modal. Sends one-time email via `supabase.auth.signInWithOtp`; user clicks link and lands on `/auth/callback`.
- **GiftModal.tsx** — Lets a purchaser generate (or retrieve) the one gift link for a purchase. Optional recipient name/email/message. Displays the `/gift/:token` URL with copy-to-clipboard and redemption status. Idempotent — re-opening shows the same link.

## Database Schema (Supabase)

- **videos** — id, title, description, thumbnail, duration, category, video_url, preview_youtube_id, price, stripe_price_id, created_at
- **purchases** — id, user_id (FK auth.users), video_id (FK videos), email, amount_paid, stripe_session_id, refunded_at, created_at. Unique on (user_id, video_id)
- **video_views** — id, user_id, video_id, view_count, last_viewed_at. Unique on (user_id, video_id). Analytics only — no cap; purchasers get unlimited replays.
- **cart_items** — user_id (FK auth.users), video_id (FK videos), added_at. Composite PK on (user_id, video_id). Cross-device cart persistence for signed-in users.
- **video_gifts** — id, purchase_id (unique FK purchases), giver_user_id (FK auth.users), video_id (FK videos), token (unique), recipient_email, recipient_name, message, redeemed_at, redeemed_views, created_at. One gift link per purchase, single-use (1 view). RLS lets the giver see their own rows; the `create-gift` and `redeem-gift` edge functions run as service_role and bypass RLS for writes.
- **RLS enabled** on all tables. Videos are public read (SELECT only for anon). Purchases/views/cart are scoped to `auth.uid()`. Purchases also allow SELECT when JWT email matches the row — so rows inserted pre-auth by the Stripe webhook still surface after sign-in.
- **Purchases orphan-claim policy** — `"Users claim own email-matched purchases"` (UPDATE) lets a signed-in user attach their `user_id` to rows where `user_id IS NULL AND lower(email) = jwt_email`. WITH CHECK forces the new `user_id = auth.uid()`, so callers can only claim rows for themselves. This is what `AuthCallback.tsx` relies on when it backfills pre-auth purchases after a magic-link sign-in. Migration: `purchases_claim_orphan_by_email_policy`.
- **Writes via Supabase MCP** — Anon key can't UPDATE/INSERT on videos. Use the Supabase MCP server (`mcp__*__execute_sql`, `apply_migration`) for any DDL/admin data changes, or the Supabase SQL Editor as a fallback.
- **Current videos (6 rows):**
  - 🎬 **Rent, Food, or Future?** — Navigating Canada's Cost-of-Living Crisis — Life Skills — $9.99 — 11:08 — YouTube `0zdwhFaSCkE` (first real video)
  - 5 placeholder seeds (TypeScript, CSS, Node.js, Database, JavaScript) — to be replaced as Primrose uploads real videos
- **Gallery sort** — `created_at DESC`, so newest real video appears first. When adding a real video, also bump `created_at = NOW()` if it replaces a placeholder (batch-seed timestamps are identical and won't sort correctly otherwise).
- **Thumbnails** — Real videos use `https://img.youtube.com/vi/<VIDEO_ID>/maxresdefault.jpg` (HD 1280×720).

## Supabase Edge Functions

- **create-checkout** — Creates a Stripe Checkout Session from cart `video_ids`. Redirects to `${SITE_URL}/how-to-pay?success=...`.
- **stripe-webhook** — Handles `checkout.session.completed` (inserts `purchases` rows + sends Resend confirmation email) and `charge.refunded` (stamps `refunded_at`). `verify_jwt: false` so Stripe can hit it.
- **get-video-access** — `verify_jwt: false` at the gateway; verifies the caller's JWT *inside* the function with `jose.jwtVerify()` (HS256 via `SUPABASE_JWT_SECRET`, JWKS fallback). Verifies the user has a non-refunded purchase for `video_id`, logs a view in `video_views` for analytics (no cap — unlimited replays for purchasers), and returns the `video_url`.
- **create-gift** — Auth-gated via the same in-function JWT verification. Given a purchased `video_id`, idempotently creates the one allowed `video_gifts` row for that purchase and returns `{token, url, recipient_email, recipient_name, message, redeemed_at, redeemed_views, already_exists}`. Uses a 24-byte crypto-random hex token.
- **redeem-gift** — Public (`verify_jwt: false`, no auth). Given a `{token}`, atomically marks the single-use gift as redeemed via an optimistic-concurrency UPDATE (`.eq('redeemed_views', 0)`) and returns `{video_url, video_title, recipient_name, message}`. If already redeemed, returns `{error: 'already_redeemed'}`.

## What Works vs. In Progress

### Working
- Video gallery with live Supabase data, search, filtering, newest-first sort
- Free Preview button per video (30s YouTube clip) + unlock CTA to cart
- Video player modal (iframe embed) with auth-gated access via `get-video-access` edge function (unlimited replays for purchasers)
- First real video live: "Rent, Food, or Future?" with authentic YouTube thumbnail
- Magic-link authentication (Supabase OTP) + `/auth/callback` handler + conditional "My Library" nav link
- `/library` page — signed-in users see purchased videos with Watch button and "Gift to a friend" button
- Gifting flow — one free gift link per purchase (`create-gift`), single-use public redemption page at `/gift/:token` (`redeem-gift`), idempotent generation with copy-to-clipboard UI (`GiftModal.tsx`)
- Stripe live checkout via `create-checkout` edge function (real prices, session redirect)
- Stripe webhook handling: purchases inserted on `checkout.session.completed`, `refunded_at` stamped on `charge.refunded`
- Order confirmation email via Resend from the webhook (graceful degradation if keys not configured)
- Cart with real Supabase video data + cross-device persistence for signed-in users (`cart_items` table)
- All page routing and navigation
- About page with real bio from primrosetax.ca
- Responsive design across all pages
- Vercel deployment with SPA routing
- Social links (LinkedIn, Instagram)
- Supabase MCP server wired up for direct DB writes
- a11y audit: 0 axe violations (WCAG 2.1 AA + best-practice) across all routes

### Not Yet Implemented
- **Admin/video upload** — No admin panel; videos are seeded via Supabase MCP
- **Resend configuration** — webhook code is live but needs `RESEND_API_KEY`, `RESEND_FROM`, `SITE_URL` secrets set in Supabase → Edge Functions → Settings before emails actually send
- **Stripe webhook event subscription** — dashboard must include `charge.refunded` in addition to `checkout.session.completed`
- **Content backlog** — 5 placeholder videos still in `videos` table awaiting real replacements

## Design System

### Colors
**Primary:** Royal blue (50–950 scale, primary: #4169e1)

**Gradient combos:**
- Hero: `from-gradient-indigo (#4338CA) to-gradient-violet (#8B5CF6)`
- CTA: `from-gradient-coral (#F43F5E) to-gradient-amber (#F59E0B)`
- Accent: violet (#8B5CF6) and coral (#F43F5E) on interactive elements

**Background:** White (bg-white) with dark text (text-gray-900)
**Font:** Inter (system-ui fallback)

### Card Patterns
- **Home feature cards** — horizontal flex layout (`flex gap-4 rounded-lg p-6`), badge/icon on left + content stack on right. Shared between "Get Started in 3 Steps" and "Why Choose Primrose Knowledge Studio?" so both sections read as one visual family. Keep them consistent — if you change one, change the other.
- **Coral/rose accent text** — Use `text-rose-700` on pastel card backgrounds, not `text-gradient-coral` (#F43F5E). The coral gradient token fails WCAG AA contrast (~3.3:1) on the pastel tints.

## Environment Variables

Client (Vite, `.env` + Vercel project settings):
```
VITE_SUPABASE_URL=https://gixlcfhgiyshmmkrvqej.supabase.co
VITE_SUPABASE_ANON_KEY=<jwt>
VITE_SITE_URL=https://primroseknowledgestudio.com  # magic-link redirect target — must be the deployed origin, NOT window.location.origin, or dev-origin links fail with ERR_CONNECTION_REFUSED
```

Edge function secrets (Supabase → Edge Functions → Settings):
```
STRIPE_SECRET_KEY=<live or test sk>
STRIPE_WEBHOOK_SECRET=<whsec_...>
SUPABASE_URL=<auto>
SUPABASE_SERVICE_ROLE_KEY=<auto>
RESEND_API_KEY=<re_...>            # optional — webhook skips email if unset
RESEND_FROM="Primrose Knowledge Studio <mail@domain.com>"  # optional
SITE_URL=https://primroseknowledgestudio.com  # optional
```

`.env` is gitignored.

## Rules

- **Single creator** — All copy uses "Primrose Watson" (singular). Never "our team", "industry experts", or company-plural language.
- **No "expert"** — Removed from all copy. Use "curated" or "knowledge" instead.
- **Value model** — Each purchase grants the buyer **unlimited replays** of that video plus **one free single-use gift link** to share with a friend. Do not reintroduce the old "5 views per video" cap or "lifetime access" phrasing anywhere in copy, UI, or edge functions.
- **No "money-back guarantee"** — Removed from all messaging.
- **Link "Primrose Watson"** — Wherever her name appears in body text, link to `/about`.
- **Colour palette** — Royal blue only. Dark blue and warm palettes were removed. Don't re-add them.
- **Preview verification** — When editing files with a dev server running, verify observable changes via browser screenshot. Don't announce skipping verification.
- **Commits** — Push to `claude/jolly-goldberg` branch, create PR via `gh`, merge to main.
- **Adding a real video** — (1) INSERT (or UPDATE an existing placeholder) via Supabase MCP `execute_sql`. (2) Set `thumbnail` to `https://img.youtube.com/vi/<YT_ID>/maxresdefault.jpg`. (3) Set `video_url` to `https://www.youtube.com/embed/<YT_ID>`. (4) Set `created_at = NOW()` so it sorts to the top. (5) Use a real category that surfaces in the filter chips.

## File Structure

```
src/
  App.tsx              # Routes
  main.tsx             # Entry point
  index.css            # Tailwind theme + color palette
  layouts/
    MainLayout.tsx     # Nav header + footer wrapper (conditional Library link)
  lib/
    supabase.ts        # Supabase client
    auth.tsx           # AuthProvider + useAuth() hook (magic-link + cart sync)
    cart.ts            # localStorage cart + Supabase cross-device mirror
  components/
    VideoGallery.tsx   # Video grid + Preview modal + live Supabase data
    AuthModal.tsx      # Magic-link sign-in modal
    GiftModal.tsx      # Create/view the one gift link per purchase
  pages/
    Home.tsx           # Landing page
    HowToView.tsx      # Instructional guide
    HowToChoose.tsx    # Video gallery wrapper
    HowToGet.tsx       # Cart + Stripe checkout
    About.tsx          # Primrose Watson bio
    Library.tsx        # Auth-gated purchased-video list (watch + gift)
    AuthCallback.tsx   # Magic-link redirect handler
    GiftRedeem.tsx     # Public /gift/:token single-use redemption page
public/
  Headshot.jpg         # Profile photo
  favicon.svg
supabase/
  schema.sql           # DB schema + seed data
  functions/
    create-checkout/index.ts   # Stripe Checkout Session
    stripe-webhook/index.ts    # checkout.session.completed + charge.refunded + Resend email
    get-video-access/index.ts  # In-function JWT verify + unlimited-replay access
    create-gift/index.ts       # Auth-gated: mint the one gift link per purchase
    redeem-gift/index.ts       # Public: single-use gift redemption
vercel.json            # SPA routing
.mcp.json              # Supabase MCP config
```

## Scripts

- `npm run dev` — Start dev server (port 5173)
- `npm run build` — TypeScript check + production build
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

## MCP Servers (wired up)

- **Supabase MCP** — full project access (`execute_sql`, `apply_migration`, `list_tables`, etc.). Use for any DB read/write.
- **Claude Preview** — `preview_screenshot`, `preview_eval`, `preview_console_logs` against the running Vite dev server on port 5173.
