# Video Creation Recommendations for Primrose Knowledge Studio

## Chosen Approach: YouTube Unlisted + Supabase Management

Videos will be created and uploaded to YouTube as **unlisted** links, then managed through the platform via Supabase. This keeps video hosting free, leverages YouTube's transcoding and adaptive streaming, and builds on the existing YouTube iframe player already in the codebase.

---

## How It Works

```
1. Record/edit video externally (phone, screen recorder, etc.)
           |
           v
2. Upload to YouTube as "Unlisted"
           |
           v
3. Copy the YouTube URL + thumbnail
           |
           v
4. Add video to the platform via Creator Dashboard
   (title, description, categories, price, YouTube URL)
           |
           v
5. Supabase stores the metadata in a `videos` table
           |
           v
6. VideoGallery queries Supabase and displays to learners
           |
           v
7. Playback via YouTube iframe (existing implementation)
```

### Why Unlisted YouTube

- **Free hosting** -- no storage or bandwidth costs.
- **Automatic transcoding** -- YouTube handles all video quality levels.
- **Adaptive streaming** -- viewers get the best quality for their connection.
- **No infrastructure** -- no need for Supabase Storage buckets, Edge Functions for transcoding, or signed URLs.
- **Already works** -- the platform's `VideoGallery.tsx` already uses YouTube iframes.
- **Access control** -- unlisted videos are not searchable on YouTube; only people with the link (i.e., through your platform) can find them.

---

## What to Build

### 1. Database Schema (Supabase/PostgreSQL)

Replace mock data with a real `videos` table:

```sql
create table videos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  categories text[] default '{}',
  duration text,                      -- e.g. "12:45"
  youtube_url text not null,          -- YouTube embed URL (unlisted)
  thumbnail_url text not null,        -- YouTube thumbnail or custom URL
  price_cents integer default 0,
  view_limit integer default 5,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Track per-user view counts (for the 5-view limit)
create table video_views (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  view_count integer default 0,
  last_viewed_at timestamptz default now(),
  unique(video_id, user_id)
);
```

### 2. Creator Dashboard

A simple admin page to add and manage videos:

```
src/
  pages/
    CreatorDashboard.tsx    -- Add/edit/delete videos, toggle publish status
  components/
    VideoMetadataForm.tsx   -- Form: title, description, YouTube URL, categories, price
```

**The form collects:**
- Title
- Description
- YouTube embed URL (paste the unlisted link, auto-convert to embed format)
- Thumbnail URL (auto-extract from YouTube or upload custom)
- Categories (multi-select)
- Duration
- Price
- Published status (draft/live)

**Auto-extract YouTube thumbnail:**
```ts
// Given a YouTube URL, get the high-quality thumbnail
function getYouTubeThumbnail(youtubeUrl: string): string | null {
  const match = youtubeUrl.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (!match) return null
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
}
```

### 3. Replace Mock Data in VideoGallery

Swap `MOCK_VIDEOS` for a live Supabase query:

```ts
import { supabase } from '../lib/supabase'

const [videos, setVideos] = useState<Video[]>([])

useEffect(() => {
  async function fetchVideos() {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
    if (data) setVideos(data)
  }
  fetchVideos()
}, [])
```

### 4. View Limit Enforcement

Before playing a video, check and increment the view count:

```ts
async function canWatch(videoId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('video_views')
    .select('view_count')
    .eq('video_id', videoId)
    .eq('user_id', userId)
    .single()

  if (!data) return true                    // First view
  return data.view_count < 5               // Under the limit
}

async function recordView(videoId: string, userId: string) {
  await supabase.rpc('increment_view_count', {
    p_video_id: videoId,
    p_user_id: userId
  })
}
```

### 5. Supabase Auth (Creator Login)

Protect the dashboard so only you can add/edit videos:

```ts
// Simple auth check for the creator dashboard
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

---

## Implementation Order

| Step | What | Details |
|------|------|---------|
| **1** | Create `videos` table in Supabase | Run the SQL schema above in the Supabase SQL editor |
| **2** | Replace `MOCK_VIDEOS` | Query Supabase in `VideoGallery.tsx` instead of using hardcoded data |
| **3** | Build Creator Dashboard | Form to add videos by pasting YouTube unlisted URLs + metadata |
| **4** | Add Supabase Auth | Email/password login for the creator dashboard |
| **5** | Add view tracking | `video_views` table + check before playback |
| **6** | Add RLS policies | Restrict who can insert/update/read videos |

---

## YouTube Tips for Unlisted Videos

- **Set visibility to "Unlisted"** when uploading -- the video won't appear in search or on your channel.
- **Use YouTube Studio** for free trimming, cuts, and blur tools before publishing.
- **Embed URL format**: Convert `https://www.youtube.com/watch?v=ABC123` to `https://www.youtube.com/embed/ABC123` for the iframe player.
- **Thumbnails**: YouTube auto-generates 3 thumbnail options, or you can upload a custom one. Use `https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg` to reference it.
- **No ads on unlisted**: Unlisted videos on channels without monetization won't show ads to your learners.

---

## Cost

- **YouTube**: Free (unlimited uploads, hosting, bandwidth, transcoding).
- **Supabase**: Free tier covers the database and auth for this use case (500 MB database, 50K auth users).
- **Total: $0/month** to start.

---

## Security Considerations

- **Unlisted != private**: Anyone with the YouTube link can watch. The platform controls discovery, but the URLs themselves are not secret. For truly gated access, consider adding domain-restricted embedding in YouTube Studio.
- **RLS policies**: Ensure only the creator can insert/update videos; learners can only read published videos.
- **View limit**: Enforce server-side via Supabase RPC, not client-side, to prevent bypassing.

---

## Summary

By using YouTube as the video host and Supabase as the metadata/access layer, you get a fully functional video platform with zero hosting costs. The creator workflow is: record a video, upload to YouTube as unlisted, paste the URL into the creator dashboard. The platform handles discovery, purchase flow, and view limits.
