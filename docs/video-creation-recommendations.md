# Video Creation Recommendations for Primrose Knowledge Studio

## Current State

Primrose Knowledge Studio is a video-based educational marketplace built with React, TypeScript, Vite, Tailwind CSS, Supabase, and Stripe. Currently, video content is consumed through embedded YouTube iframes with mock data. There are no in-platform video creation or upload tools.

This document recommends how to add video creation capabilities directly inside the platform.

---

## Recommendation Overview

Three tiers are proposed, each building on the previous. Start with Tier 1 for immediate value, then layer on Tiers 2 and 3 as the platform grows.

| Tier | Capability | Effort | Value |
|------|-----------|--------|-------|
| **1 - Upload & Manage** | Upload videos, auto-generate thumbnails, manage metadata | Medium | High |
| **2 - In-Browser Recording** | Record screen, webcam, or both directly in the browser | Medium | High |
| **3 - In-Platform Editing** | Trim, splice, add text overlays, transitions | High | Medium |

---

## Tier 1: Video Upload & Management

### What It Adds
A creator dashboard where Primrose (and future creators) can upload video files, set metadata (title, description, categories, price), auto-generate thumbnails, and publish to the gallery.

### Recommended Architecture

**Storage: Supabase Storage**
- The platform already uses Supabase. Supabase Storage supports large file uploads (up to 5 GB per file) with resumable uploads via the TUS protocol.
- Create a `videos` bucket for raw uploads and a `thumbnails` bucket for generated/uploaded thumbnail images.
- Use Supabase Row Level Security (RLS) policies to restrict uploads to authenticated creators.

**Database Schema (Supabase/PostgreSQL)**
```sql
-- Replace mock data with a real videos table
create table videos (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references auth.users(id),
  title text not null,
  description text,
  categories text[] default '{}',
  duration_seconds integer,
  video_path text not null,          -- Supabase Storage path
  thumbnail_path text,               -- Supabase Storage path
  status text default 'processing',  -- processing | ready | failed
  price_cents integer default 0,
  view_limit integer default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Track per-user view counts
create table video_views (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references videos(id),
  user_id uuid references auth.users(id),
  view_count integer default 0,
  last_viewed_at timestamptz default now(),
  unique(video_id, user_id)
);
```

**Video Processing: Supabase Edge Functions + FFmpeg (WASM)**
- On upload, trigger a Supabase Edge Function that:
  1. Extracts video duration using FFmpeg WASM or a lightweight probe.
  2. Generates a thumbnail at the 25% mark.
  3. Optionally transcodes to HLS (HTTP Live Streaming) for adaptive bitrate playback.
  4. Updates the `videos` row with `status = 'ready'`.

**Playback: Replace YouTube iframes**
- Serve videos directly from Supabase Storage signed URLs (time-limited for security).
- Use an HTML5 `<video>` element or a lightweight player like **Plyr** or **Video.js** for consistent controls and mobile support.
- Enforce the 5-view limit by checking `video_views` before generating a signed URL.

### Key Components to Build

```
src/
  pages/
    CreatorDashboard.tsx    -- Upload form, video list, analytics
  components/
    VideoUploader.tsx       -- Drag-and-drop upload with progress bar
    VideoPlayer.tsx         -- Custom player replacing YouTube iframes
    VideoMetadataForm.tsx   -- Title, description, categories, price
```

### Integration Points
- **App.tsx**: Add route `/creator` for the dashboard (protected by auth).
- **VideoGallery.tsx**: Replace `MOCK_VIDEOS` with a Supabase query to the `videos` table.
- **Supabase Auth**: Add authentication (email/password or magic link) to gate creator access.

---

## Tier 2: In-Browser Video Recording

### What It Adds
A "Record" button in the creator dashboard that captures screen, webcam, or both -- no external software needed.

### Recommended Approach

**Browser APIs: MediaRecorder + getDisplayMedia**
- `navigator.mediaDevices.getDisplayMedia()` for screen capture.
- `navigator.mediaDevices.getUserMedia()` for webcam/microphone.
- `MediaRecorder` API to encode the stream as WebM (VP9 + Opus).
- These are supported in all modern browsers (Chrome, Firefox, Edge, Safari 14.1+).

**Recording Modes**
1. **Screen only** -- ideal for software tutorials.
2. **Webcam only** -- ideal for talking-head explainers.
3. **Screen + webcam overlay** -- picture-in-picture style, achieved by compositing both streams onto an OffscreenCanvas.

**Implementation Sketch**

```tsx
// Core recording hook
function useVideoRecorder() {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)

  async function startRecording(mode: 'screen' | 'webcam' | 'both') {
    const streams: MediaStream[] = []

    if (mode === 'screen' || mode === 'both') {
      streams.push(await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      }))
    }
    if (mode === 'webcam' || mode === 'both') {
      streams.push(await navigator.mediaDevices.getUserMedia({
        video: true, audio: true
      }))
    }

    // Combine streams if needed, then record
    const combined = combineStreams(streams)
    const recorder = new MediaRecorder(combined, {
      mimeType: 'video/webm;codecs=vp9,opus'
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = () => setBlob(new Blob(chunks, { type: 'video/webm' }))

    recorder.start()
    mediaRecorder.current = recorder
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorder.current?.stop()
    setRecording(false)
  }

  return { recording, blob, startRecording, stopRecording }
}
```

**Post-Recording Flow**
1. Preview the recording in the browser.
2. If satisfied, upload directly via the Tier 1 upload pipeline.
3. Supabase Edge Function handles transcoding from WebM to MP4/HLS.

### Key Components to Build

```
src/
  components/
    VideoRecorder.tsx        -- Recording UI with mode selection
    RecordingPreview.tsx     -- Review before uploading
  hooks/
    useVideoRecorder.ts     -- MediaRecorder logic (above)
    useStreamCompositor.ts  -- Combines screen + webcam streams
```

---

## Tier 3: In-Platform Video Editing

### What It Adds
A lightweight editor for trimming clips, adding text overlays, arranging segments on a timeline, and applying simple transitions.

### Recommended Approach

**Option A: FFmpeg WASM (Recommended for MVP)**
- Use `@ffmpeg/ffmpeg` to run FFmpeg directly in the browser via WebAssembly.
- Supports trimming, concatenation, text overlays, fade transitions, and format conversion.
- No server-side processing needed for basic edits.
- Trade-off: Slower than native FFmpeg; works well for clips under 10 minutes.

```tsx
import { FFmpeg } from '@ffmpeg/ffmpeg'

async function trimVideo(file: File, startSec: number, endSec: number) {
  const ffmpeg = new FFmpeg()
  await ffmpeg.load()
  await ffmpeg.writeFile('input.webm', await fetchFile(file))
  await ffmpeg.exec([
    '-i', 'input.webm',
    '-ss', String(startSec),
    '-to', String(endSec),
    '-c', 'copy',
    'output.mp4'
  ])
  const data = await ffmpeg.readFile('output.mp4')
  return new Blob([data], { type: 'video/mp4' })
}
```

**Option B: Canvas-Based Timeline Editor (For Richer UX)**
- Render video frames to a `<canvas>` element for a visual timeline.
- Libraries like **Remotion** (React-native video composition) can generate videos programmatically from React components -- ideal for adding animated text, logos, and transitions.
- Trade-off: Higher complexity, but produces a polished creator experience.

**Editing Features (Priority Order)**
1. **Trim/Cut** -- Set in/out points to remove unwanted sections.
2. **Text Overlays** -- Add titles, captions, or annotations at specific timestamps.
3. **Thumbnail Selection** -- Pick a frame from the video as the thumbnail.
4. **Segment Reordering** -- Drag-and-drop timeline to rearrange clips.
5. **Transitions** -- Simple crossfades between segments.
6. **Audio Adjustments** -- Volume control, mute sections, add background music.

### Key Components to Build

```
src/
  pages/
    VideoEditor.tsx          -- Main editor page
  components/
    Timeline.tsx             -- Visual timeline with draggable segments
    TrimControls.tsx         -- In/out point sliders
    TextOverlayEditor.tsx    -- Add/position text on video
    EditorPreview.tsx        -- Real-time preview of edits
  lib/
    ffmpeg.ts                -- FFmpeg WASM wrapper utilities
```

---

## Recommended Implementation Order

### Phase 1 (Weeks 1-3): Foundation
1. Add Supabase Auth (email/password login for creators).
2. Create the `videos` and `video_views` database tables.
3. Build the `VideoUploader` component with Supabase Storage resumable uploads.
4. Replace YouTube iframes with a custom `VideoPlayer` using signed URLs.
5. Replace `MOCK_VIDEOS` with live Supabase queries.

### Phase 2 (Weeks 4-5): Creator Dashboard
1. Build the `CreatorDashboard` page with video management (list, edit, delete).
2. Add auto-thumbnail generation via Supabase Edge Function.
3. Add the `/creator` route (auth-protected).
4. Implement the 5-view-limit enforcement with `video_views`.

### Phase 3 (Weeks 6-7): In-Browser Recording
1. Build `useVideoRecorder` hook with screen/webcam/both modes.
2. Build `VideoRecorder` UI integrated into the creator dashboard.
3. Add recording preview and direct-to-upload flow.

### Phase 4 (Weeks 8-10): Basic Editing
1. Integrate `@ffmpeg/ffmpeg` WASM.
2. Build trim/cut functionality.
3. Add text overlay editor.
4. Add thumbnail frame selection.

---

## Technology Choices Summary

| Concern | Recommendation | Why |
|---------|---------------|-----|
| **Video Storage** | Supabase Storage | Already in the stack; supports large files and signed URLs |
| **Video Processing** | Supabase Edge Functions + FFmpeg | Serverless, scales automatically |
| **Recording** | MediaRecorder API | Native browser API, no dependencies |
| **In-Browser Editing** | @ffmpeg/ffmpeg (WASM) | Runs client-side, no server costs for basic edits |
| **Video Player** | Plyr or Video.js | Lightweight, customizable, mobile-friendly |
| **Adaptive Streaming** | HLS via FFmpeg transcoding | Industry standard, works on all devices |
| **Auth** | Supabase Auth | Already configured, supports RLS policies |

---

## Cost Considerations

- **Supabase Storage**: Free tier includes 1 GB storage, 2 GB bandwidth. Pro plan ($25/mo) includes 100 GB storage, 250 GB bandwidth. Sufficient for early growth.
- **Supabase Edge Functions**: Free tier includes 500K invocations/month. More than enough for video processing triggers.
- **Client-side recording/editing**: Zero server cost -- all processing happens in the user's browser.
- **No third-party video APIs needed**: The entire pipeline uses Supabase + browser APIs, keeping costs minimal.

---

## Security Considerations

- **Signed URLs**: All video playback URLs should be time-limited (e.g., 1 hour expiry) to prevent link sharing.
- **RLS Policies**: Only authenticated creators can upload; only purchasers can view.
- **File Validation**: Validate file types and sizes on both client and server to prevent abuse.
- **Content-Type Headers**: Ensure proper MIME types are set on uploaded files.
- **Rate Limiting**: Apply rate limits on upload endpoints to prevent abuse.

---

## Summary

The platform's existing Supabase + React stack is well-suited for adding video creation capabilities without introducing new infrastructure. By layering upload/management (Tier 1), browser recording (Tier 2), and client-side editing (Tier 3), creators can produce and publish videos entirely within Primrose Knowledge Studio -- no external tools required.
