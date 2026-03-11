import { GoogleGenAI } from "@google/genai";

export async function getAIHint(question: string, options: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `You are a helpful assistant for a trivia game. 
  The question is: "${question}"
  The options are: ${options.join(", ")}
  Provide a subtle hint that doesn't directly give away the answer but guides the player. 
  Keep it short (max 20 words).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "I'm not sure about this one...";
  } catch (error) {
    console.error("AI Hint Error:", error);
    return "The AI is currently unavailable. Good luck!";
  }
}
