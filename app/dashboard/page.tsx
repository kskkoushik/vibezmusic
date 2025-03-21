"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Home,
  Search,
  Library,
  Heart,
  Music2,
  LogOut,
  User,
  Settings,
  Sparkles,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Loader2,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Define types for Spotify API responses
interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  artists: SpotifyArtist[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  type: string;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  images: SpotifyImage[];
  type: string;
  tracks: {
    total: number;
  };
}

interface SpotifyUserProfile {
  id: string;
  display_name: string;
  images: SpotifyImage[];
  product: string;
}

interface SpotifyCurrentlyPlaying {
  item: SpotifyTrack;
  is_playing: boolean;
  progress_ms: number;
  device: {
    volume_percent: number;
  };
}

// Spotify API utility with improved error handling
const spotifyApi = {
  base_url: "https://api.spotify.com/v1",
  async makeRequest(
    endpoint: string,
    token: string,
    method = "GET",
    body: Record<string, unknown> | null = null
  ): Promise<unknown> {
    try {
      console.log(`Making request to ${endpoint}`);
      const res = await fetch(`${spotifyApi.base_url}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      // Handle 204 No Content responses immediately
      if (res.status === 204) {
        return null;
      }

      // Handle 404 Not Found for specific endpoints
      if (res.status === 404) {
        // For currently-playing endpoint, it's normal to get 404 when nothing is playing
        if (endpoint.includes("/me/player/currently-playing")) {
          return null;
        }

        // For other endpoints, throw a more specific error
        throw new Error(`Resource not found: ${endpoint}`);
      }

      if (!res.ok) {
        // Get error details
        let errorData;
        try {
          const errorText = await res.text();
          errorData = errorText ? JSON.parse(errorText) : null;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (parseError) {
          errorData = res.statusText || `Status: ${res.status}`;
        }

        const errorMessage =
          errorData?.error?.message ||
          errorData?.error_description ||
          errorData ||
          `Spotify API error: ${res.status}`;

        throw new Error(errorMessage);
      }

      // Safely parse JSON
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (error: unknown) {
      console.error(`Spotify API request failed for ${endpoint}:`, error);
      throw error; // Re-throw to be caught in component
    }
  },
};

const clientId = "2f1116716c70466d86841e0433d4c25d";
const redirectUri = "https://vibezmusic.vercel.app/dashboard"; // Make sure this matches your actual redirect URI

const redirectToAuthCodeFlow = async (): Promise<void> => {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  // Save to localStorage
  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  params.append("redirect_uri", redirectUri);
  params.append(
    "scope",
    [
      "user-read-private",
      "user-read-email",
      "user-library-read",
      "user-read-currently-playing",
      "user-read-recently-played",
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-top-read",
      "user-modify-playback-state",
      "user-read-playback-state",
    ].join(" ")
  );

  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
};

const generateCodeVerifier = (length: number): string => {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(digest))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// Format time for display
const formatTime = (ms: number): string => {
  if (isNaN(ms)) return "0:00"; // Handle invalid ms
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export default function Dashboard() {
  const isMobile = useMobile();
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  //const [moodSearch, setMoodSearch] = useState("");
  const [activeTab, setActiveTab] = useState("discover");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Spotify user data
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<SpotifyUserProfile | null>(
    null
  );
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyTrack[]>([]);
  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([]);
  const [likedSongs, setLikedSongs] = useState<SpotifyTrack[]>([]);
  const [volume, setVolume] = useState(80);
  const [trackProgress, setTrackProgress] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [hasActiveDevice, setHasActiveDevice] = useState(false);

  // Spotify oEmbed
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedHtml, setEmbedHtml] = useState<string>("");
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const embedRef = useRef<HTMLDivElement>(null);

  // Initialize Spotify token and fetch data
  useEffect(() => {
    const fetchAccessToken = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const verifier = localStorage.getItem("verifier");

      if (code && verifier) {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch("/api/spotify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, code_verifier: verifier }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = errorText ? JSON.parse(errorText) : null;
            } catch (e) {
              errorData = { error_description: e || "Unknown error" };
            }
            throw new Error(
              errorData?.error_description || "Failed to fetch access token"
            );
          }

          const text = await response.text();
          const data = text ? JSON.parse(text) : {};

          if (data.access_token) {
            console.log("Access token received");
            setSpotifyToken(data.access_token);
            localStorage.removeItem("verifier"); // Clear verifier
          } else {
            throw new Error("No access token received from server");
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setError(errorMessage);
          console.error("Error fetching access token:", error);
        } finally {
          setLoading(false);
        }
      } else {
        // Check if we have a token in localStorage (for persistence)
        const savedToken = localStorage.getItem("spotify_token");
        if (savedToken) {
          setSpotifyToken(savedToken);
        }
      }
    };

    fetchAccessToken();
  }, []);

  // Save token to localStorage when it changes
  useEffect(() => {
    if (spotifyToken) {
      localStorage.setItem("spotify_token", spotifyToken);
    }
  }, [spotifyToken]);

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    if (!spotifyToken) return;

    try {
      const data = await spotifyApi.makeRequest("/me", spotifyToken);
      if (data) {
        setUserProfile(data as SpotifyUserProfile);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching user profile:", error);
      if (errorMessage.includes("token expired")) {
        // Handle expired token
        localStorage.removeItem("spotify_token");
        setSpotifyToken(null);
        setError("Spotify session expired. Please reconnect.");
      } else {
        setError(errorMessage);
      }
    }
  }, [spotifyToken]);

  // Check for active devices
  const checkForActiveDevices = useCallback(async () => {
    if (!spotifyToken) return;

    try {
      const data = await spotifyApi.makeRequest(
        "/me/player/devices",
        spotifyToken
      );
      if (
        data &&
        (data as { devices: { is_active: boolean }[] }).devices &&
        (data as { devices: { is_active: boolean }[] }).devices.length > 0
      ) {
        const activeDevice = (
          data as { devices: { is_active: boolean }[] }
        ).devices.find((device: { is_active: boolean }) => device.is_active);
        setHasActiveDevice(!!activeDevice);
      } else {
        setHasActiveDevice(false);
      }
    } catch (error: unknown) {
      console.error("Error checking for active devices:", error);
      setHasActiveDevice(false);
    }
  }, [spotifyToken]);

  // Fetch current playing track
  const fetchCurrentTrack = useCallback(async () => {
    if (!spotifyToken) return;

    try {
      const data = await spotifyApi.makeRequest(
        "/me/player/currently-playing",
        spotifyToken
      );

      if (data && (data as SpotifyCurrentlyPlaying).item) {
        const currentlyPlaying = data as SpotifyCurrentlyPlaying;
        setCurrentTrack(currentlyPlaying.item);
        setIsPlaying(currentlyPlaying.is_playing);
        if ((data as SpotifyCurrentlyPlaying).device) {
          setVolume(
            (data as SpotifyCurrentlyPlaying).device.volume_percent || 80
          );
        }
        setTrackProgress((data as SpotifyCurrentlyPlaying).progress_ms);
      } else if (data === null) {
        // No track playing, but don't reset if we're just polling
        // This prevents UI flicker when nothing has changed
      } else {
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    } catch (error: unknown) {
      // Don't set error on 404, as it's normal when nothing is playing
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (!errorMessage.includes("404")) {
        console.error("Error fetching current track:", error);
      }
    }
  }, [spotifyToken]);

  // Fetch user playlists
  const fetchPlaylists = useCallback(async () => {
    if (!spotifyToken) return;

    try {
      const data = await spotifyApi.makeRequest(
        "/me/playlists?limit=10",
        spotifyToken
      );
      if (data && (data as { items: SpotifyPlaylist[] }).items) {
        setPlaylists((data as { items: SpotifyPlaylist[] }).items);
      }
    } catch (error: unknown) {
      console.error("Error fetching playlists:", error);
    }
  }, [spotifyToken]);

  // Fetch recently played tracks
  const fetchRecentlyPlayed = useCallback(async () => {
    if (!spotifyToken) return;

    try {
      const data = await spotifyApi.makeRequest(
        "/me/player/recently-played?limit=6",
        spotifyToken
      );
      if (data && (data as { items: unknown[] }).items) {
        setRecentlyPlayed(
          (data as { items: { track: SpotifyTrack }[] }).items.map(
            (item: { track: SpotifyTrack }) => item.track
          )
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching recently played tracks:", error);
    }
  }, [spotifyToken]);

  // Fetch recommended tracks with improved error handling
  const fetchRecommendations = useCallback(async () => {
    if (!spotifyToken) return;

    try {
      // Try to get user's top artists first
      let artistIds = "";
      try {
        const topArtists = await spotifyApi.makeRequest(
          "/me/top/artists?limit=3&time_range=medium_term",
          spotifyToken
        );

        if (
          topArtists &&
          (topArtists as { items: unknown[] }).items &&
          (topArtists as { items: unknown[] }).items.length > 0
        ) {
          artistIds = (topArtists as { items: unknown[] }).items
            .map((artist: { id: string }) => artist.id)
            .join(",");
        }
      } catch (error: unknown) {
        console.warn(
          "Could not fetch top artists, using seed genres instead:",
          error
        );
        // Continue with seed genres instead
      }

      // If we couldn't get top artists, use genres
      const endpoint = artistIds
        ? `/recommendations?limit=6&seed_artists=${artistIds}`
        : "/recommendations?limit=6&seed_genres=pop,rock,electronic";

      const data = await spotifyApi.makeRequest(endpoint, spotifyToken);

      if (data && (data as { tracks: SpotifyTrack[] }).tracks) {
        setRecommendations((data as { tracks: SpotifyTrack[] }).tracks);
      }
    } catch (error: unknown) {
      console.error("Error fetching recommendations:", error);

      // Fallback to a different approach if recommendations fail
      try {
        // Try new releases as a fallback
        const newReleases = await spotifyApi.makeRequest(
          "/browse/new-releases?limit=10",
          spotifyToken
        );

        if (
          newReleases &&
          (newReleases as { albums?: { items: SpotifyAlbum[] } })?.albums?.items
        ) {
          // Transform album objects to look more like track objects
          const transformedTracks = (
            newReleases as { albums: { items: SpotifyAlbum[] } }
          ).albums.items.map((album: SpotifyAlbum) => ({
            id: album.id,
            name: album.name,
            artists: album.artists,
            album: album,
            type: "album",
            duration_ms: 0, // Default value since albums don't have duration
          }));

          setRecommendations(transformedTracks);
        }
      } catch (fallbackError: unknown) {
        console.error("Even fallback recommendations failed:", fallbackError);
        // Don't set error state to avoid blocking the UI
      }
    }
  }, [spotifyToken]);

  // Fetch liked songs
  const fetchLikedSongs = useCallback(async () => {
    if (!spotifyToken) return;

    try {
      const data = await spotifyApi.makeRequest(
        "/me/tracks?limit=10",
        spotifyToken
      );
      if (data && (data as { items: { track: SpotifyTrack }[] }).items) {
        setLikedSongs(
          (data as { items: { track: SpotifyTrack }[] }).items.map(
            (item) => item.track
          )
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching liked songs:", error);
    }
  }, [spotifyToken]);

  // Playback control functions
  const togglePlay = async () => {
    if (!spotifyToken) return;

    try {
      if (!hasActiveDevice) {
        setError(
          "No active Spotify device found. Please open Spotify on any device first."
        );
        return;
      }

      const endpoint = isPlaying ? "/me/player/pause" : "/me/player/play";
      await spotifyApi.makeRequest(endpoint, spotifyToken, "PUT");
      setIsPlaying(!isPlaying);

      // Fetch current track after a short delay to update UI
      setTimeout(fetchCurrentTrack, 500);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error toggling play:", error);
      if (errorMessage.includes("NO_ACTIVE_DEVICE")) {
        setError(
          "No active Spotify device found. Please open Spotify on any device first."
        );
      } else {
        setError(errorMessage);
      }
    }
  };

  const skipTrack = async (direction: "next" | "previous") => {
    if (!spotifyToken) return;

    try {
      if (!hasActiveDevice) {
        setError(
          "No active Spotify device found. Please open Spotify on any device first."
        );
        return;
      }

      const endpoint =
        direction === "next" ? "/me/player/next" : "/me/player/previous";
      await spotifyApi.makeRequest(endpoint, spotifyToken, "POST");

      // Fetch current track after a delay to update UI
      setTimeout(fetchCurrentTrack, 500);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Error skipping to ${direction} track:`, error);
      if (errorMessage.includes("NO_ACTIVE_DEVICE")) {
        setError(
          "No active Spotify device found. Please open Spotify on any device first."
        );
      } else {
        setError(errorMessage);
      }
    }
  };

  // Volume control
  const handleVolumeChange = async (newVolume: number[]) => {
    if (!spotifyToken) return;
    const volumePercent = newVolume[0];
    setVolume(volumePercent); // Update local state immediately for UI feedback

    try {
      if (!hasActiveDevice) {
        // Don't show error for volume changes
        return;
      }

      await spotifyApi.makeRequest(
        `/me/player/volume?volume_percent=${volumePercent}`,
        spotifyToken,
        "PUT"
      );
    } catch (error: unknown) {
      console.error("Error setting volume:", error);
      // Don't show error for volume changes as they're common
    }
  };

  // Track seeking
  const handleSeek = async (newProgress: number[]) => {
    if (!spotifyToken || !currentTrack) return;
    const seekPosition = newProgress[0];
    setTrackProgress(seekPosition); // Update local state

    try {
      if (!hasActiveDevice) {
        setError(
          "No active Spotify device found. Please open Spotify on any device first."
        );
        return;
      }

      await spotifyApi.makeRequest(
        `/me/player/seek?position_ms=${seekPosition}`,
        spotifyToken,
        "PUT"
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error seeking track:", error);
      if (errorMessage.includes("NO_ACTIVE_DEVICE")) {
        setError(
          "No active Spotify device found. Please open Spotify on any device first."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setSeeking(false);
    }
  };

  // Get Spotify oEmbed for a track
  const getSpotifyEmbed = useCallback(async (track: SpotifyTrack) => {
    if (!track || !track.id) {
      console.error("Invalid track object", track);
      return;
    }

    setSelectedTrack(track);
    setLoading(true);
    setError(null);

    try {
      // Check if it's an album or a track
      const type = track.type || "track";

      // Create the embed HTML directly instead of fetching from oEmbed API
      // Use the Spotify URI format which is more reliable
      const spotifyUri = `spotify:${type}:${track.id}`;

      // Create the embed HTML with the URI
      const embedHtml = `<iframe 
        src="https://open.spotify.com/embed/${type}/${track.id}?utm_source=generator" 
        width="100%" 
        height="352" 
        frameBorder="0" 
        allowfullscreen="" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
        loading="lazy">
      </iframe>`;

      // Set the embed HTML and show the embed modal
      setEmbedHtml(embedHtml);
      setShowEmbed(true);

      console.log("Spotify embed created for:", spotifyUri);
    } catch (error: unknown) {
      console.error("Error setting up Spotify embed:", error);
      setError(
        `Could not load Spotify player for "${track.name}". Please try again.`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle mood search
  const handleMoodSearch = async (mood: string) => {
    if (!spotifyToken) return;
    //setMoodSearch(mood);
    setLoading(true);

    // Use Spotify recommendation API with valence parameter
    // Valence represents musical positiveness (happy, cheerful)
    let valence = 0.5; // neutral
    let energy = 0.5; // neutral

    // Adjust parameters based on mood keywords
    if (mood.toLowerCase().includes("happy")) {
      valence = 0.8;
      energy = 0.7;
    } else if (
      mood.toLowerCase().includes("sad") ||
      mood.toLowerCase().includes("melancholic")
    ) {
      valence = 0.2;
      energy = 0.3;
    } else if (
      mood.toLowerCase().includes("energetic") ||
      mood.toLowerCase().includes("workout")
    ) {
      energy = 0.9;
      valence = 0.7;
    } else if (
      mood.toLowerCase().includes("relaxed") ||
      mood.toLowerCase().includes("chill")
    ) {
      energy = 0.3;
      valence = 0.6;
    } else if (
      mood.toLowerCase().includes("focus") ||
      mood.toLowerCase().includes("study")
    ) {
      energy = 0.4;
      valence = 0.5;
    }

    try {
      const data = await spotifyApi.makeRequest(
        `/recommendations?limit=8&seed_genres=pop,rock,electronic&target_valence=${valence}&target_energy=${energy}`,
        spotifyToken
      );

      const result = data as { tracks?: SpotifyTrack[] };
      if (result.tracks) {
        setRecommendations(result.tracks);
      }
    } catch (error: unknown) {
      console.error("Mood search failed:", error);
      // Try a fallback approach
      try {
        // Use search instead
        const searchTerm = `${mood} music`;
        const searchResults = await spotifyApi.makeRequest(
          `/search?q=${encodeURIComponent(searchTerm)}&type=track&limit=8`,
          spotifyToken
        );

        if (
          searchResults &&
          (searchResults as { tracks?: { items: SpotifyTrack[] } }).tracks &&
          (searchResults as { tracks?: { items: SpotifyTrack[] } }).tracks.items
        ) {
          setRecommendations(
            (searchResults as { tracks?: { items: SpotifyTrack[] } }).tracks
              .items
          );
        }
      } catch (fallbackError) {
        console.error("Fallback mood search failed:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("spotify_token");

    router.push("/");
  };

  // Fetch data when token is available
  useEffect(() => {
    if (spotifyToken) {
      setLoading(true);

      // Create a queue of promises to execute
      const fetchQueue = [
        fetchUserProfile(),
        checkForActiveDevices(),
        fetchCurrentTrack(),
        fetchPlaylists(),
        fetchRecentlyPlayed(),
        fetchRecommendations(),
        fetchLikedSongs(),
      ];

      // Execute all promises and set loading to false when done
      Promise.allSettled(fetchQueue).then(() => {
        setLoading(false);
      });

      // Set up polling for player state and active devices
      const playerInterval = setInterval(() => {
        fetchCurrentTrack();
        checkForActiveDevices();
      }, 5000);

      return () => clearInterval(playerInterval);
    }
  }, [
    spotifyToken,
    fetchUserProfile,
    fetchCurrentTrack,
    fetchPlaylists,
    fetchRecentlyPlayed,
    fetchRecommendations,
    fetchLikedSongs,
    checkForActiveDevices,
  ]);

  // Update track progress in real-time when playing
  useEffect(() => {
    let progressInterval: NodeJS.Timeout | undefined;

    if (isPlaying && currentTrack && !seeking) {
      progressInterval = setInterval(() => {
        setTrackProgress((prev) => {
          // If we reach the end of the track, don't increment further
          if (prev >= currentTrack.duration_ms) {
            if (progressInterval) clearInterval(progressInterval);
            return prev;
          }
          return prev + 1000; // Increment by 1 second
        });
      }, 1000);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isPlaying, currentTrack, seeking]);

  // Handle click outside of embed modal to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        embedRef.current &&
        !embedRef.current.contains(event.target as Node)
      ) {
        setShowEmbed(false);
      }
    };

    if (showEmbed) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmbed]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!isMobile && (
          <div className="w-64 border-r bg-card p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Music2 className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Vibez</span>
            </div>
            <nav className="space-y-2 flex-1">
              <Button
                variant={activeTab === "discover" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("discover")}
              >
                <Home className="mr-2 h-4 w-4" />
                Discover
              </Button>
              <Button
                variant={activeTab === "search" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("search")}
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button
                variant={activeTab === "library" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("library")}
              >
                <Library className="mr-2 h-4 w-4" />
                Your Library
              </Button>
              <Button
                variant={activeTab === "liked" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("liked")}
              >
                <Heart className="mr-2 h-4 w-4" />
                Liked Songs
              </Button>
              <Button
                variant={activeTab === "ai-mood" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("ai-mood")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Mood
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => redirectToAuthCodeFlow()}
                disabled={!!spotifyToken}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {spotifyToken ? "Connected" : "Sync With Spotify"}
              </Button>
            </nav>
            <div className="mt-auto pt-4 border-t">
              <div className="flex items-center gap-3 mb-4">
                <Avatar>
                  <AvatarImage
                    src={
                      userProfile?.images?.[0]?.url ||
                      "/placeholder.svg?height=40&width=40"
                    }
                    alt="User"
                  />
                  <AvatarFallback>
                    {userProfile?.display_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {userProfile?.display_name || "Loading..."}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.product === "premium" ? "Premium" : "Free"}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isMobile && (
                <div className="flex items-center gap-2">
                  <Music2 className="h-6 w-6 text-primary" />
                  <span className="text-xl font-bold">Vibez</span>
                </div>
              )}
              {!isMobile && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => router.back()}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    <span className="sr-only">Back</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => router.forward()}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                    <span className="sr-only">Forward</span>
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {userProfile?.product !== "premium" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open("https://www.spotify.com/premium/", "_blank")
                  }
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade
                </Button>
              )}
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
                <span className="sr-only">Profile</span>
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
            </div>
          </header>

          {loading && (
            <div className="flex items-center justify-center h-64 p-8">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="p-4 m-4 text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md">
              {error}
              {error.includes("No active Spotify device") && (
                <div className="mt-2 text-sm">
                  Please open Spotify on your phone, desktop, or web player
                  first.
                </div>
              )}
            </div>
          )}

          {!loading && !error && (
            <>
              {isMobile ? (
                <Tabs defaultValue="discover" className="w-full">
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="discover">
                      <Home className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="search">
                      <Search className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="library">
                      <Library className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="liked">
                      <Heart className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="ai-mood">
                      <Sparkles className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="discover">
                    <DiscoverContent
                      recommendations={recommendations}
                      recentlyPlayed={recentlyPlayed}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  </TabsContent>
                  <TabsContent value="search">
                    <SearchContent
                      spotifyToken={spotifyToken}
                      setRecommendations={setRecommendations}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  </TabsContent>
                  <TabsContent value="library">
                    <LibraryContent playlists={playlists} />
                  </TabsContent>
                  <TabsContent value="liked">
                    <LikedContent
                      likedSongs={likedSongs}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  </TabsContent>
                  <TabsContent value="ai-mood">
                    <AIMoodContent
                      onMoodSearch={handleMoodSearch}
                      recommendations={recommendations}
                      setRecommendations={setRecommendations}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="p-6">
                  {activeTab === "discover" && (
                    <DiscoverContent
                      recommendations={recommendations}
                      recentlyPlayed={recentlyPlayed}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  )}
                  {activeTab === "search" && (
                    <SearchContent
                      spotifyToken={spotifyToken}
                      setRecommendations={setRecommendations}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  )}
                  {activeTab === "library" && (
                    <LibraryContent playlists={playlists} />
                  )}
                  {activeTab === "liked" && (
                    <LikedContent
                      likedSongs={likedSongs}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  )}
                  {activeTab === "ai-mood" && (
                    <AIMoodContent
                      onMoodSearch={handleMoodSearch}
                      recommendations={recommendations}
                      setRecommendations={setRecommendations}
                      getSpotifyEmbed={getSpotifyEmbed}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Player */}
      <div className="border-t bg-card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 w-1/3">
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
              {currentTrack?.album?.images?.[0]?.url ? (
                <img
                  src={currentTrack.album.images[0].url || "/placeholder.svg"}
                  alt={currentTrack.name}
                  className="w-full h-full object-cover rounded-md"
                />
              ) : (
                <Music2 className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="hidden sm:block">
              <div className="font-medium">
                {currentTrack?.name || "No track playing"}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentTrack?.artists
                  ?.map((artist: SpotifyArtist) => artist.name)
                  .join(", ") || " "}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center w-1/3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipTrack("previous")}
                disabled={!hasActiveDevice}
              >
                <SkipBack className="h-4 w-4" />
                <span className="sr-only">Previous</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={togglePlay}
                disabled={!hasActiveDevice}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
                <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipTrack("next")}
                disabled={!hasActiveDevice}
              >
                <SkipForward className="h-4 w-4" />
                <span className="sr-only">Next</span>
              </Button>
            </div>
            <div className="hidden sm:flex w-full items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {currentTrack ? formatTime(trackProgress) : "0:00"}
              </span>
              <Slider
                value={[trackProgress]}
                max={currentTrack?.duration_ms || 100}
                step={100} // Update every 100ms
                className="w-full"
                disabled={!hasActiveDevice || !currentTrack}
                onValueChange={(value) => {
                  setTrackProgress(value[0]); // Update while sliding
                  setSeeking(true);
                }}
                onValueCommit={(value) => {
                  // Only seek when the user releases the slider
                  handleSeek(value);
                }}
              />
              <span className="text-xs text-muted-foreground">
                {currentTrack ? formatTime(currentTrack.duration_ms) : "0:00"}
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 justify-end w-1/3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              max={100}
              step={1}
              className="w-24"
              disabled={!hasActiveDevice}
              onValueChange={(value) => handleVolumeChange(value)}
            />
          </div>
        </div>
      </div>

      {/* Spotify Embed Modal */}
      {showEmbed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            ref={embedRef}
            className="bg-card rounded-lg shadow-lg max-w-md w-full p-4 relative"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setShowEmbed(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>

            <div className="mb-4">
              <h3 className="text-lg font-semibold">{selectedTrack?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedTrack?.artists
                  ?.map((artist: SpotifyArtist) => artist.name)
                  .join(", ")}
              </p>
            </div>

            <div
              className="spotify-embed w-full"
              dangerouslySetInnerHTML={{ __html: embedHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Content components
function DiscoverContent({
  recommendations,
  recentlyPlayed,
  getSpotifyEmbed,
}: {
  recommendations: SpotifyTrack[];
  recentlyPlayed: SpotifyTrack[];
  getSpotifyEmbed: (track: SpotifyTrack) => void;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Good afternoon</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <AnimatePresence>
          {recommendations.slice(0, 6).map((track, index) => (
            <motion.div
              key={`discover-top-${track.id}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="relative bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => getSpotifyEmbed(track)}
            >
              <img
                src={
                  track.album?.images?.[2]?.url ||
                  "/placeholder.svg?height=64&width=64" ||
                  "/placeholder.svg"
                }
                alt={track.name}
                className="w-16 h-16 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-primary text-primary-foreground rounded-full p-2">
                  <Play className="h-4 w-4" />
                </div>
              </div>
              <div className="p-3">
                <div className="font-medium truncate">{track.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {track.artists
                    ?.map((artist: SpotifyArtist) => artist.name)
                    .join(", ")}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <h2 className="text-xl font-bold">Made for you</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <AnimatePresence>
          {recommendations.map((track, index) => (
            <motion.div
              key={`made-for-you-${track.id}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="relative bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => getSpotifyEmbed(track)}
            >
              <img
                src={
                  track.album?.images?.[1]?.url ||
                  "/placeholder.svg?height=200&width=200" ||
                  "/placeholder.svg"
                }
                alt={track.name}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-primary text-primary-foreground rounded-full p-2">
                  <Play className="h-4 w-4" />
                </div>
              </div>
              <div className="p-3">
                <div className="font-medium truncate">{track.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {track.artists
                    ?.map((artist: SpotifyArtist) => artist.name)
                    .join(", ")}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <h2 className="text-xl font-bold">Recently played</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <AnimatePresence>
          {(recentlyPlayed.length > 0 ? recentlyPlayed : recommendations).map(
            (track, index) => (
              <motion.div
                key={`recently-played-${track.id}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="relative bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => getSpotifyEmbed(track)}
              >
                <img
                  src={
                    track.album?.images?.[1]?.url ||
                    "/placeholder.svg?height=200&width=200" ||
                    "/placeholder.svg"
                  }
                  alt={track.name}
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary text-primary-foreground rounded-full p-2">
                    <Play className="h-4 w-4" />
                  </div>
                </div>
                <div className="p-3">
                  <div className="font-medium truncate">{track.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {track.artists
                      ?.map((artist: SpotifyArtist) => artist.name)
                      .join(", ")}
                  </div>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SearchContent({
  spotifyToken,
  setRecommendations,
  getSpotifyEmbed,
}: {
  spotifyToken: string | null;
  setRecommendations: (tracks: SpotifyTrack[]) => void;
  getSpotifyEmbed: (track: SpotifyTrack) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!spotifyToken || !searchQuery.trim()) return;

    setLoading(true);
    try {
      const data = (await spotifyApi.makeRequest(
        `/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=20`,
        spotifyToken
      )) as { tracks?: { items: SpotifyTrack[] } };

      if (data.tracks && data.tracks.items) {
        setSearchResults(data.tracks.items);
        // Also update recommendations to show in other tabs
        setRecommendations(data.tracks.items);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="What do you want to listen to?"
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <Button
          className="absolute right-0 top-0 rounded-l-none h-full"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {searchResults.length > 0 ? (
        <div>
          <h2 className="text-xl font-bold mb-4">Search Results</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence>
              {searchResults.map((track, index) => (
                <motion.div
                  key={`search-result-${track.id}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="relative bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => getSpotifyEmbed(track)}
                >
                  <img
                    src={
                      track.album?.images?.[1]?.url ||
                      "/placeholder.svg?height=200&width=200" ||
                      "/placeholder.svg"
                    }
                    alt={track.name}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary text-primary-foreground rounded-full p-2">
                      <Play className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="font-medium truncate">{track.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {track.artists
                        ?.map((artist: SpotifyArtist) => artist.name)
                        .join(", ")}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold">Browse all</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[
              "Pop",
              "Hip-Hop",
              "Rock",
              "Electronic",
              "R&B",
              "Jazz",
              "Classical",
              "Country",
              "Metal",
              "Folk",
            ].map((genre) => (
              <div
                key={genre}
                className="bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer"
                onClick={() => {
                  setSearchQuery(genre);
                  handleSearch();
                }}
              >
                <div className="aspect-square bg-primary/10 flex items-center justify-center">
                  <span className="font-bold text-lg">{genre}</span>
                </div>
              </div>
            ))}
          </div>
          <h2 className="text-xl font-bold">Trending searches</h2>
          <div className="space-y-2">
            {[
              "New releases",
              "Summer hits",
              "Workout playlist",
              "Focus music",
              "Chill vibes",
            ].map((search) => (
              <div
                key={search}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => {
                  setSearchQuery(search);
                  handleSearch();
                }}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>{search}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LibraryContent({ playlists }: { playlists: SpotifyPlaylist[] }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your Library</h1>
      <div className="flex gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            //filter
          }}
        >
          Playlists
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            //filter
          }}
        >
          Artists
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            //filter
          }}
        >
          Albums
        </Button>
      </div>
      {playlists.length > 0 ? (
        <div className="space-y-2">
          <AnimatePresence>
            {playlists.map((playlist) => (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => {
                  //open playlist
                }}
              >
                <img
                  src={
                    playlist.images?.[0]?.url ||
                    "/placeholder.svg?height=48&width=48" ||
                    "/placeholder.svg"
                  }
                  alt={playlist.name}
                  className="w-12 h-12 rounded-md object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{playlist.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {playlist.type} • {playlist.tracks?.total || 0} songs
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <Library className="h-10 w-10 mx-auto mb-4 opacity-50" />
          <p>No playlists found</p>
          <p className="text-sm mt-2">
            Connect with Spotify to see your playlists
          </p>
        </div>
      )}
    </div>
  );
}

function LikedContent({
  likedSongs,
  getSpotifyEmbed,
}: {
  likedSongs: SpotifyTrack[];
  getSpotifyEmbed: (track: SpotifyTrack) => void;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Liked Songs</h1>
      {likedSongs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <AnimatePresence>
            {likedSongs.map((track, index) => (
              <motion.div
                key={`liked-song-${track.id}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="relative bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => getSpotifyEmbed(track)}
              >
                <img
                  src={
                    track.album?.images?.[1]?.url ||
                    "/placeholder.svg?height=200&width=200" ||
                    "/placeholder.svg"
                  }
                  alt={track.name}
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary text-primary-foreground rounded-full p-2">
                    <Play className="h-4 w-4" />
                  </div>
                </div>
                <div className="p-3">
                  <div className="font-medium truncate">{track.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {track.artists
                      ?.map((artist: SpotifyArtist) => artist.name)
                      .join(", ")}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <Heart className="h-10 w-10 mx-auto mb-4 opacity-50" />
          <p>No liked songs found</p>
          <p className="text-sm mt-2">
            Connect with Spotify to see your liked songs
          </p>
        </div>
      )}
    </div>
  );
}

function AIMoodContent({
  onMoodSearch,
  recommendations,
  getSpotifyEmbed,
}: {
  onMoodSearch: (mood: string) => void;
  recommendations: SpotifyTrack[];
  setRecommendations: (tracks: SpotifyTrack[]) => void;
  getSpotifyEmbed: (track: SpotifyTrack) => void;
}) {
  const [moodInput, setMoodInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = () => {
    if (!moodInput.trim()) return;
    setLoading(true);
    onMoodSearch(moodInput);
    setMoodInput(""); // Clear input after search
    setLoading(false);
  };

  const predefinedMoods = [
    "Happy",
    "Sad",
    "Energetic",
    "Relaxed",
    "Focus",
    "Workout",
    "Party",
    "Chill",
    "Romantic",
    "Nostalgic",
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Mood Search</h1>
      <div className="flex gap-3">
        <Input
          placeholder="Enter your mood (e.g., happy, sad, energetic)"
          value={moodInput}
          onChange={(e) => setMoodInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {predefinedMoods.map((mood) => (
          <Button
            key={mood}
            variant="outline"
            size="sm"
            onClick={() => {
              onMoodSearch(mood);
            }}
          >
            {mood}
          </Button>
        ))}
      </div>

      {recommendations.length > 0 && (
        <>
          <h2 className="text-xl font-bold">Recommendations for your mood</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence>
              {recommendations.map((track, index) => (
                <motion.div
                  key={`mood-recommendation-${track.id}-${index}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="relative bg-card hover:bg-card/80 transition-colors rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => getSpotifyEmbed(track)}
                >
                  <img
                    src={
                      track.album?.images?.[1]?.url ||
                      "/placeholder.svg?height=200&width=200" ||
                      "/placeholder.svg"
                    }
                    alt={track.name}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary text-primary-foreground rounded-full p-2">
                      <Play className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="font-medium truncate">{track.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {track.artists
                        ?.map((artist: SpotifyArtist) => artist.name)
                        .join(", ")}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
