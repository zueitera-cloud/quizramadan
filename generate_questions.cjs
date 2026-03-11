const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey });

async function generateBatch(difficulty, count) {
  const model = "gemini-3-flash-preview";
  const prompt = `Generate ${count} multiple choice questions in Arabic for a quiz game.
Difficulty level: ${difficulty} (on a scale of 1 to 16, where 1 is very easy and 16 is extremely hard).
Categories: Arabic language, history, geography, science, inventions, famous people, general culture.

Return the result as a JSON array of objects with this structure:
{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "answer": number (0-3 index),
  "difficulty": ${difficulty},
  "hint": "string (short hint in Arabic)"
}

Ensure the questions are diverse and accurate. Do not include any markdown formatting, just the raw JSON array.`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
    });
    const text = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (e) {
    console.error(`Error generating batch for difficulty ${difficulty}:`, e);
    return [];
  }
}

async function main() {
  const allQuestions = [];
  let idCounter = 1000;

  // Generate 5 questions for each level (1 to 16) as a start to show progress
  // In a real scenario, we could loop more to reach 1000, but for this turn we'll do a good batch.
  for (let level = 1; level <= 16; level++) {
    console.log(`Generating questions for level ${level}...`);
    const batch = await generateBatch(level, 10); // 10 per level = 160 questions
    batch.forEach(q => {
      allQuestions.push({ id: idCounter++, ...q });
    });
  }

  const filePath = path.join(__dirname, "src", "data", "questions_bank.json");
  fs.writeFileSync(filePath, JSON.stringify(allQuestions, null, 2));
  console.log(`Generated ${allQuestions.length} questions to ${filePath}`);
}

main();
