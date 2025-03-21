"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Music2, Search, Sparkles } from "lucide-react";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

const clientId = "2f1116716c70466d86841e0433d4c25d";
const redirectUri = "http://localhost:3000/dashboard"; // Make sure this matches your actual redirect URI

const redirectToAuthCodeFlow = async () => {
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

const generateCodeVerifier = (length: number) => {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const generateCodeChallenge = async (codeVerifier: string) => {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export default function Home() {
  const router = useRouter();
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">MoodifyAI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="#features"
              className="text-sm font-medium hover:underline"
            >
              Features
            </Link>
            <Link href="#about" className="text-sm font-medium hover:underline">
              About
            </Link>

            {spotifyToken ? (
              <Button
                onClick={() => redirectToAuthCodeFlow()}
                disabled={!!spotifyToken}
              >
                Dashboard
              </Button>
            ) : (
              <Button
                onClick={() => redirectToAuthCodeFlow()}
                disabled={!!spotifyToken}
              >
                Sync With Spotify
              </Button>
            )}
          </nav>
          <Button variant="outline" size="icon" className="md:hidden">
            <span className="sr-only">Menu</span>
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
              className="h-6 w-6"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Discover Music Based on Your Mood
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  MoodifyAI connects with your Spotify account to provide
                  personalized music recommendations based on your mood, powered
                  by AI.
                </p>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  {spotifyToken ? (
                    <Button
                      onClick={() => router.push("/dashboard")}
                      disabled={!!spotifyToken}
                      className="w-full min-[400px]:w-auto"
                    >
                      Dashboard
                    </Button>
                  ) : (
                    <Button
                      onClick={() => redirectToAuthCodeFlow()}
                      disabled={!!spotifyToken}
                      className="w-full min-[400px]:w-auto"
                    >
                      Get started
                    </Button>
                  )}

                  <Link href="#features">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full min-[400px]:w-auto"
                    >
                      Learn More
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="mx-auto lg:ml-auto flex justify-center">
                <div className="relative w-[300px] h-[400px] md:w-[450px] md:h-[600px] rounded-xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40 backdrop-blur-sm">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-[80%] h-[80%] bg-background/80 backdrop-blur-md rounded-lg p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <Music2 className="h-6 w-6 text-primary" />
                          <span className="text-xl font-bold">Vibez</span>
                        </div>
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                              <Search className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <input
                              type="text"
                              placeholder="How are you feeling today?"
                              className="w-full pl-10 py-2 bg-background border rounded-md"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                              Energetic
                            </span>
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                              Relaxed
                            </span>
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                              Happy
                            </span>
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                              Focused
                            </span>
                          </div>
                          <div className="flex-1 space-y-3 overflow-auto">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                              >
                                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                                  <Music2 className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    Song Title {i}
                                  </div>
                                  <div className="text-sm text-muted-foreground truncate">
                                    Artist Name
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="py-12 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground">
                  Features
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                  Everything you need for a personalized music experience
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  MoodifyAI combines the power of Spotify with AI to create a
                  unique music discovery experience.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center space-y-2 rounded-lg border p-4"
                >
                  <div className="rounded-full bg-primary/10 p-2">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-center text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} MoodifyAI. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-sm font-medium hover:underline">
              Terms
            </Link>
            <Link href="#" className="text-sm font-medium hover:underline">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    title: "Spotify Integration",
    description:
      "Connect your Spotify account to access your playlists, saved tracks, and personalized recommendations.",
    icon: <Music2 className="h-6 w-6 text-primary" />,
  },
  {
    title: "Mood-Based Search",
    description:
      "Use AI to find songs that match your current mood or the vibe you're looking for.",
    icon: <Sparkles className="h-6 w-6 text-primary" />,
  },
  {
    title: "Advanced Search",
    description:
      "Search for songs, artists, and albums with powerful filtering options.",
    icon: <Search className="h-6 w-6 text-primary" />,
  },
  {
    title: "Personalized Recommendations",
    description:
      "Get song recommendations based on your listening history and preferences.",
    icon: (
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
        className="h-6 w-6 text-primary"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    title: "Playlist Creation",
    description:
      "Create and manage playlists directly from the app with AI-assisted curation.",
    icon: (
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
        className="h-6 w-6 text-primary"
      >
        <path d="M21 15V6" />
        <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M12 12H3" />
        <path d="M16 6H3" />
        <path d="M12 18H3" />
      </svg>
    ),
  },
  {
    title: "Real-time Lyrics",
    description:
      "View synchronized lyrics while listening to your favorite songs.",
    icon: (
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
        className="h-6 w-6 text-primary"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
];
