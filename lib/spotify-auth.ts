export async function getSpotifyAuthUrl() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_SITE_URL + "/api/auth/callback/spotify")
  const scopes = encodeURIComponent(
    "user-read-private user-read-email playlist-read-private user-library-read user-top-read user-read-recently-played",
  )

  return `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}`
}

export async function exchangeCodeForToken(code: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const redirectUri = process.env.NEXT_PUBLIC_SITE_URL + "/api/auth/callback/spotify"

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  })

  return response.json()
}

export async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  return response.json()
}

