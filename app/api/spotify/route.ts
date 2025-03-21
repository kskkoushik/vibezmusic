import { NextRequest, NextResponse } from "next/server";

const clientId = "2f1116716c70466d86841e0433d4c25d";
const redirectUri = "https://vibezmusic.vercel.app/dashboard";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("Received body:", body); // ✅ Debug incoming data

    const { code, code_verifier } = body;

    if (!code || !code_verifier) {
      console.error("Missing code or code_verifier");
      return NextResponse.json(
        { error: "Missing code or code_verifier" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("code_verifier", code_verifier);

    console.log("Requesting token with params:", params.toString()); // ✅ Debug request params

    const result = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!result.ok) {
      const errorText = await result.text(); // ✅ Read the body once
      console.error("Failed to fetch token:", errorText);
      throw new Error(`Failed to fetch access token: ${result.statusText}`);
    }

    const data = await result.json(); // ✅ Avoid reading body again
    console.log("Spotify API response:", data); // ✅ Debug Spotify response

    return NextResponse.json({ access_token: data.access_token });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("API Error:", errorMessage); // ✅ Debug any internal errors
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
