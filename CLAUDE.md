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
| `/how-to-pay` | HowToGet.tsx | Shopping cart + checkout form |
| `/about` | About.tsx | Primrose Watson bio, credentials, headshot |

**Layout:** MainLayout.tsx wraps all routes (header nav, footer with LinkedIn/Instagram).

## Components

- **VideoGallery.tsx** — Fetches from Supabase `videos` table. Search, category filter, video cards with price, modal player with iframe embed.

## Database Schema (Supabase)

- **videos** — id, title, description, thumbnail, duration, category, video_url, price, created_at
- **purchases** — id, user_id (FK auth.users), video_id (FK videos), email, amount_paid, created_at. Unique on (user_id, video_id)
- **video_views** — id, user_id, video_id, view_count, last_viewed_at. Unique on (user_id, video_id). Tracks 5-view limit.
- **RLS enabled** on all tables. Videos are public read (SELECT only for anon). Purchases and views scoped to auth.uid().
- **Writes via Supabase MCP** — Anon key can't UPDATE/INSERT. Use the Supabase MCP server (`mcp__*__execute_sql`) for any data changes, or the Supabase SQL Editor as a fallback.
- **Current videos (6 rows):**
  - 🎬 **Rent, Food, or Future?** — Navigating Canada's Cost-of-Living Crisis — Life Skills — $9.99 — 11:08 — YouTube `0zdwhFaSCkE` (first real video)
  - 5 placeholder seeds (TypeScript, CSS, Node.js, Database, JavaScript) — to be replaced as Primrose uploads real videos
- **Gallery sort** — `created_at DESC`, so newest real video appears first. When adding a real video, also bump `created_at = NOW()` if it replaces a placeholder (batch-seed timestamps are identical and won't sort correctly otherwise).
- **Thumbnails** — Real videos use `https://img.youtube.com/vi/<VIDEO_ID>/maxresdefault.jpg` (HD 1280×720).

## What Works vs. In Progress

### Working
- Video gallery with live Supabase data, search, filtering, newest-first sort
- Video player modal (iframe embed)
- First real video live: "Rent, Food, or Future?" with authentic YouTube thumbnail
- All page routing and navigation
- About page with real bio from primrosetax.ca
- Responsive design across all pages
- Vercel deployment with SPA routing
- Social links (LinkedIn, Instagram)
- Supabase MCP server wired up for direct DB writes

### Not Yet Implemented
- **Authentication** — Schema supports it, no login/signup UI
- **Stripe payments** — Checkout form is mock (2s delay simulation). VITE_STRIPE_PUBLISHABLE_KEY is placeholder.
- **Purchase tracking** — DB table exists, not wired to UI
- **5-view enforcement** — DB table exists, not enforced in player
- **Cart persistence** — Client-side state only, resets on refresh
- **Admin/video upload** — No admin panel
- **Cart items on How to Pay** — Currently hardcoded mock items, not connected to gallery

## Design System

### Colors
**Primary:** Royal blue (50–950 scale, primary: #4169e1)

**Gradient combos:**
- Hero: `from-gradient-indigo (#4338CA) to-gradient-violet (#8B5CF6)`
- CTA: `from-gradient-coral (#F43F5E) to-gradient-amber (#F59E0B)`
- Accent: violet (#8B5CF6) and coral (#F43F5E) on interactive elements

**Background:** White (bg-white) with dark text (text-gray-900)
**Font:** Inter (system-ui fallback)

## Environment Variables

```
VITE_SUPABASE_URL=https://gixlcfhgiyshmmkrvqej.supabase.co
VITE_SUPABASE_ANON_KEY=<jwt>
VITE_STRIPE_PUBLISHABLE_KEY=<not configured>
```

`.env` is gitignored. For Vercel deployment, set these in Vercel project settings.

## Rules

- **Single creator** — All copy uses "Primrose Watson" (singular). Never "our team", "industry experts", or company-plural language.
- **No "expert"** — Removed from all copy. Use "curated" or "knowledge" instead.
- **No "lifetime access"** — Business model is 5 views per purchased video.
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
    MainLayout.tsx     # Nav header + footer wrapper
  lib/
    supabase.ts        # Supabase client
  components/
    VideoGallery.tsx   # Video grid with Supabase integration
  pages/
    Home.tsx           # Landing page
    HowToView.tsx      # Instructional guide
    HowToChoose.tsx    # Video gallery wrapper
    HowToGet.tsx       # Cart + checkout (mock)
    About.tsx          # Primrose Watson bio
public/
  Headshot.jpg         # Profile photo
  favicon.svg
supabase/
  schema.sql           # DB schema + seed data
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
