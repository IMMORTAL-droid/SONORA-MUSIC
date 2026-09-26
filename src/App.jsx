import { useState, useEffect, useRef } from "react";
import YouTube from "react-youtube";
import { searchTracks } from "./api";

import {
  Home,
  Search,
  Library,
  Heart,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat2,
  Repeat1,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  ListMusic,
  Trash2,
  Pencil,
  X,
  PlusCircle,
  ListPlus,
  ListEnd,
  RotateCcw,
  GripVertical,
} from "lucide-react";

import "./App.css";

function formatTime(time) {
  const minutes = Math.floor((time || 0) / 60);
  const seconds = Math.floor((time || 0) % 60);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function loadSaved(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors.
  }
}

function App() {
  const youtubePlayerRef = useRef(null);

  const queueRef = useRef([]);
  const currentSongRef = useRef(null);
  const songsRef = useRef([]);
  const repeatModeRef = useRef("off");
  const shuffleRef = useRef(false);

  const dragQueueIndexRef = useRef(null);
  const dragPlaylistIndexRef = useRef(null);
  const songTransitionRef = useRef(false);

  /* =========================
     MUSIC
  ========================= */

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(() =>
    loadSaved("sonora_volume", 70)
  );
  const [isMuted, setIsMuted] = useState(false);
  const [playerExpanded, setPlayerExpanded] = useState(false);

  const previousVolumeRef = useRef(70);

  /* =========================
     NAVIGATION
  ========================= */

  const [activePage, setActivePage] = useState("home");

  /* =========================
     SEARCH
  ========================= */

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState(null);

  const [searchHistory, setSearchHistory] = useState(() => {
  try {
    return JSON.parse(
      localStorage.getItem("sonora_search_history") || "[]"
    );
  } catch {
    return [];
  }
});

const [searchFocused, setSearchFocused] = useState(false);

  /* =========================
     PHASE 1 STORAGE
  ========================= */

  const [likedSongs, setLikedSongs] = useState(() =>
    loadSaved("sonora_liked_songs", [])
  );

  const [recentlyPlayed, setRecentlyPlayed] = useState(() =>
    loadSaved("sonora_recently_played", [])
  );

  const [playlists, setPlaylists] = useState(() =>
    loadSaved("sonora_playlists", [])
  );

  const [playlistName, setPlaylistName] = useState("");
  const [playlistSong, setPlaylistSong] = useState(null);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editingPlaylistName, setEditingPlaylistName] = useState("");

  /* =========================
     PHASE 2 PLAYER
  ========================= */

  const [queue, setQueue] = useState(() =>
    loadSaved("sonora_queue", [])
  );

  const [history, setHistory] = useState(() =>
    loadSaved("sonora_history", [])
  );

  const [shuffleEnabled, setShuffleEnabled] = useState(() =>
    loadSaved("sonora_shuffle", false)
  );

  /*
    repeatMode:
    off = stop at end
    all = continue from beginning
    one = repeat current song
  */
  const [repeatMode, setRepeatMode] = useState(() =>
    loadSaved("sonora_repeat", "off")
  );

  const [queueOpen, setQueueOpen] = useState(false);

  /* =========================
   LIVE PLAYER REFERENCES
========================= */

useEffect(() => {
  queueRef.current = queue;
}, [queue]);

useEffect(() => {
  currentSongRef.current = currentSong;
}, [currentSong]);

useEffect(() => {
  songsRef.current = songs;
}, [songs]);

useEffect(() => {
  repeatModeRef.current = repeatMode;
}, [repeatMode]);

useEffect(() => {
  shuffleRef.current = shuffleEnabled;
}, [shuffleEnabled]);

  /* =========================
     SAVE DATA
  ========================= */

  useEffect(() => {
    saveData("sonora_liked_songs", likedSongs);
  }, [likedSongs]);

  useEffect(() => {
    saveData("sonora_recently_played", recentlyPlayed);
  }, [recentlyPlayed]);

  useEffect(() => {
    saveData("sonora_playlists", playlists);
  }, [playlists]);

  useEffect(() => {
    saveData("sonora_volume", volume);
  }, [volume]);

  useEffect(() => {
    saveData("sonora_queue", queue);
  }, [queue]);

  useEffect(() => {
    saveData("sonora_history", history);
  }, [history]);

  useEffect(() => {
    saveData("sonora_shuffle", shuffleEnabled);
  }, [shuffleEnabled]);

  useEffect(() => {
    saveData("sonora_repeat", repeatMode);
  }, [repeatMode]);

  /* =========================
     PLAYLIST FUNCTIONS
  ========================= */

  const createPlaylist = () => {
    const name = playlistName.trim();

    if (!name) return;

    const newPlaylist = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      songs: [],
    };

    setPlaylists((prev) => [...prev, newPlaylist]);
    setPlaylistName("");
    setSelectedPlaylistId(newPlaylist.id);
    setActivePage("playlist");
  };

  const deletePlaylist = (id) => {
    setPlaylists((prev) =>
      prev.filter((playlist) => playlist.id !== id)
    );

    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
      setActivePage("library");
    }
  };

  const addSongToPlaylist = (playlistId, song) => {
    if (!song) return;

    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;

        const alreadyAdded = playlist.songs.some(
          (item) => item.id === song.id
        );

        if (alreadyAdded) return playlist;

        return {
          ...playlist,
          songs: [...playlist.songs, song],
        };
      })
    );

    setPlaylistSong(null);
    setPlaylistModalOpen(false);
  };

  const removeSongFromPlaylist = (playlistId, songId) => {
  setPlaylists((prev) =>
    prev.map((playlist) =>
      playlist.id === playlistId
        ? {
            ...playlist,
            songs: playlist.songs.filter(
              (song) => song.id !== songId
            ),
          }
        : playlist
    )
  );
};

/* =========================
   PHASE 3.2
   PLAYLIST REORDER
========================= */

const reorderPlaylistSongs = (
  playlistId,
  fromIndex,
  toIndex
) => {
  if (
    fromIndex === null ||
    toIndex === null ||
    fromIndex === toIndex
  ) {
    return;
  }

  setPlaylists((prev) =>
    prev.map((playlist) => {
      if (playlist.id !== playlistId) {
        return playlist;
      }

      const updatedSongs = [...playlist.songs];

      const [movedSong] = updatedSongs.splice(
        fromIndex,
        1
      );

      updatedSongs.splice(
        toIndex,
        0,
        movedSong
      );

      return {
        ...playlist,
        songs: updatedSongs,
      };
    })
  );
};

const movePlaylistSong = (
  playlistId,
  songIndex,
  direction
) => {
  const newIndex = songIndex + direction;

  setPlaylists((prev) =>
    prev.map((playlist) => {
      if (playlist.id !== playlistId) {
        return playlist;
      }

      if (
        newIndex < 0 ||
        newIndex >= playlist.songs.length
      ) {
        return playlist;
      }

      const updatedSongs = [...playlist.songs];

      [
        updatedSongs[songIndex],
        updatedSongs[newIndex],
      ] = [
        updatedSongs[newIndex],
        updatedSongs[songIndex],
      ];

      return {
        ...playlist,
        songs: updatedSongs,
      };
    })
  );
};

const handlePlaylistDragStart = (
  event,
  index
) => {
  dragPlaylistIndexRef.current = index;

  event.dataTransfer.effectAllowed = "move";

  event.dataTransfer.setData(
    "text/plain",
    String(index)
  );
};

const handlePlaylistDragOver = (event) => {
  event.preventDefault();

  event.dataTransfer.dropEffect = "move";
};

const handlePlaylistDrop = (
  event,
  playlistId,
  dropIndex
) => {
  event.preventDefault();

  const fromIndex =
    dragPlaylistIndexRef.current;

  reorderPlaylistSongs(
    playlistId,
    fromIndex,
    dropIndex
  );

  dragPlaylistIndexRef.current = null;
};

const handlePlaylistDragEnd = () => {
  dragPlaylistIndexRef.current = null;
};

  const openPlaylistPicker = (song) => {
    setPlaylistSong(song);
    setPlaylistModalOpen(true);
  };

  const openPlaylist = (id) => {
    setSelectedPlaylistId(id);
    setActivePage("playlist");
  };
  /* =========================
   PLAYLIST PHASE 3.1
========================= */

const playPlaylist = (playlist, shouldShuffle = false) => {
  if (!playlist || playlist.songs.length === 0) return;

  let playlistSongs = [...playlist.songs];

  if (shouldShuffle && playlistSongs.length > 1) {
    for (let i = playlistSongs.length - 1; i > 0; i--) {
      const randomIndex = Math.floor(Math.random() * (i + 1));

      [playlistSongs[i], playlistSongs[randomIndex]] = [
        playlistSongs[randomIndex],
        playlistSongs[i],
      ];
    }
  }

  const firstSong = playlistSongs[0];
  const remainingSongs = playlistSongs.slice(1);

  setQueue(remainingSongs);
  setQueueOpen(false);

  playSong(firstSong);
};

const addPlaylistToQueue = (playlist) => {
  if (!playlist || playlist.songs.length === 0) return;

  setQueue((prev) => {
    const existingIds = new Set(
      prev.map((song) => song.id)
    );

    const additions = playlist.songs.filter(
      (song) =>
        song.id !== currentSongRef.current?.id &&
        !existingIds.has(song.id)
    );

    return [...prev, ...additions];
  });

  setQueueOpen(true);
};

const startRenamePlaylist = (playlist) => {
  if (!playlist) return;

  setEditingPlaylistId(playlist.id);
  setEditingPlaylistName(playlist.name);
};

const cancelRenamePlaylist = () => {
  setEditingPlaylistId(null);
  setEditingPlaylistName("");
};

const savePlaylistRename = (playlistId) => {
  const newName = editingPlaylistName.trim();

  if (!newName) return;

  setPlaylists((prev) =>
    prev.map((playlist) =>
      playlist.id === playlistId
        ? {
            ...playlist,
            name: newName,
          }
        : playlist
    )
  );

  setEditingPlaylistId(null);
  setEditingPlaylistName("");
};

const getPlaylistCoverSongs = (playlist) => {
  if (!playlist || !playlist.songs) return [];

  return playlist.songs
    .filter((song) => song && song.image)
    .slice(0, 4);
};

  /* =========================
     LIKED SONGS
  ========================= */

  const toggleLikeSong = (song) => {
    if (!song) return;

    setLikedSongs((prev) => {
      const isLiked = prev.some(
        (item) => item.id === song.id
      );

      if (isLiked) {
        return prev.filter((item) => item.id !== song.id);
      }

      return [...prev, song];
    });
  };

  const isSongLiked = (song) =>
    Boolean(
      song &&
        likedSongs.some((item) => item.id === song.id)
    );

  /* =========================
     RECENTLY PLAYED
  ========================= */

  const addToRecentlyPlayed = (song) => {
    if (!song) return;

    setRecentlyPlayed((prev) => {
      const filtered = prev.filter(
        (item) => item.id !== song.id
      );

      return [song, ...filtered].slice(0, 20);
    });
  };

  /* =========================
     QUEUE FUNCTIONS
  ========================= */

  const isSongInQueue = (song) =>
    Boolean(
      song &&
        queue.some((item) => item.id === song.id)
    );

  const addToQueue = (song) => {
    if (!song) return;

    setQueue((prev) => {
      const alreadyExists = prev.some(
        (item) => item.id === song.id
      );

      if (alreadyExists) {
        return prev;
      }

      return [...prev, song];
    });
  };

  const removeFromQueue = (songId) => {
    setQueue((prev) =>
      prev.filter((song) => song.id !== songId)
    );
  };

  const clearQueue = () => {
    setQueue([]);
  };

  /* =========================
   QUEUE DRAG & DROP
========================= */

const reorderQueue = (fromIndex, toIndex) => {
  if (
    fromIndex === null ||
    toIndex === null ||
    fromIndex === toIndex
  ) {
    return;
  }

  setQueue((prev) => {
    const updatedQueue = [...prev];

    const [movedSong] = updatedQueue.splice(
      fromIndex,
      1
    );

    updatedQueue.splice(
      toIndex,
      0,
      movedSong
    );

    return updatedQueue;
  });
};

const handleQueueDragStart = (event, index) => {
  dragQueueIndexRef.current = index;

  event.dataTransfer.effectAllowed = "move";

  event.dataTransfer.setData(
    "text/plain",
    String(index)
  );
};

const handleQueueDragOver = (event) => {
  event.preventDefault();

  event.dataTransfer.dropEffect = "move";
};

const handleQueueDrop = (event, dropIndex) => {
  event.preventDefault();

  const fromIndex =
    dragQueueIndexRef.current;

  reorderQueue(
    fromIndex,
    dropIndex
  );

  dragQueueIndexRef.current = null;
};

const handleQueueDragEnd = () => {
  dragQueueIndexRef.current = null;
};


/* =========================================================
   MOBILE / TOUCH QUEUE DRAG
========================================================= */

const queuePointerRef = useRef({
  active: false,
  index: null,
  pointerId: null,
});

const handleQueuePointerDown = (event, index) => {
  if (event.pointerType === "mouse") {
    return;
  }

  queuePointerRef.current = {
    active: true,
    index,
    pointerId: event.pointerId,
  };

  event.currentTarget.setPointerCapture(
    event.pointerId
  );

  event.preventDefault();
};

const handleQueuePointerMove = (event) => {
  const drag = queuePointerRef.current;

  if (
    !drag.active ||
    drag.pointerId !== event.pointerId
  ) {
    return;
  }

  event.preventDefault();
};

const handleQueuePointerUp = (event) => {
  const drag = queuePointerRef.current;

  if (
    !drag.active ||
    drag.pointerId !== event.pointerId
  ) {
    return;
  }

  const element = document.elementFromPoint(
    event.clientX,
    event.clientY
  );

  const queueItem =
    element?.closest(".queue-song");

  if (queueItem) {
    const dropIndex = Number(
      queueItem.dataset.queueIndex
    );

    if (!Number.isNaN(dropIndex)) {
      reorderQueue(
        drag.index,
        dropIndex
      );
    }
  }

  queuePointerRef.current = {
    active: false,
    index: null,
    pointerId: null,
  };
};

const handleQueuePointerCancel = () => {
  queuePointerRef.current = {
    active: false,
    index: null,
    pointerId: null,
  };
};


  /* =========================
     SHUFFLE / REPEAT
  ========================= */

  const toggleShuffle = () => {
    setShuffleEnabled((prev) => !prev);
  };

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  };

  const getRepeatTitle = () => {
    if (repeatMode === "all") {
      return "Repeat All";
    }

    if (repeatMode === "one") {
      return "Repeat One";
    }

    return "Repeat Off";
  };

  /* =========================
     LOAD TRENDING MUSIC
  ========================= */

  useEffect(() => {
    const loadTrendingTracks = async () => {
      try {
        setLoading(true);
        setError("");

        const tracks = await searchTracks(
          "latest Trending Tamil songs"
        );

        setSongs(tracks);

        if (tracks.length > 0) {
          setCurrentSong((previous) =>
            previous || tracks[0]
          );
        }
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load Indian music. Please check your internet connection."
        );
      } finally {
        setLoading(false);
      }
    };

    loadTrendingTracks();
  }, []);

  /* =========================
     SEARCH
  ========================= */

  const handleSearch = async (event) => {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) return;

    setSearchHistory((prev) => {
  const updated = [
    query,
    ...prev.filter(
      (item) =>
        item.toLowerCase() !== query.toLowerCase()
    ),
  ].slice(0, 8);

  localStorage.setItem(
    "sonora_search_history",
    JSON.stringify(updated)
  );

  return updated;
});

    try {
      setHasSearched(true);
      setSearchLoading(true);
      setSearchError("");
      setSearchResults([]);

      const tracks = await searchTracks(query);

      setSearchResults(tracks);
    } catch (err) {
  console.error("Search failed:", err);

  if (
    err?.code ===
    "YOUTUBE_QUOTA_EXCEEDED"
  ) {
    setSearchError(
      "YouTube search is temporarily unavailable because today's search quota has been reached. Your Home and Trending music can still work."
    );
  } else {
    setSearchError(
      "Unable to search music right now. Please try again."
    );
  }
} finally {
  setSearchLoading(false);
}
  };

  /* =========================
   PLAY SONG
========================= */

const playSong = (
  song,
  {
    addHistory = true,
    addRecent = true,
  } = {}
) => {
  if (!song) return;

  if (
    addHistory &&
    currentSong &&
    currentSong.id !== song.id
  ) {
    setHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.id !== currentSong.id
      );

      return [
        ...filtered,
        currentSong,
      ].slice(-50);
    });
  }

  setCurrentSong(song);
  currentSongRef.current = song;

  if (addRecent) {
    addToRecentlyPlayed(song);
  }

  setIsPlaying(true);
  setCurrentTime(0);
  setDuration(0);

  const player = youtubePlayerRef.current;

  if (!player) return;

  try {
    player.setVolume(Number(volume));

    /*
      loadVideoById already loads AND starts
      the requested YouTube video.
    */
    player.loadVideoById(song.id);

    /*
      Mobile/tablet browsers can sometimes
      need a second play request after loading.
    */
    setTimeout(() => {
      try {
        youtubePlayerRef.current?.playVideo();
      } catch (error) {
        console.error(
          "YouTube playback retry failed:",
          error
        );
      }
    }, 250);
  } catch (error) {
    console.error(
      "Unable to load YouTube song:",
      error
    );
  }
};

  /* =========================
     NEXT SONG
  ========================= */

  const playNext = () => {
  const activeSong =
    currentSongRef.current;

  if (!activeSong) {
    return;
  }

  /*
    Prevent duplicate ended events
    from starting multiple songs.
  */
  if (songTransitionRef.current) {
    return;
  }

  songTransitionRef.current = true;

  const playNextSong = (
    nextSong,
    {
      addHistory = true,
    } = {}
  ) => {
    if (!nextSong) {
      songTransitionRef.current = false;
      return;
    }

    /*
      Add current song to history.
    */
    if (
      addHistory &&
      activeSong.id !== nextSong.id
    ) {
      setHistory((prev) => {
        const filtered =
          prev.filter(
            (item) =>
              item.id !== activeSong.id
          );

        return [
          ...filtered,
          activeSong,
        ].slice(-50);
      });
    }

    setCurrentSong(nextSong);
    currentSongRef.current =
      nextSong;

    addToRecentlyPlayed(nextSong);

    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);

    /*
      Load and immediately play
      the next YouTube song.
    */
    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.loadVideoById(
          nextSong.id
        );

        youtubePlayerRef.current.setVolume(
          Number(volume)
        );

        /*
          Small delay ensures YouTube
          starts the newly loaded video.
        */
        setTimeout(() => {
          try {
            youtubePlayerRef.current?.playVideo();
          } catch {
            // Ignore player timing errors.
          }
        }, 250);
      } catch {
        // Ignore player timing errors.
      }
    }

    setTimeout(() => {
      songTransitionRef.current = false;
    }, 500);
  };

  /*
    1. QUEUE ALWAYS HAS PRIORITY
  */
  if (queueRef.current.length > 0) {
    const nextQueueSong =
      queueRef.current[0];

    setQueue((prev) => {
      const updatedQueue =
        prev.slice(1);

      queueRef.current =
        updatedQueue;

      return updatedQueue;
    });

    playNextSong(nextQueueSong);

    return;
  }

  /*
    2. REPEAT ONE
  */
  if (
    repeatModeRef.current ===
    "one"
  ) {
    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.seekTo(
          0,
          true
        );

        youtubePlayerRef.current.playVideo();
      } catch {
        // Ignore player errors.
      }
    }

    setCurrentTime(0);
    setIsPlaying(true);

    setTimeout(() => {
      songTransitionRef.current = false;
    }, 300);

    return;
  }

  const availableSongs =
    songsRef.current;

  if (availableSongs.length === 0) {
    setIsPlaying(false);
    songTransitionRef.current = false;
    return;
  }

  const currentIndex =
    availableSongs.findIndex(
      (song) =>
        song.id === activeSong.id
    );

  /*
    3. SHUFFLE
  */
  if (
    shuffleRef.current &&
    availableSongs.length > 1
  ) {
    const otherSongs =
      availableSongs.filter(
        (song) =>
          song.id !== activeSong.id
      );

    const randomIndex =
      Math.floor(
        Math.random() *
          otherSongs.length
      );

    playNextSong(
      otherSongs[randomIndex]
    );

    return;
  }

  /*
    4. NORMAL NEXT SONG
  */
  if (
    currentIndex >= 0 &&
    currentIndex <
      availableSongs.length - 1
  ) {
    playNextSong(
      availableSongs[
        currentIndex + 1
      ]
    );

    return;
  }

  /*
    5. REPEAT ALL
  */
  if (
    repeatModeRef.current ===
    "all"
  ) {
    playNextSong(
      availableSongs[0]
    );

    return;
  }

  /*
    6. END PLAYBACK
  */
  setIsPlaying(false);
  songTransitionRef.current =
    false;
};

  /* =========================
     PREVIOUS SONG
  ========================= */

  const playPrevious = () => {
    /*
      If more than 3 seconds into song,
      restart current song.
    */
    if (
      currentTime > 3 &&
      youtubePlayerRef.current
    ) {
      youtubePlayerRef.current.seekTo(
        0,
        true
      );

      setCurrentTime(0);

      return;
    }

    /*
      Play from history first.
    */
    if (history.length > 0) {
      const previousSong =
        history[history.length - 1];

      setHistory((prev) =>
        prev.slice(0, -1)
      );

      playSong(previousSong, {
        addHistory: false,
      });

      return;
    }

    /*
      Fallback to previous song
      in current song list.
    */
    if (!currentSong || songs.length === 0) {
      return;
    }

    const currentIndex = songs.findIndex(
      (song) => song.id === currentSong.id
    );

    if (currentIndex > 0) {
      playSong(songs[currentIndex - 1]);

      return;
    }

    if (
      repeatMode === "all" &&
      songs.length > 0
    ) {
      playSong(
        songs[songs.length - 1]
      );
    }
  };

  /* =========================
     PLAYER
  ========================= */

  /* =========================
   PHASE 4.1
   MUTE / EXPANDED PLAYER
========================= */

const toggleMute = () => {
  if (isMuted) {
    const restoreVolume =
      previousVolumeRef.current || 70;

    setVolume(restoreVolume);

    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.setVolume(
          Number(restoreVolume)
        );
      } catch {
        // Ignore player timing errors.
      }
    }

    setIsMuted(false);
    return;
  }

  if (Number(volume) > 0) {
    previousVolumeRef.current =
      Number(volume);
  }

  setVolume(0);

  if (youtubePlayerRef.current) {
    try {
      youtubePlayerRef.current.setVolume(0);
    } catch {
      // Ignore player timing errors.
    }
  }

  setIsMuted(true);
};

const togglePlayerExpanded = () => {
  setPlayerExpanded((prev) => !prev);
};

  const togglePlay = () => {
  const player = youtubePlayerRef.current;

  if (!player) return;

  try {
    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
    } else {
      player.playVideo();
      setIsPlaying(true);
    }
  } catch (error) {
    console.error("Unable to control YouTube player:", error);
  }
};

  const handlePlayerReady = (event) => {
  youtubePlayerRef.current =
    event.target;

  event.target.setVolume(
    Number(volume)
  );

  if (currentSong) {
    try {
      event.target.loadVideoById(
        currentSong.id
      );

      setTimeout(() => {
        try {
          event.target.playVideo();
        } catch {
          // Ignore YouTube timing errors.
        }
      }, 300);

    } catch {
      // Player is still initializing.
    }
  }
};

  const handlePlayerStateChange = (
  event
) => {
  /*
    PLAYING
  */
  if (event.data === 1) {
    setIsPlaying(true);

    songTransitionRef.current =
      false;

    return;
  }

  /*
    PAUSED
  */
  if (event.data === 2) {
    setIsPlaying(false);

    return;
  }

  /*
    ENDED
  */
  if (event.data === 0) {
    setIsPlaying(false);

    playNext();

    return;
  }
};

  useEffect(() => {
  const updatePlayerProgress = () => {
    const player = youtubePlayerRef.current;

    if (!player) return;

    try {
      const current = Number(
        player.getCurrentTime()
      );

      const total = Number(
        player.getDuration()
      );

      if (Number.isFinite(current)) {
        setCurrentTime(current);
      }

      if (
        Number.isFinite(total) &&
        total > 0
      ) {
        setDuration(total);
      }
    } catch {
      // Player may not be ready yet.
    }
  };

  updatePlayerProgress();

  const interval = setInterval(
    updatePlayerProgress,
    500
  );

  return () => {
    clearInterval(interval);
  };
}, []);

  /* =========================================================
   AUTO PLAY WHEN CURRENT SONG CHANGES
========================================================= */

useEffect(() => {
  if (!currentSong) return;

  const timer = setTimeout(() => {
    const player = youtubePlayerRef.current;

    if (!player) return;

    try {
      player.loadVideoById(currentSong.id);

      player.setVolume(
        Number(volume)
      );

      setTimeout(() => {
        try {
          player.playVideo();
        } catch {
          // Ignore YouTube timing errors.
        }
      }, 300);

    } catch {
      // Player may still be initializing.
    }
  }, 100);

  return () => {
    clearTimeout(timer);
  };
}, [currentSong?.id]);

  useEffect(() => {
    if (!youtubePlayerRef.current) return;

    try {
      youtubePlayerRef.current.setVolume(
        Number(volume)
      );
    } catch {
      // Player not ready.
    }
  }, [volume]);

  const handleProgressChange = (event) => {
    const newTime = Number(
      event.target.value
    );

    setCurrentTime(newTime);

    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(
        newTime,
        true
      );
    }
  };

  /* =========================
   SONG CARD
========================= */

const renderSongCard = (song) => (
  <article
    className="music-card"
    key={song.id}
    onClick={() => playSong(song)}
  >
    <div className="album-container">
      <img
        src={song.image}
        alt={song.title}
        loading="lazy"
        decoding="async"
      />

      {/* PLAY BUTTON */}

      <button
        className="card-play"
        onClick={(event) => {
          event.stopPropagation();
          playSong(song);
        }}
        aria-label={`Play ${song.title}`}
      >
        <Play
          size={20}
          fill="currentColor"
        />
      </button>

      {/* LIKE BUTTON */}

      <button
        className={`card-like-button ${
          isSongLiked(song)
            ? "liked"
            : ""
        }`}
        onClick={(event) => {
          event.stopPropagation();
          toggleLikeSong(song);
        }}
        aria-label={
          isSongLiked(song)
            ? "Unlike song"
            : "Like song"
        }
      >
        <Heart
          size={18}
          fill={
            isSongLiked(song)
              ? "currentColor"
              : "none"
          }
        />
      </button>
    </div>

      {/* MORE ACTIONS */}
      <div className="card-more-wrapper">
        <button
          type="button"
          className={`card-more-button ${
            openCardMenuId === song.id
              ? "active"
              : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();

            setOpenCardMenuId((prev) =>
              prev === song.id
                ? null
                : song.id
            );
          }}
          aria-label="More actions"
          aria-expanded={
            openCardMenuId === song.id
          }
        >
          <MoreHorizontal size={19} />
        </button>

        {openCardMenuId === song.id && (
          <div
            className="card-action-menu"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* ADD TO QUEUE */}

            <button
              type="button"
              className="card-action-item"
              onClick={() => {
                if (isSongInQueue(song)) {
                  removeFromQueue(song.id);
                } else {
                  addToQueue(song);
                }

                setOpenCardMenuId(null);
              }}
            >
              <ListPlus size={17} />

              <span>
                {isSongInQueue(song)
                  ? "Remove from Queue"
                  : "Add to Queue"}
              </span>
            </button>

            {/* ADD TO PLAYLIST */}

            <button
              type="button"
              className="card-action-item"
              onClick={() => {
                setOpenCardMenuId(null);
                openPlaylistPicker(song);
              }}
            >
              <Plus size={17} />

              <span>
                Add to Playlist
              </span>
            </button>
          </div>
        )}
      </div>
  

    {/* SONG INFORMATION */}

    <div className="music-card-info">
      <h3
        title={song.title}
      >
        {song.title}
      </h3>

      <p
        title={song.artist}
      >
        {song.artist}
      </p>
    </div>
  </article>
);

  /* =========================
     APP UI
  ========================= */

  return (
    <div className="app">
      {/* HIDDEN YOUTUBE AUDIO PLAYER */}
<div
  className="youtube-player-hidden"
  aria-hidden="true"
>
  <YouTube
    videoId={currentSong?.id}
    opts={{
      width: "1",
      height: "1",
      playerVars: {
        autoplay: 0,
        controls: 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
      },
    }}
    onReady={handlePlayerReady}
    onStateChange={handlePlayerStateChange}
  />
</div>

      {/* =========================
          SIDEBAR
      ========================= */}

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">
            S
          </div>

          <span>SONORA</span>
        </div>

        <div className="navigation">
          <button
            className={`nav-item ${
              activePage === "home"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("home")
            }
          >
            <Home size={20} />
            <span>Home</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "search"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("search")
            }
          >
            <Search size={20} />
            <span>Search</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "library"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("library")
            }
          >
            <Library size={20} />
            <span>Your Library</span>
          </button>
        </div>

        <div className="sidebar-library">
          <div className="library-title">
            <span>Your Music</span>

            <button
              className="icon-only-button"
              type="button"
              onClick={() =>
                setActivePage(
                  "create-playlist"
                )
              }
            >
              <Plus size={19} />
            </button>
          </div>

          <button
            className={`nav-item ${
              activePage === "liked"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("liked")
            }
          >
            <Heart size={20} />
            <span>Liked Songs</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "recent"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("recent")
            }
          >
            <Clock size={20} />
            <span>
              Recently Played
            </span>
          </button>

          <button
            className="nav-item"
            onClick={() =>
              setQueueOpen(true)
            }
          >
            <ListEnd size={20} />
            <span>
              Queue
              {queue.length > 0
                ? ` (${queue.length})`
                : ""}
            </span>
          </button>

          {playlists.slice(0, 5).map(
            (playlist) => (
              <button
                key={playlist.id}
                className={`nav-item playlist-nav-item ${
                  activePage ===
                    "playlist" &&
                  selectedPlaylistId ===
                    playlist.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  openPlaylist(
                    playlist.id
                  )
                }
              >
                <ListMusic size={18} />

                <span>
                  {playlist.name}
                </span>
              </button>
            )
          )}
        </div>
      </aside>

      {/* =========================
          MAIN
      ========================= */}

      <main
  className={`main-content page-transition page-${activePage}`}
  key={activePage}
>
        <header className="topbar">
          <div className="topbar-navigation">
            <button
              type="button"
              className="topbar-icon"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              className="topbar-icon"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </header>

        {/* HOME */}

        {activePage === "home" && (
          <section className="home-page">
            <div className="hero">
              <div>
                <p className="hero-kicker">
                  DISCOVER INDIAN MUSIC
                </p>

                <h1>
                  Feel Every
                  <br />
                  Beat.
                </h1>

                <p className="hero-description">
                  Discover trending Indian
                  songs and listen to your
                  favorite music.
                </p>

                <button
                  className="hero-button"
                  onClick={() => {
                    if (songs.length > 0) {
                      playSong(songs[0]);
                    }
                  }}
                >
                  <Play
                    size={18}
                    fill="currentColor"
                  />
                  Play Now
                </button>
              </div>
            </div>

            <div className="section-heading trending-heading">
  <div>
    <span className="trending-label">🔥 TRENDING</span>
    <h2>Trending Now</h2>
    <p>Popular tamil music right now</p>
  </div>
</div>

            {loading && (
              <div className="loading-state">
                Loading music...
              </div>
            )}

            {error && (
              <div className="error-state">
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              songs.length > 0 && (
                <div className="music-grid">
                  {songs.map(
                    renderSongCard
                  )}
                </div>
              )}
          </section>
        )}

        {/* SEARCH */}

        {activePage === "search" && (
          <section className="search-page">
            <div className="search-header">
              <h1>Search</h1>

              <p>
                Find your favorite songs,
                artists and music.
              </p>
            </div>

            <form
              className="search-form"
              onSubmit={handleSearch}
            >
              <Search size={21} />

              <input
  type="text"
  placeholder="Search songs, artists..."
  value={searchQuery}
  onChange={(event) =>
    setSearchQuery(event.target.value)
  }
  onFocus={() => setSearchFocused(true)}
  onBlur={() => {
    setTimeout(() => {
      setSearchFocused(false);
    }, 150);
  }}
/>

              <button type="submit">
                Search
              </button>
            </form>

            {searchFocused &&
  !searchQuery.trim() &&
  !hasSearched && (
    <div className="search-suggestions">
      <div className="search-suggestions-header">
        <span>Recent Searches</span>

        {searchHistory.length > 0 && (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();

              setSearchHistory([]);

              localStorage.removeItem(
                "sonora_search_history"
              );
            }}
          >
            Clear
          </button>
        )}
      </div>

      {searchHistory.length > 0 ? (
        <div className="search-history-list">
          {searchHistory.map((item, index) => (
            <button
              key={`${item}-${index}`}
              type="button"
              className="search-suggestion-item"
              onMouseDown={(event) => {
                event.preventDefault();

                setSearchQuery(item);
                setSearchFocused(false);

                setTimeout(() => {
                  document
                    .querySelector(".search-form")
                    ?.requestSubmit();
                }, 0);
              }}
            >
              <Clock size={16} />

              <span>{item}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="search-empty-suggestions">
          <Search size={18} />

          <span>
            Your recent searches will appear here
          </span>
        </div>
      )}
    </div>
  )}

            {searchLoading && (
  <div className="search-loading-section">
    <div className="search-loading-header">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-count" />
    </div>

    <div className="music-grid search-skeleton-grid">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          className="music-card search-skeleton-card"
          key={`search-skeleton-${index}`}
        >
          <div className="skeleton-artwork" />

          <div className="skeleton-info">
            <div className="skeleton-line skeleton-song" />
            <div className="skeleton-line skeleton-artist" />
          </div>
        </div>
      ))}
    </div>
  </div>
)}

            {searchError && (
              <div className="error-state">
                {searchError}
              </div>
            )}

            {hasSearched &&
  !searchLoading &&
  !searchError &&
  searchResults.length === 0 && (
    <div className="search-empty-state">
      <div className="search-empty-icon">
        <Search size={30} />
      </div>

      <h2>
        No music found
      </h2>

      <p>
        We couldn't find anything for
        <strong>
          "{searchQuery.trim()}"
        </strong>
      </p>

      <span>
        Try searching for a song, artist,
        or another keyword.
      </span>

      <button
        type="button"
        onClick={() => {
          setSearchQuery("");
          setHasSearched(false);
          setSearchResults([]);
          setSearchError("");
        }}
      >
        <Search size={16} />
        Try Another Search
      </button>
    </div>
  )}

            {searchResults.length > 0 && (
              <div className="music-grid">
                {searchResults.map(
                  renderSongCard
                )}
              </div>
            )}
          </section>
        )}

        {/* LIBRARY */}

        {activePage === "library" && (
          <section className="library-page">
            <div className="search-header">
              <h1>Your Library</h1>

              <p>
                All your music in one
                place.
              </p>
            </div>

            <div className="playlist-library-section">
              <div className="section-header">
                <div>
                  <h2>
                    Your Playlists
                  </h2>

                  <p>
                    Create collections for
                    every mood.
                  </p>
                </div>

                <button
                  className="create-playlist-button"
                  type="button"
                  onClick={() =>
                    setActivePage(
                      "create-playlist"
                    )
                  }
                >
                  <PlusCircle size={18} />
                  Create Playlist
                </button>
              </div>

              {playlists.length === 0 ? (
                <div className="playlist-empty">
                  <ListMusic size={38} />

                  <div>
                    <h3>
                      No playlists yet
                    </h3>

                    <p>
                      Create your first
                      playlist and start
                      adding songs.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="playlist-grid">
                  {playlists.map((playlist) => {
  const coverSongs = getPlaylistCoverSongs(playlist);

  return (
    <button
      type="button"
      key={playlist.id}
      className="playlist-card"
      onClick={() => openPlaylist(playlist.id)}
    >
      <div className="playlist-card-cover">
        {coverSongs.length === 0 ? (
          <div className="playlist-cover-empty">
            <ListMusic size={32} />
          </div>
        ) : (
          <div className="playlist-cover-grid">
            {coverSongs.map((song) => (
              <img
                key={song.id}
                src={song.image}
                alt=""
              />
            ))}
          </div>
        )}
      </div>

      <h3>{playlist.name}</h3>

      <p>
        {playlist.songs.length}{" "}
        {playlist.songs.length === 1
          ? "song"
          : "songs"}
      </p>
    </button>
  );
})}
                </div>
              )}
            </div>

            <div className="library-quick-actions">
              <button
                type="button"
                onClick={() =>
                  setActivePage("liked")
                }
              >
                <Heart size={24} />

                <div>
                  <strong>
                    Liked Songs
                  </strong>

                  <span>
                    {likedSongs.length}{" "}
                    songs
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActivePage("recent")
                }
              >
                <Clock size={24} />

                <div>
                  <strong>
                    Recently Played
                  </strong>

                  <span>
                    {
                      recentlyPlayed.length
                    }{" "}
                    songs
                  </span>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* LIKED */}

        {activePage === "liked" && (
          <section className="liked-page">
            <div className="search-header">
              <h1>Liked Songs</h1>

              <p>
                {likedSongs.length}{" "}
                {likedSongs.length === 1
                  ? "song"
                  : "songs"}
              </p>
            </div>

            {likedSongs.length === 0 ? (
              <div className="empty-library">
                <Heart size={50} />

                <h2>
                  No liked songs yet
                </h2>

                <p>
                  Like songs to save them
                  here.
                </p>
              </div>
            ) : (
              <div className="music-grid library-song-grid">
                {likedSongs.map(
                  renderSongCard
                )}
              </div>
            )}
          </section>
        )}

        {/* RECENT */}

        {activePage === "recent" && (
          <section className="recent-page">
            <div className="search-header">
              <h1>
                Recently Played
              </h1>

              <p>
                Your latest listening
                history.
              </p>
            </div>

            {recentlyPlayed.length ===
            0 ? (
              <div className="empty-library">
                <Clock size={50} />

                <h2>
                  Nothing played yet
                </h2>

                <p>
                  Play a song and it will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="music-grid library-song-grid">
                {recentlyPlayed.map(
                  renderSongCard
                )}
              </div>
            )}
          </section>
        )}

        {/* CREATE PLAYLIST */}

        {activePage ===
          "create-playlist" && (
          <section className="playlist-page">
            <div className="search-header">
              <h1>
                Create Playlist
              </h1>

              <p>
                Give your new music
                collection a name.
              </p>
            </div>

            <div className="create-playlist-panel">
              <ListMusic size={42} />

              <input
                type="text"
                placeholder="My awesome playlist"
                value={playlistName}
                onChange={(event) =>
                  setPlaylistName(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    createPlaylist();
                  }
                }}
                autoFocus
              />

              <div className="create-playlist-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setActivePage(
                      "library"
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    createPlaylist
                  }
                  disabled={
                    !playlistName.trim()
                  }
                >
                  Create Playlist
                </button>
              </div>
            </div>
          </section>
        )}

        {/* PLAYLIST */}

        {activePage === "playlist" &&
          (() => {
            const playlist =
              playlists.find(
                (item) =>
                  item.id ===
                  selectedPlaylistId
              );

            if (!playlist) {
              return (
                <section className="playlist-page">
                  <div className="empty-library">
                    <ListMusic size={50} />

                    <h2>
                      Playlist not found
                    </h2>

                    <button
                      onClick={() =>
                        setActivePage(
                          "library"
                        )
                      }
                    >
                      Back to Library
                    </button>
                  </div>
                </section>
              );
            }

            return (
              <section className="playlist-page">
                <div className="playlist-page-header">

  <div className="playlist-large-cover">
    {getPlaylistCoverSongs(playlist).length === 0 ? (
      <div className="playlist-large-cover-empty">
        <ListMusic size={48} />
      </div>
    ) : (
      <div className="playlist-large-cover-grid">
        {getPlaylistCoverSongs(playlist).map((song) => (
          <img
            key={song.id}
            src={song.image}
            alt=""
          />
        ))}
      </div>
    )}
  </div>

  <div className="playlist-header-info">

    <p className="playlist-label">
      PLAYLIST
    </p>

    {editingPlaylistId === playlist.id ? (
      <div className="playlist-rename-box">

        <input
          type="text"
          value={editingPlaylistName}
          onChange={(event) =>
            setEditingPlaylistName(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              savePlaylistRename(playlist.id);
            }

            if (event.key === "Escape") {
              cancelRenamePlaylist();
            }
          }}
          autoFocus
        />

        <button
          type="button"
          className="playlist-save-name"
          onClick={() =>
            savePlaylistRename(playlist.id)
          }
        >
          Save
        </button>

        <button
          type="button"
          className="playlist-cancel-name"
          onClick={cancelRenamePlaylist}
        >
          Cancel
        </button>

      </div>
    ) : (
      <div className="playlist-title-row">

        <h1>{playlist.name}</h1>

        <button
          type="button"
          className="rename-playlist-button"
          onClick={() =>
            startRenamePlaylist(playlist)
          }
          title="Rename playlist"
        >
          <Pencil size={18} />
        </button>

      </div>
    )}

    <span>
      {playlist.songs.length}{" "}
      {playlist.songs.length === 1
        ? "song"
        : "songs"}
    </span>

  </div>

  <div className="playlist-header-actions">

    <button
      type="button"
      className="playlist-action-button primary"
      disabled={playlist.songs.length === 0}
      onClick={() =>
        playPlaylist(playlist, false)
      }
    >
      <Play
        size={18}
        fill="currentColor"
      />
      Play All
    </button>

    <button
      type="button"
      className="playlist-action-button"
      disabled={playlist.songs.length === 0}
      onClick={() =>
        playPlaylist(playlist, true)
      }
    >
      <Shuffle size={18} />
      Shuffle
    </button>

    <button
      type="button"
      className="playlist-action-button"
      disabled={playlist.songs.length === 0}
      onClick={() =>
        addPlaylistToQueue(playlist)
      }
    >
      <ListPlus size={18} />
      Add to Queue
    </button>

    <button
      type="button"
      className="delete-playlist-button"
      onClick={() =>
        deletePlaylist(playlist.id)
      }
    >
      <Trash2 size={18} />
      Delete
    </button>

  </div>

</div>
                {playlist.songs.length ===
                0 ? (
                  <div className="empty-library">
                    <ListMusic
                      size={50}
                    />

                    <h2>
                      This playlist is
                      empty
                    </h2>

                    <p>
                      Add songs from
                      Trending, Search, or
                      your Library.
                    </p>

                    <button
                      onClick={() =>
                        setActivePage(
                          "search"
                        )
                      }
                    >
                      Search Music
                    </button>
                  </div>
                ) : (
                  <div className="music-grid library-song-grid playlist-song-grid">
  {playlist.songs.map(
    (song, index) => (
      <article
        className="music-card playlist-song-card"
        key={song.id}
        onClick={() =>
          playSong(song)
        }
        onDragOver={
          handlePlaylistDragOver
        }
        onDrop={(event) =>
          handlePlaylistDrop(
            event,
            playlist.id,
            index
          )
        }
      >
        {/* DRAG HANDLE */}

        <div
          className="playlist-drag-handle"
          draggable
          onDragStart={(event) =>
            handlePlaylistDragStart(
              event,
              index
            )
          }
          onDragEnd={
            handlePlaylistDragEnd
          }
          onClick={(event) =>
            event.stopPropagation()
          }
          title="Drag to reorder"
        >
          <GripVertical size={19} />
        </div>

        <div className="album-container">
          <img
            src={song.image}
            alt={song.title}
            loading="lazy"
            decoding="async"
          />

          {/* PLAY */}

          <button
            className="card-play"
            onClick={(event) => {
              event.stopPropagation();

              playSong(song);
            }}
            aria-label={`Play ${song.title}`}
          >
            <Play
              size={20}
              fill="currentColor"
            />
          </button>

          {/* REMOVE FROM PLAYLIST */}

          <button
            className="card-remove-button"
            onClick={(event) => {
              event.stopPropagation();

              removeSongFromPlaylist(
                playlist.id,
                song.id
              );
            }}
            aria-label="Remove from playlist"
          >
            <X size={18} />
          </button>

          {/* QUEUE */}

          <button
            className={`card-queue-button ${
              isSongInQueue(song)
                ? "queued"
                : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();

              if (
                isSongInQueue(song)
              ) {
                removeFromQueue(
                  song.id
                );
              } else {
                addToQueue(song);
              }
            }}
            aria-label="Add to queue"
          >
            <ListPlus size={17} />
          </button>
        </div>

        <div className="playlist-song-info">
  <div className="playlist-song-text">
    <h3>{song.title}</h3>

    <p>{song.artist}</p>
  </div>
</div>
      </article>
    )
  )}
</div>
                )}
              </section>
            );
          })()}
      </main>

      {/* =========================
          ADD TO PLAYLIST MODAL
      ========================= */}

      {playlistModalOpen && (
        <div
          className="playlist-modal-backdrop"
          onClick={() =>
            setPlaylistModalOpen(false)
          }
        >
          <div
            className="playlist-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="modal-close"
              type="button"
              onClick={() =>
                setPlaylistModalOpen(false)
              }
            >
              <X size={20} />
            </button>

            <h2>
              Add to Playlist
            </h2>

            <p className="modal-song-name">
              {playlistSong?.title ||
                "Selected song"}
            </p>

            {playlists.length === 0 ? (
              <div className="modal-empty">
                <p>
                  Create a playlist
                  first.
                </p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setPlaylistModalOpen(
                      false
                    );

                    setActivePage(
                      "create-playlist"
                    );
                  }}
                >
                  Create Playlist
                </button>
              </div>
            ) : (
              <div className="playlist-picker-list">
                {playlists.map(
                  (playlist) => {
                    const alreadyAdded =
                      playlist.songs.some(
                        (song) =>
                          song.id ===
                          playlistSong?.id
                      );

                    return (
                      <button
                        type="button"
                        key={
                          playlist.id
                        }
                        className="playlist-picker-item"
                        disabled={
                          alreadyAdded
                        }
                        onClick={() =>
                          addSongToPlaylist(
                            playlist.id,
                            playlistSong
                          )
                        }
                      >
                        <ListMusic
                          size={20}
                        />

                        <span>
                          {
                            playlist.name
                          }
                        </span>

                        <small>
                          {alreadyAdded
                            ? "Added"
                            : "Add"}
                        </small>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================
          QUEUE PANEL
      ========================= */}

      {queueOpen && (
        <div
          className="queue-backdrop"
          onClick={() =>
            setQueueOpen(false)
          }
        >
          <div
            className="queue-panel"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="queue-header">
              <div>
                <h2>Queue</h2>

                <p>
                  {queue.length}{" "}
                  {queue.length === 1
                    ? "song"
                    : "songs"}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setQueueOpen(false)
                }
              >
                <X size={21} />
              </button>
            </div>

            {queue.length === 0 ? (
              <div className="queue-empty">
                <ListEnd size={48} />

                <h3>
                  Your queue is empty
                </h3>

                <p>
                  Add songs using the
                  queue button.
                </p>
              </div>
            ) : (
              <>
                <div className="queue-list">
  {queue.map(
    (song, index) => (
      <div
  className="queue-song"
  key={`${song.id}-${index}`}
  data-queue-index={index}
  draggable
  onDragStart={(event) =>
    handleQueueDragStart(
      event,
      index
    )
  }
  onDragOver={
    handleQueueDragOver
  }
  onDrop={(event) =>
    handleQueueDrop(
      event,
      index
    )
  }
  onDragEnd={
    handleQueueDragEnd
  }
>
        {/* Drag Handle */}

        <div
  className="queue-drag-handle"
  title="Drag to reorder"

  onPointerDown={(event) =>
    handleQueuePointerDown(
      event,
      index
    )
  }

  onPointerMove={
    handleQueuePointerMove
  }

  onPointerUp={
    handleQueuePointerUp
  }

  onPointerCancel={
    handleQueuePointerCancel
  }
>
  <GripVertical size={20} />
</div>

        {/* Song */}

        <button
          type="button"
          className="queue-song-main"
          onClick={() => {
  setQueue((prev) => {
    const clickedSong = prev[index];

    if (!clickedSong) {
      return prev;
    }

    const updatedQueue = [
      clickedSong,
      ...prev.filter(
        (_, songIndex) =>
          songIndex !== index
      ),
    ];

    queueRef.current = updatedQueue;

    return updatedQueue;
  });

  playSong(song);
}}
        >
          <img
            src={song.image}
            alt={song.title}
            loading="lazy"
            decoding="async"
          />

          <div>
            <h4>
              {song.title}
            </h4>

            <p>
              {song.artist}
            </p>
          </div>
        </button>

        {/* Remove */}

        <button
          type="button"
          className="queue-remove"
          onClick={() =>
            setQueue((prev) => {
              const updatedQueue =
                prev.filter(
                  (
                    _,
                    songIndex
                  ) =>
                    songIndex !==
                    index
                );

              queueRef.current =
                updatedQueue;

              return updatedQueue;
            })
          }
          title="Remove from queue"
        >
          <X size={18} />
        </button>
      </div>
    )
  )}
</div>

                <button
                  type="button"
                  className="clear-queue-button"
                  onClick={clearQueue}
                >
                  <Trash2 size={17} />
                  Clear Queue
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================
          PLAYER
      ========================= */}

      {currentSong && (
        <footer
  className={`player ${
    playerExpanded
      ? "player-expanded"
      : ""
  }`}
  style={
    playerExpanded && currentSong?.image
      ? {
          "--player-artwork": `url("${currentSong.image}")`,
        }
      : undefined
  }
>
  {/* =========================
      CURRENT SONG
  ========================= */}

  <div className="now-playing">
    {playerExpanded && (
  <button
    type="button"
    className="expanded-player-close"
    onClick={togglePlayerExpanded}
    title="Minimize Player"
  >
    <Minimize2 size={21} />
  </button>
)}
    <img
      src={currentSong.image}
      alt={currentSong.title}
    />

    <div>
      <h4>
        {currentSong.title}
      </h4>

      <p>
        {currentSong.artist}
      </p>
    </div>

    <button
      type="button"
      className={`player-like ${
        isSongLiked(currentSong)
          ? "liked"
          : ""
      }`}
      onClick={() =>
        toggleLikeSong(currentSong)
      }
      title={
        isSongLiked(currentSong)
          ? "Remove from Liked Songs"
          : "Add to Liked Songs"
      }
    >
      <Heart
        size={19}
        fill={
          isSongLiked(currentSong)
            ? "currentColor"
            : "none"
        }
      />
    </button>
  </div>

  {/* =========================
      CENTER CONTROLS
  ========================= */}

  <div className="player-center">

    <div className="player-controls">

      {/* SHUFFLE */}

      <button
        type="button"
        className={`player-mode-button ${
          shuffleEnabled
            ? "active-mode"
            : ""
        }`}
        onClick={toggleShuffle}
        title={
          shuffleEnabled
            ? "Shuffle On"
            : "Shuffle Off"
        }
      >
        <Shuffle size={19} />
      </button>

      {/* PREVIOUS */}

      <button
        type="button"
        onClick={playPrevious}
        title="Previous"
      >
        <SkipBack
          size={21}
          fill="currentColor"
        />
      </button>

      {/* PLAY / PAUSE */}

      <button
        type="button"
        className="main-play-button"
        onClick={togglePlay}
        title={
          isPlaying
            ? "Pause"
            : "Play"
        }
      >
        {isPlaying ? (
          <Pause
            size={21}
            fill="currentColor"
          />
        ) : (
          <Play
            size={21}
            fill="currentColor"
          />
        )}
      </button>

      {/* NEXT */}

      <button
        type="button"
        onClick={playNext}
        title="Next"
      >
        <SkipForward
          size={21}
          fill="currentColor"
        />
      </button>

      {/* REPEAT */}

      <button
        type="button"
        className={`player-mode-button ${
          repeatMode !== "off"
            ? "active-mode"
            : ""
        }`}
        onClick={cycleRepeatMode}
        title={getRepeatTitle()}
      >
        {repeatMode === "one" ? (
          <Repeat1 size={19} />
        ) : (
          <Repeat2 size={19} />
        )}
      </button>

    </div>

    {/* =========================
        PROGRESS
    ========================= */}

    <div className="progress-row">

      <span>
        {formatTime(currentTime)}
      </span>

      <input
  type="range"
  min="0"
  max={duration || 0}
  value={Math.min(currentTime, duration || 0)}
  onChange={handleProgressChange}
  aria-label="Song progress"
  style={{
    "--progress": `${
      duration > 0
        ? Math.min(
            100,
            Math.max(0, (currentTime / duration) * 100)
          )
        : 0
    }%`,
  }}
/>

      <span>
        {formatTime(duration)}
      </span>

    </div>

  </div>

  {/* =========================
      EXTRA CONTROLS
  ========================= */}

  <div className="player-extra">

    {/* QUEUE */}

    <button
      type="button"
      className={`queue-toggle-button ${
        queue.length > 0
          ? "queue-has-items"
          : ""
      }`}
      onClick={() =>
        setQueueOpen(true)
      }
      title="Open Queue"
    >
      <ListEnd size={20} />

      {queue.length > 0 && (
        <span>
          {queue.length}
        </span>
      )}
    </button>

    {/* MUTE */}

    <button
      type="button"
      className="player-icon-button"
      onClick={toggleMute}
      title={
        isMuted
          ? "Unmute"
          : "Mute"
      }
    >
      {isMuted ? (
        <VolumeX size={20} />
      ) : (
        <Volume2 size={20} />
      )}
    </button>

    {/* VOLUME */}

    <input
  className="player-volume-slider"
  type="range"
  min="0"
  max="100"
  value={volume}
  onChange={(event) => {
    const newVolume = Number(event.target.value);

    setVolume(newVolume);

    if (newVolume > 0) {
      previousVolumeRef.current = newVolume;
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  }}
  aria-label="Volume"
  style={{
    "--volume": `${Number(volume)}%`,
  }}
/>

    {/* EXPAND */}

    <button
      type="button"
      className="player-icon-button"
      onClick={togglePlayerExpanded}
      title={
        playerExpanded
          ? "Minimize Player"
          : "Expand Player"
      }
    >
      {playerExpanded ? (
        <Minimize2 size={19} />
      ) : (
        <Maximize2 size={19} />
      )}
    </button>

  </div>

</footer>
      )}
    </div>
  );
}

export default App;
