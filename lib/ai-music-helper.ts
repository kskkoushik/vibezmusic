import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function generateMoodBasedRecommendations(mood: string) {
  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: `Generate a list of 8 songs that match the mood: ${mood}. 
              Format as JSON array with objects containing title, artist, and album.
              Be specific and varied in your recommendations.`,
    });

    // Parse the AI response
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating mood-based recommendations:", error);
    throw new Error("Failed to generate recommendations");
  }
}

interface Track {
  name: string;
  artist: string;
}

export async function analyzeListeningHabits(tracks: Track[]) {
  try {
    const tracksData = tracks.map((t) => `${t.name} by ${t.artist}`).join(", ");

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: `Analyze these tracks and provide insights about the user's music taste: ${tracksData}
              Format as JSON with the following structure:
              {
                "topGenres": ["genre1", "genre2", "genre3"],
                "moodProfile": "description of the overall mood",
                "recommendations": {
                  "similar": ["artist1", "artist2"],
                  "expand": ["artist3", "artist4"]
                }
              }`,
    });

    // Parse the AI response
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing listening habits:", error);
    throw new Error("Failed to analyze listening habits");
  }
}

export async function generatePlaylist(theme: string, count = 10) {
  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: `Generate a themed playlist with ${count} songs for the theme: "${theme}".
              Format as JSON array with objects containing title, artist, and a short reason why it fits the theme.
              Be creative and diverse in your selections.`,
    });

    // Parse the AI response
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating playlist:", error);
    throw new Error("Failed to generate playlist");
  }
}
