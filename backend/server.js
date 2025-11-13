const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// DATABASE CONNECTION
// =====================
const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL database 'recallr'"))
  .catch(err => console.error("❌ DB connection error:", err));

// =====================
// SIGNUP
// =====================
app.post("/api/signup", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword)
    return res.status(400).json({ message: "All fields are required." });

  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters." });

  if (password !== confirmPassword)
    return res.status(400).json({ message: "Passwords do not match." });

  try {
    const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (rows.length > 0) return res.status(400).json({ message: "Email already registered." });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const insertResult = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id",
      [username, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered!",
      userId: insertResult.rows[0].user_id,
      username,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error." });
  }
});

// =====================
// LOGIN
// =====================
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Both fields are required." });

  try {
    const { rows } = await db.query(
      "SELECT * FROM users WHERE email=$1 OR username=$2",
      [username, username]
    );
    if (rows.length === 0) return res.status(400).json({ message: "User not found." });

    const user = rows[0];
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: "Incorrect password." });

    await db.query("UPDATE users SET last_login = NOW() WHERE user_id=$1", [user.user_id]);

    res.json({
      message: `Welcome back, ${user.username}!`,
      userId: user.user_id,
      username: user.username,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error." });
  }
});

// =====================
// DECKS
// =====================
app.post("/api/decks", async (req, res) => {
  let { userId, name, folder, color, description } = req.body;
  userId = parseInt(userId, 10);

  if (!userId || !name || !color)
    return res.status(400).json({ error: "User, name, and color are required." });

  try {
    const insertResult = await db.query(
      "INSERT INTO decks (user_id, name, folder, color, description) VALUES ($1, $2, $3, $4, $5) RETURNING deck_id",
      [userId, name, folder || "", color, description || ""]
    );
    res.json({ id: insertResult.rows[0].deck_id, userId, name, folder, color, description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/decks/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT d.deck_id, d.name, d.folder, d.color,
              COALESCE(f.termCount,0) AS termCount
       FROM decks d
       LEFT JOIN (
         SELECT deck_id, COUNT(*) AS termCount
         FROM flashcards
         GROUP BY deck_id
       ) f ON d.deck_id = f.deck_id
       WHERE d.user_id=$1`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/decks/:deckId/detail", async (req, res) => {
  const { deckId } = req.params;
  try {
    const { rows } = await db.query("SELECT * FROM decks WHERE deck_id=$1", [deckId]);
    if (rows.length === 0) return res.status(404).json({ error: "Deck not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/decks/:deckId", async (req, res) => {
  const { deckId } = req.params;
  const { userId, name, folder, color, description } = req.body;

  if (!userId || !name || !color)
    return res.status(400).json({ error: "User, name, and color are required." });

  try {
    const result = await db.query(
      "UPDATE decks SET name=$1, folder=$2, color=$3, description=$4 WHERE deck_id=$5 AND user_id=$6",
      [name, folder || "", color, description || "", deckId, userId]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Deck not found or not owned by user." });
    res.json({ message: "Deck updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// FLASHCARDS
// =====================
app.get("/api/decks/:deckId/flashcards", async (req, res) => {
  const { deckId } = req.params;
  try {
    const { rows } = await db.query(
      "SELECT flashcard_id AS id, deck_id AS deckId, term, definition FROM flashcards WHERE deck_id=$1",
      [deckId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/decks/:deckId/flashcards", async (req, res) => {
  const { deckId } = req.params;
  const { term, definition } = req.body;

  if (!term || !definition) return res.status(400).json({ error: "Term and definition required." });

  try {
    const insertResult = await db.query(
      "INSERT INTO flashcards (deck_id, term, definition) VALUES ($1, $2, $3) RETURNING flashcard_id",
      [deckId, term, definition]
    );
    res.json({ id: insertResult.rows[0].flashcard_id, deckId, term, definition });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/decks/:deckId/flashcards/bulk", async (req, res) => {
  const { deckId } = req.params;
  const { flashcards } = req.body;

  if (!Array.isArray(flashcards))
    return res.status(400).json({ error: "Flashcards array required." });

  try {
    const { rows: existing } = await db.query("SELECT flashcard_id FROM flashcards WHERE deck_id=$1", [deckId]);
    const existingIds = existing.map(f => f.flashcard_id);
    const sentIds = flashcards.filter(f => f.id).map(f => Number(f.id));

    const toDelete = existingIds.filter(id => !sentIds.includes(id));
    if (toDelete.length > 0) {
      await db.query("DELETE FROM flashcards WHERE flashcard_id = ANY($1)", [toDelete]);
    }

    for (const fc of flashcards) {
      if (fc.id) {
        await db.query(
          "UPDATE flashcards SET term=$1, definition=$2 WHERE flashcard_id=$3 AND deck_id=$4",
          [fc.term, fc.definition, fc.id, deckId]
        );
      }
    }

    const newCards = flashcards.filter(fc => !fc.id);
    for (const fc of newCards) {
      await db.query("INSERT INTO flashcards (deck_id, term, definition) VALUES ($1, $2, $3)", [deckId, fc.term, fc.definition]);
    }

    res.json({ message: "Flashcards updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// FOLDERS
// =====================
app.get("/api/folders/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await db.query(
      "SELECT folder AS name, COUNT(*) AS deckCount FROM decks WHERE user_id=$1 GROUP BY folder",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// TASKS
// =====================
app.get("/api/user/:userId/tasks", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await db.query(
      "SELECT t.*, d.name AS deck_name FROM tasks t JOIN decks d ON t.deck_id=d.deck_id WHERE t.user_id=$1",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

app.post("/api/user/:userId/tasks", async (req, res) => {
  const { userId } = req.params;
  const { deck_id, task_time, color } = req.body;
  if (!deck_id || !task_time || !color)
    return res.status(400).json({ message: "Missing required fields" });

  try {
    const result = await db.query(
      "INSERT INTO tasks (user_id, deck_id, task_time, color) VALUES ($1, $2, $3, $4) RETURNING task_id",
      [userId, deck_id, task_time, color]
    );
    res.json({ message: "Task added successfully", taskId: result.rows[0].task_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

app.patch("/api/user/:userId/tasks/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const { completed } = req.body;
  try {
    await db.query("UPDATE tasks SET completed=$1 WHERE task_id=$2", [completed, taskId]);
    res.json({ message: "Task updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

app.delete("/api/user/:userId/tasks/:taskId", async (req, res) => {
  const { taskId } = req.params;
  try {
    await db.query("DELETE FROM tasks WHERE task_id=$1", [taskId]);
    res.json({ message: "Task deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

// =====================
// ARCHIVE / RECOVER / DELETE
// =====================
app.post("/api/decks/:deckId/archive", async (req, res) => {
  const { deckId } = req.params;
  try {
    await db.query("UPDATE decks SET archived=1 WHERE deck_id=$1", [deckId]);
    res.json({ message: "Deck archived successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/decks/:deckId/recover", async (req, res) => {
  const { deckId } = req.params;
  try {
    await db.query("UPDATE decks SET archived=0 WHERE deck_id=$1", [deckId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/decks/:deckId", async (req, res) => {
  const { deckId } = req.params;
  try {
    await db.query("DELETE FROM flashcards WHERE deck_id=$1", [deckId]);
    await db.query("DELETE FROM decks WHERE deck_id=$1", [deckId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// ONGOING DECKS
// =====================
app.get("/api/user/:userId/ongoing-decks", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await db.query(
      "SELECT deck_id, name FROM decks WHERE user_id=$1 AND archived=0",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});

// =====================
// ALL FLASHCARDS FOR USER
// =====================
app.get("/api/flashcards/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "User ID required" });

  try {
    const { rows } = await db.query(
      `SELECT f.flashcard_id AS id, f.deck_id AS deckId, f.term, f.definition
       FROM flashcards f
       JOIN decks d ON f.deck_id=d.deck_id
       WHERE d.user_id=$1`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
