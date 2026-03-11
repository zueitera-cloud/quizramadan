import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import axios from "axios";
import dotenv from "dotenv";
import { QUESTIONS } from "./src/data/questions.ts";

dotenv.config();

const dbPath = path.join(process.cwd(), "leaderboard.db");
const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    option1 TEXT NOT NULL,
    option2 TEXT NOT NULL,
    option3 TEXT NOT NULL,
    option4 TEXT NOT NULL,
    answer INTEGER NOT NULL,
    difficulty INTEGER NOT NULL,
    hint TEXT
  );
`);

// Seed questions if table is empty
const countStmt = db.prepare("SELECT COUNT(*) as count FROM questions");
const { count } = countStmt.get() as { count: number };

if (count === 0) {
  console.log("Seeding questions into database...");
  const insert = db.prepare(`
    INSERT INTO questions (question, option1, option2, option3, option4, answer, difficulty, hint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((qs) => {
    for (const q of qs) {
      insert.run(q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.answer, q.difficulty, q.hint || null);
    }
  });
  
  transaction(QUESTIONS);
  console.log(`Seeded ${QUESTIONS.length} questions.`);
}

// --- CSV Sync Logic ---
async function syncQuestionsFromUrl(url: string) {
  if (!url) return;
  try {
    console.log(`Syncing questions from: ${url}`);
    const response = await axios.get(url);
    const csvData = response.data;
    
    // Simple CSV parser
    const lines = csvData.split(/\r?\n/).filter((line: string) => line.trim() !== "");
    if (lines.length < 2) {
      console.log("CSV file is empty or has only headers.");
      return;
    }

    // Check if first line is header
    let startIndex = 0;
    if (lines[0].toLowerCase().includes("question") || lines[0].toLowerCase().includes("difficulty")) {
      startIndex = 1;
    }

    const newQuestions = [];
    for (let i = startIndex; i < lines.length; i++) {
      // Naive CSV split that handles quotes
      const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
      
      if (parts.length >= 8) {
        newQuestions.push({
          question: parts[1],
          option1: parts[2],
          option2: parts[3],
          option3: parts[4],
          option4: parts[5],
          answer: parseInt(parts[6]),
          difficulty: parseInt(parts[7]),
          hint: parts[8] || null
        });
      }
    }

    if (newQuestions.length > 0) {
      console.log(`Found ${newQuestions.length} valid questions in CSV. Updating database...`);
      
      // Clear existing questions and insert new ones
      db.prepare("DELETE FROM questions").run();
      const insert = db.prepare(`
        INSERT INTO questions (question, option1, option2, option3, option4, answer, difficulty, hint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const transaction = db.transaction((qs) => {
        for (const q of qs) {
          insert.run(q.question, q.option1, q.option2, q.option3, q.option4, q.answer, q.difficulty, q.hint);
        }
      });
      
      transaction(newQuestions);
      console.log("Database updated with new questions from CSV.");
    } else {
      console.log("No valid questions found in CSV format.");
    }
  } catch (error: any) {
    console.error("Failed to sync questions from URL:", error.message);
  }
}

// Initial sync if URL is provided
const QUESTIONS_URL = process.env.QUESTIONS_CSV_URL || "https://raw.githubusercontent.com/zueitera-cloud/Ramadan/main/questions.csv";
syncQuestionsFromUrl(QUESTIONS_URL);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/leaderboard", (req, res) => {
    const { type } = req.query;
    console.log(`Leaderboard request received: type=${type}`);
    let dateFilter = "";
    
    // SQLite date filtering
    if (type === 'week') {
      // %W: week of year (00-53) with Monday as first day of week
      dateFilter = "WHERE strftime('%Y-%W', date) = strftime('%Y-%W', 'now')";
    } else if (type === 'month') {
      // %m: month (01-12)
      dateFilter = "WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
    } else {
      // Default to all time
      dateFilter = "";
    }

    try {
      // GROUP BY name to ensure unique names, taking the MAX score
      const query = `
        SELECT name, MAX(score) as score, MAX(date) as date 
        FROM scores 
        ${dateFilter}
        GROUP BY name 
        ORDER BY score DESC 
        LIMIT 20
      `;
      const stmt = db.prepare(query);
      const rows = stmt.all();
      console.log(`Leaderboard query returned ${rows.length} rows`);
      res.json(rows);
    } catch (e) {
      console.error("Database error (GET leaderboard):", e);
      res.status(500).json({ error: "Failed to read leaderboard" });
    }
  });

  app.delete("/api/leaderboard/:name", (req, res) => {
    try {
      const { name } = req.params;
      const stmt = db.prepare("DELETE FROM scores WHERE name = ?");
      stmt.run(name);
      console.log(`Moderation: Deleted user ${name} from leaderboard`);
      res.json({ success: true });
    } catch (e) {
      console.error("Database error (DELETE leaderboard):", e);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  app.post("/api/leaderboard", (req, res) => {
    try {
      const { name, score } = req.body;
      console.log(`Received score submission request: name=${name}, score=${score}`);
      
      if (!name || name.trim() === "" || score === undefined) {
        console.error("Validation failed: Name or score missing");
        return res.status(400).json({ error: "Name and score are required" });
      }

      const stmt = db.prepare("INSERT INTO scores (name, score) VALUES (?, ?)");
      const result = stmt.run(name.trim(), score);
      
      console.log(`Score saved successfully. Row ID: ${result.lastInsertRowid}`);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
      console.error("Database error (POST leaderboard):", e);
      res.status(500).json({ error: "Failed to save score" });
    }
  });

  app.get("/api/questions", (req, res) => {
    try {
      // Get one random question for each difficulty level from 1 to 16 in a single query
      const queries = [];
      for (let i = 1; i <= 16; i++) {
        queries.push(`SELECT * FROM (SELECT * FROM questions WHERE difficulty = ${i} ORDER BY RANDOM() LIMIT 1)`);
      }
      const fullQuery = queries.join(" UNION ALL ");
      
      const stmt = db.prepare(fullQuery);
      const rows = stmt.all() as any[];
      
      const questions = rows.map(q => ({
        id: q.id,
        question: q.question,
        options: [q.option1, q.option2, q.option3, q.option4],
        answer: q.answer,
        difficulty: q.difficulty,
        hint: q.hint
      }));
      
      res.json(questions);
    } catch (e) {
      console.error("Database error (GET questions):", e);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  app.post("/api/admin/sync-questions", async (req, res) => {
    const { url } = req.body;
    const targetUrl = url || QUESTIONS_URL;
    await syncQuestionsFromUrl(targetUrl);
    res.json({ success: true, message: "Sync process triggered. Check server logs for details." });
  });

  app.post("/api/seed-questions", (req, res) => {
    // Keep this endpoint for manual seeding if needed, but it's now automatic on startup
    try {
      const { questions } = req.body;
      const insert = db.prepare(`
        INSERT INTO questions (question, option1, option2, option3, option4, answer, difficulty, hint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const transaction = db.transaction((qs) => {
        for (const q of qs) {
          insert.run(q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.answer, q.difficulty, q.hint || null);
        }
      });
      
      transaction(questions);
      res.json({ success: true, count: questions.length });
    } catch (e) {
      console.error("Seed error:", e);
      res.status(500).json({ error: "Failed to seed questions" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
