/**
 * YouTube Utilities
 * Fetches Greg's latest YouTube video URL for Holly's trust-building hooks.
 * Uses YouTube RSS feed with 24-hour in-memory cache.
 */

interface CachedVideo {
  url: string;
  title: string;
  fetchedAt: number;
}

// Simple in-memory cache — 24 hour TTL
let cachedVideo: CachedVideo | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Greg's latest YouTube video URL.
 *
 * Resolution order:
 * 1. In-memory cache (if < 24h old)
 * 2. YouTube RSS feed via channel ID (env: GREG_YOUTUBE_CHANNEL_ID)
 * 3. Fallback to channel page URL (env: GREG_YOUTUBE_CHANNEL_URL)
 * 4. Returns null if no env vars are set
 */
export async function getLatestYouTubeVideoUrl(): Promise<{
  url: string;
  title?: string;
} | null> {
  // Check cache first
  if (cachedVideo && Date.now() - cachedVideo.fetchedAt < CACHE_TTL_MS) {
    return { url: cachedVideo.url, title: cachedVideo.title };
  }

  const channelId = process.env.GREG_YOUTUBE_CHANNEL_ID;
  const channelUrl = process.env.GREG_YOUTUBE_CHANNEL_URL;

  // Try RSS feed if channel ID is available
  if (channelId) {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const response = await fetch(feedUrl, {
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (response.ok) {
        const xml = await response.text();
        const parsed = parseLatestVideoFromFeed(xml);

        if (parsed) {
          cachedVideo = {
            url: parsed.url,
            title: parsed.title,
            fetchedAt: Date.now(),
          };
          return parsed;
        }
      }
    } catch (error) {
      console.warn(
        "[YouTube] Failed to fetch RSS feed, falling back to channel URL:",
        error instanceof Error ? error.message : error
      );
    }
  }

  // Fallback to channel page URL
  if (channelUrl) {
    return { url: channelUrl };
  }

  // No env vars configured — gracefully degrade
  return null;
}

/**
 * Parse the latest video URL and title from YouTube's Atom RSS feed XML.
 * Uses simple string parsing to avoid adding an XML dependency.
 */
function parseLatestVideoFromFeed(
  xml: string
): { url: string; title: string } | null {
  try {
    // YouTube RSS feed entries have <entry> elements
    // The first <entry> is the latest video
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) return null;

    const entry = entryMatch[1];

    // Extract video ID from <yt:videoId>
    const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    if (!videoIdMatch) return null;

    const videoId = videoIdMatch[1].trim();

    // Extract title from <title>
    const titleMatch = entry.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "Latest Episode";

    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title,
    };
  } catch {
    return null;
  }
}

/**
 * Clear the YouTube cache (useful for testing)
 */
export function clearYouTubeCache(): void {
  cachedVideo = null;
}
