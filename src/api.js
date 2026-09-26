const YOUTUBE_API_KEY =
  import.meta.env.VITE_YOUTUBE_API_KEY;

const SEARCH_API =
  "https://www.googleapis.com/youtube/v3/search";

const VIDEOS_API =
  "https://www.googleapis.com/youtube/v3/videos";

/* =========================================================
   SONORA CACHE
   ========================================================= */

const TRENDING_CACHE_KEY =
  "sonora_trending_music_cache_v2";

const SEARCH_CACHE_PREFIX =
  "sonora_search_cache_v2_";

/*
  Home / Trending cache:
  6 hours

  Search cache:
  30 minutes
*/

const TRENDING_CACHE_TTL =
  6 * 60 * 60 * 1000;

const SEARCH_CACHE_TTL =
  30 * 60 * 1000;


/* =========================================================
   CACHE HELPERS
   ========================================================= */

function readCache(
  key,
  maxAge = Infinity
) {
  try {
    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const cached =
      JSON.parse(raw);

    if (
      !cached ||
      !Array.isArray(cached.data)
    ) {
      localStorage.removeItem(key);
      return null;
    }

    const age =
      Date.now() -
      Number(cached.timestamp || 0);

    return {
      data: cached.data,

      fresh:
        age >= 0 &&
        age <= maxAge,

      age,
    };
  } catch {
    return null;
  }
}


function writeCache(
  key,
  data
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch {
    // Ignore localStorage errors.
  }
}


function searchCacheKey(query) {
  return (
    `${SEARCH_CACHE_PREFIX}` +
    encodeURIComponent(
      query
        .trim()
        .toLowerCase()
    )
  );
}


/* =========================================================
   YOUTUBE DURATION
   ========================================================= */

function getVideoDurationSeconds(
  duration
) {
  if (
    !duration ||
    typeof duration !== "string"
  ) {
    return 0;
  }

  const match =
    duration.match(
      /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );

  if (!match) {
    return 0;
  }

  const hours =
    Number(match[1] || 0);

  const minutes =
    Number(match[2] || 0);

  const seconds =
    Number(match[3] || 0);

  return (
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}


/* =========================================================
   SHORT-FORM FILTER
   ========================================================= */

function looksLikeShortForm(
  title,
  tags = [],
  description = ""
) {
  const text =
    `${title} ${description}`
      .toLowerCase();

  const normalizedTags =
    tags.map((tag) =>
      tag.toLowerCase()
    );

  const titleShortWords = [
    "#shorts",
    "#short",
    "youtube shorts",
    "youtube short",
    "shorts video",
    "short video",
  ];

  const unwantedShortForm = [
    "reels",
    "instagram reel",
    "instagram reels",
    "whatsapp status",
    "status video",
    "status song",
    "viral status",
    "edit audio",
    "fan edit",
  ];

  if (
    titleShortWords.some(
      (word) =>
        text.includes(word)
    )
  ) {
    return true;
  }

  if (
    unwantedShortForm.some(
      (word) =>
        text.includes(word)
    )
  ) {
    return true;
  }

  if (
    normalizedTags.some(
      (tag) =>
        [
          "shorts",
          "#shorts",
          "short",
          "reels",
        ].includes(tag)
    )
  ) {
    return true;
  }

  return false;
}


/* =========================================================
   MAP YOUTUBE VIDEO
   ========================================================= */

function mapVideo(item) {
  return {
    id: item.id,

    title:
      item.snippet?.title ||
      "Unknown Song",

    artist:
      item.snippet?.channelTitle ||
      "Unknown Artist",

    image:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      "",

    videoId: item.id,
  };
}


/* =========================================================
   YOUTUBE REQUEST HELPER
   ========================================================= */

async function getJson(url) {
  const response =
    await fetch(url);

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const reason =
      data?.error?.errors?.[0]
        ?.reason ||
      data?.error?.status ||
      `http_${response.status}`;

    const error =
      new Error(
        `YouTube API request failed (${response.status}: ${reason})`
      );

    error.status =
      response.status;

    error.reason =
      reason;

    throw error;
  }

  return data;
}


/* =========================================================
   QUOTA ERROR CHECK
   ========================================================= */

function isQuotaError(error) {
  return (
    Number(error?.status) === 403 ||
    Number(error?.status) === 429 ||
    [
      "quotaExceeded",
      "rateLimitExceeded",
      "dailyLimitExceeded",
    ].includes(
      error?.reason
    )
  );
}


/* =========================================================
   ENRICH SEARCH RESULTS
   ========================================================= */

async function enrichVideos(
  videoIds
) {
  if (!videoIds.length) {
    return [];
  }

  const params =
    new URLSearchParams({
      part:
        "snippet,contentDetails",

      id:
        videoIds.join(","),

      key:
        YOUTUBE_API_KEY,
    });

  const data =
    await getJson(
      `${VIDEOS_API}?${params.toString()}`
    );

  return (
    data.items || []
  )
    .filter((item) => {
      const duration =
        getVideoDurationSeconds(
          item.contentDetails
            ?.duration
        );

      /* Remove Shorts */
      if (
        duration > 0 &&
        duration <= 60
      ) {
        return false;
      }

      /* Remove short-form content */
      if (
        looksLikeShortForm(
          item.snippet?.title ||
            "",
          item.snippet?.tags ||
            [],
          item.snippet
            ?.description || ""
        )
      ) {
        return false;
      }

      /* Music category only */
      if (
        item.snippet?.categoryId !==
        "10"
      ) {
        return false;
      }

      /*
        Remove suspicious short
        viral/status/edit uploads.
      */

      if (
        duration > 0 &&
        duration <= 180 &&
        /🔥|viral|trend|status|edit/i.test(
          item.snippet?.title || ""
        )
      ) {
        return false;
      }

      return true;
    })
    .map(mapVideo);
}


/* =========================================================
   HOME / TRENDING MUSIC
   =========================================================

   IMPORTANT:

   Home does NOT use search.list anymore.

   It uses videos.list + mostPopular.

   search.list currently has its own
   exhausted quota bucket.

   videos.list uses the general
   YouTube quota bucket.

   ========================================================= */

export async function getTrendingTracks() {
  const cached =
    readCache(
      TRENDING_CACHE_KEY,
      TRENDING_CACHE_TTL
    );

  /*
    If we already have fresh Home data,
    don't make another API request.
  */

  if (
    cached?.fresh &&
    cached.data.length > 0
  ) {
    return cached.data;
  }

  if (!YOUTUBE_API_KEY) {
    if (
      cached?.data?.length
    ) {
      return cached.data;
    }

    throw new Error(
      "VITE_YOUTUBE_API_KEY is missing"
    );
  }

  try {
    /*
      Get popular Music videos
      in India.

      This does NOT use search.list.
    */

    const params =
      new URLSearchParams({
        part:
          "snippet,contentDetails",

        chart:
          "mostPopular",

        regionCode:
          "IN",

        videoCategoryId:
          "10",

        maxResults:
          "25",

        key:
          YOUTUBE_API_KEY,
      });

    const data =
      await getJson(
        `${VIDEOS_API}?${params.toString()}`
      );

    const tracks =
      (data.items || [])
        .filter((item) => {
          const duration =
            getVideoDurationSeconds(
              item.contentDetails
                ?.duration
            );

          /*
            Remove Shorts
          */

          if (
            duration > 0 &&
            duration <= 60
          ) {
            return false;
          }

          /*
            Remove Reels,
            status videos,
            fan edits, etc.
          */

          if (
            looksLikeShortForm(
              item.snippet?.title ||
                "",
              item.snippet?.tags ||
                [],
              item.snippet
                ?.description || ""
            )
          ) {
            return false;
          }

          /*
            Music category only
          */

          return (
            item.snippet
              ?.categoryId ===
            "10"
          );
        })
        .map(mapVideo);

    /*
      Save successful results.
    */

    if (
      tracks.length > 0
    ) {
      writeCache(
        TRENDING_CACHE_KEY,
        tracks
      );

      return tracks;
    }

    /*
      If YouTube returned nothing,
      use old cached data.
    */

    if (
      cached?.data?.length
    ) {
      return cached.data;
    }

    return [];
  } catch (error) {
    console.error(
      "Trending API error:",
      error
    );

    /*
      IMPORTANT:

      If YouTube temporarily fails,
      NEVER destroy the Home screen
      when cached data exists.
    */

    if (
      cached?.data?.length
    ) {
      return cached.data;
    }

    throw error;
  }
}


/* =========================================================
   SEARCH MUSIC
   ========================================================= */

export async function searchTracks(
  query
) {
  const cleanQuery =
    query.trim();

  if (!cleanQuery) {
    return [];
  }

  /*
    HOME COMPATIBILITY

    Your existing App.jsx currently
    calls searchTracks() for Home.

    Instead of forcing you to change
    App.jsx immediately, detect the
    Home query and route it to the
    new Trending function.
  */

  if (
    /latest\s+trending\s+tamil\s+songs/i.test(
      cleanQuery
    )
  ) {
    return getTrendingTracks();
  }

  const cacheKey =
    searchCacheKey(
      cleanQuery
    );

  const cached =
    readCache(
      cacheKey,
      SEARCH_CACHE_TTL
    );

  /*
    Use cached search results
    when available.
  */

  if (
    cached?.fresh &&
    cached.data.length > 0
  ) {
    return cached.data;
  }

  if (!YOUTUBE_API_KEY) {
    if (
      cached?.data?.length
    ) {
      return cached.data;
    }

    throw new Error(
      "VITE_YOUTUBE_API_KEY is missing"
    );
  }

  try {
    const searchQuery =
      `${cleanQuery} Indian song`;

    const params =
      new URLSearchParams({
        part:
          "snippet",

        q:
          searchQuery,

        type:
          "video",

        maxResults:
          "25",

        videoCategoryId:
          "10",

        videoEmbeddable:
          "true",

        videoSyndicated:
          "true",

        regionCode:
          "IN",

        relevanceLanguage:
          "en",

        safeSearch:
          "moderate",

        key:
          YOUTUBE_API_KEY,
      });

    const data =
      await getJson(
        `${SEARCH_API}?${params.toString()}`
      );

    const videoIds =
      (data.items || [])
        .map(
          (item) =>
            item.id?.videoId
        )
        .filter(Boolean);

    const tracks =
      await enrichVideos(
        videoIds
      );

    /*
      Cache successful searches.
    */

    writeCache(
      cacheKey,
      tracks
    );

    return tracks;
  } catch (error) {
    console.error(
      "Search API error:",
      error
    );

    /*
      If an older result exists,
      use it instead of breaking
      the search page.
    */

    if (
      cached?.data?.length
    ) {
      return cached.data;
    }

    /*
      Don't repeatedly hammer
      an exhausted YouTube quota.
    */

    if (
      isQuotaError(error)
    ) {
      const quotaError =
        new Error(
          "YouTube search quota is temporarily exhausted. Please try again after the quota resets."
        );

      quotaError.code =
        "YOUTUBE_QUOTA_EXCEEDED";

      quotaError.status =
        error.status;

      throw quotaError;
    }

    throw error;
  }
}