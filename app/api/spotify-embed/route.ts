import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get("trackId");

  if (!trackId) {
    return NextResponse.json(
      { error: "Track ID is required" },
      { status: 400 }
    );
  }

  try {
    // Make the request to Spotify oEmbed API from the server
    const response = await fetch(
      `https://open.spotify.com/oembed?url=spotify:track:${trackId}`
    );

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Spotify embed:", error);
    return NextResponse.json(
      { error: "Failed to fetch Spotify embed" },
      { status: 500 }
    );
  }
}
