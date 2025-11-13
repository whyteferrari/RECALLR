const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// DATABASE CONNECTION
// =====================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "recallr",
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB connection error:", err);
  } else {
    console.log("✅ Connected to MySQL database 'recallr'");
  }
});

// =====================
// SIGNUP
// =====================
app.post("/api/signup", (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword)
    return res.status(400).json({ message: "All fields are required." });

  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters." });

  if (password !== confirmPassword)
    return res.status(400).json({ message: "Passwords do not match." });

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error." });
    if (results.length > 0)
      return res.status(400).json({ message: "Email already registered." });

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.query(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Database error." });

        // ✅ Return username along with userId
        res.status(201).json({
          message: "User registered!",
          userId: result.insertId,
          username: username
        });
      }
    );
  });
});


// =====================
// LOGIN
// =====================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Both fields are required." });

  db.query(
    "SELECT * FROM users WHERE email = ? OR username = ?",
    [username, username],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error." });
      if (results.length === 0) return res.status(400).json({ message: "User not found." });

      const user = results[0];
      const isMatch = bcrypt.compareSync(password, user.password_hash);
      if (!isMatch) return res.status(400).json({ message: "Incorrect password." });

      // Update last login
      db.query("UPDATE users SET last_login = NOW() WHERE user_id = ?", [user.user_id]);

      // Return both userId and username so frontend can store it
      res.json({ 
        message: `Welcome back, ${user.username}!`, 
        userId: user.user_id,
        username: user.username  // <-- add this
      });
    }
  );
});


// =====================
// DECKS
// =====================
// Create deck
app.post("/api/decks", (req, res) => {
  let { userId, name, folder, color, description } = req.body;
  userId = parseInt(userId, 10);

  if (!userId || !name || !color)
    return res.status(400).json({ error: "User, name, and color are required." });

  db.query(
    "INSERT INTO decks (user_id, name, folder, color, description) VALUES (?, ?, ?, ?, ?)",
    [userId, name, folder || "", color, description || ""],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, userId, name, folder, color, description });
    }
  );
});

// Get all decks of a user
app.get("/api/decks/:userId", (req, res) => {
  const { userId } = req.params;
  db.query("SELECT * FROM decks WHERE user_id = ? AND archived = 0", [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get single deck by deckId
app.get("/api/decks/:deckId/detail", (req, res) => {
  const { deckId } = req.params;
  db.query("SELECT * FROM decks WHERE deck_id = ?", [deckId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Deck not found" });
    res.json(results[0]);
  });
});

// Update deck info
app.put("/api/decks/:deckId", (req, res) => {
  const { deckId } = req.params;
  const { userId, name, folder, color, description } = req.body;

  if (!userId || !name || !color)
    return res.status(400).json({ error: "User, name, and color are required." });

  db.query(
    "UPDATE decks SET name = ?, folder = ?, color = ?, description = ? WHERE deck_id = ? AND user_id = ?",
    [name, folder || "", color, description || "", deckId, userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0)
        return res.status(404).json({ error: "Deck not found or not owned by user." });
      res.json({ message: "Deck updated successfully!" });
    }
  );
});

// =====================
// FLASHCARDS
// =====================
// Get flashcards of a deck
app.get("/api/decks/:deckId/flashcards", (req, res) => {
  const { deckId } = req.params;
  db.query("SELECT * FROM flashcards WHERE deck_id = ?", [deckId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Add single flashcard
app.post("/api/decks/:deckId/flashcards", (req, res) => {
  const { deckId } = req.params;
  const { term, definition } = req.body;

  if (!term || !definition) return res.status(400).json({ error: "Term and definition required." });

  db.query(
    "INSERT INTO flashcards (deck_id, term, definition) VALUES (?, ?, ?)",
    [deckId, term, definition],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, deckId, term, definition });
    }
  );
});

// Bulk add/update/delete flashcards
app.post("/api/decks/:deckId/flashcards/bulk", async (req, res) => {
  const { deckId } = req.params;
  const { flashcards } = req.body;

  if (!Array.isArray(flashcards))
    return res.status(400).json({ error: "Flashcards array required." });

  try {
    // Get all existing flashcards for this deck
    const [existing] = await db.promise().query(
      "SELECT flashcard_id FROM flashcards WHERE deck_id = ?",
      [deckId]
    );

    const existingIds = existing.map(f => f.flashcard_id);
    const sentIds = flashcards.filter(f => f.id).map(f => Number(f.id));

    // 🔹 1. Delete flashcards that were removed
    const toDelete = existingIds.filter(id => !sentIds.includes(id));
    if (toDelete.length > 0) {
      await db.promise().query(
        `DELETE FROM flashcards WHERE flashcard_id IN (${toDelete.map(() => "?").join(",")})`,
        toDelete
      );
    }

    // 🔹 2. Update existing flashcards
    for (const fc of flashcards) {
      if (fc.id) {
        await db.promise().query(
          "UPDATE flashcards SET term = ?, definition = ? WHERE flashcard_id = ? AND deck_id = ?",
          [fc.term, fc.definition, fc.id, deckId]
        );
      }
    }

    // 🔹 3. Insert new flashcards
    const newCards = flashcards.filter(fc => !fc.id);
    if (newCards.length > 0) {
      const values = newCards.map(fc => [deckId, fc.term, fc.definition]);
      await db.promise().query(
        "INSERT INTO flashcards (deck_id, term, definition) VALUES ?",
        [values]
      );
    }

    res.json({
      message: "Flashcards updated successfully!",
      stats: {
        deleted: toDelete.length,
        updated: sentIds.length,
        inserted: newCards.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// Get all folders for a user, with deck count
app.get("/api/folders/:userId", (req, res) => {
  const { userId } = req.params;
  db.query(
    "SELECT folder AS name, COUNT(*) AS deckCount FROM decks WHERE user_id = ? GROUP BY folder",
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// Optional: you may want to add deck term counts in /api/decks/:userId
app.get("/api/decks/:userId", (req, res) => {
  const { userId } = req.params;
  db.query(
    `SELECT d.deck_id, d.name, d.folder, d.color, 
            IFNULL(f.termCount,0) AS termCount
     FROM decks d
     LEFT JOIN (
       SELECT deck_id, COUNT(*) AS termCount
       FROM flashcards
       GROUP BY deck_id
     ) f ON d.deck_id = f.deck_id
     WHERE d.user_id = ?`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// =====================
// Get all flashcards for a user dynamically
app.get("/api/flashcards/:userId", (req, res) => {
  const { userId } = req.params;

  if (!userId) return res.status(400).json({ error: "User ID required" });

  const query = `
    SELECT f.flashcard_id AS id, f.deck_id AS deckId, f.term, f.definition
    FROM flashcards f
    JOIN decks d ON f.deck_id = d.deck_id
    WHERE d.user_id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    // Return a flat array for frontend
    res.json(results);
  });
});

// Archive a deck
app.post("/api/decks/:deckId/archive", async (req, res) => {
  const { deckId } = req.params;
  try {
    await db.promise().query(
      "UPDATE decks SET archived = 1 WHERE deck_id = ?",
      [deckId]
    );
    res.json({ message: "Deck archived successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/decks/:userId/archived', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [decks] = await db.promise().query(
      'SELECT * FROM decks WHERE user_id = ? AND archived = 1',
      [userId]
    );
    res.json(decks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/decks/:deckId/recover', async (req, res) => {
  const deckId = req.params.deckId;
  try {
    await db.promise().query('UPDATE decks SET archived = 0 WHERE deck_id = ?', [deckId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/decks/:deckId', async (req, res) => {
  const deckId = req.params.deckId;
  try {
    await db.promise().query('DELETE FROM decks WHERE deck_id = ?', [deckId]);

    await db.promise().query('DELETE FROM flashcards WHERE deck_id = ?', [deckId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/user/:userId/ongoing-decks", (req, res) => {
  const { userId } = req.params;
  db.query("SELECT deck_id, name FROM decks WHERE user_id = ? AND archived = 0", [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});

app.get("/api/user/:userId/tasks", (req, res) => {
  const { userId } = req.params;
  const query = "SELECT t.*, d.name AS deck_name FROM tasks t JOIN decks d ON t.deck_id = d.deck_id WHERE t.user_id = ?";
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json(results);
  });
});

// Add a new task
app.post("/api/user/:userId/tasks", (req, res) => {
  const { userId } = req.params;
  const { deck_id, task_time, color } = req.body;

  if (!deck_id || !task_time || !color) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sql = `
    INSERT INTO tasks (user_id, deck_id, task_time, color)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [userId, deck_id, task_time, color], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: "Task added successfully", taskId: result.insertId });
  });
});


// Update a task using patch
app.patch("/api/user/:userId/tasks/:taskId", (req, res) => {
  const { taskId } = req.params;
  const { completed } = req.body;

  const query = "UPDATE tasks SET completed = ? WHERE task_id = ?";
  db.query(query, [completed, taskId], (err) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: "Task updated" });
  });
});

// Delete a task
app.delete("/api/user/:userId/tasks/:taskId", (req, res) => {
  const { taskId } = req.params;
  db.query("DELETE FROM tasks WHERE task_id = ?", [taskId], (err) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    res.json({ message: "Task deleted" });
  });
});
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
