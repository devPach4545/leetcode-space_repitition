const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const dayjs = require('dayjs');

const app = express();
const db = new Database('leetcode.db');

app.use(cors());
app.use(express.json());

// --- Database Setup ---
// We need two tables: 
// 1. Questions (metadata)
// 2. Schedule (actual dates to practice)
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notes TEXT DEFAULT ''
  );
  
  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES questions (id)
  );
`);

// Add notes column to existing questions table if it doesn't exist
try {
  db.exec(`ALTER TABLE questions ADD COLUMN notes TEXT DEFAULT ''`);
} catch (error) {
  // Column already exists, ignore
}

// --- Helper: Spaced Repetition Calculator ---
const INTERVALS = [1, 3, 6, 12, 24, 48];

const generateSchedule = (questionId, startDate) => {
  const insert = db.prepare('INSERT INTO schedule (question_id, due_date) VALUES (?, ?)');
  
  let currentDate = dayjs(startDate);
  
  const transaction = db.transaction(() => {
    for (const daysToAdd of INTERVALS) {
      // Logic: The next review is X days after the PREVIOUS review date
      currentDate = currentDate.add(daysToAdd, 'day');
      insert.run(questionId, currentDate.format('YYYY-MM-DD'));
    }
  });
  
  transaction();
};

// --- API Endpoints ---

// 1. Add a new question
app.post('/api/questions', (req, res) => {
  const { title } = req.body;
  const today = dayjs().format('YYYY-MM-DD');

  try {
    const stmt = db.prepare('INSERT INTO questions (title, created_at) VALUES (?, ?)');
    const info = stmt.run(title, today);
    
    // Generate the future spaced repetition dates immediately
    generateSchedule(info.lastInsertRowid, today);
    
    res.json({ id: info.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get tasks for a specific date (or today)
app.get('/api/schedule', (req, res) => {
  const { date } = req.query; // Expects YYYY-MM-DD
  const targetDate = date || dayjs().format('YYYY-MM-DD');

  const stmt = db.prepare(`
    SELECT s.id, s.due_date, s.completed, q.title, q.id as question_id, q.notes
    FROM schedule s
    JOIN questions q ON s.question_id = q.id
    WHERE s.due_date = ?
  `);
  
  const tasks = stmt.all(targetDate);
  res.json(tasks);
});

// 3. Mark a scheduled task as done
app.post('/api/schedule/:id/toggle', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('UPDATE schedule SET completed = NOT completed WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

// 4. Get upcoming calendar overview (counts per day)
app.get('/api/calendar-stats', (req, res) => {
  const stmt = db.prepare(`
    SELECT due_date, COUNT(*) as count 
    FROM schedule 
    WHERE completed = 0 
    GROUP BY due_date
  `);
  res.json(stmt.all());
});

// 5. Update notes for a question
app.put('/api/questions/:id/notes', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  try {
    const stmt = db.prepare('UPDATE questions SET notes = ? WHERE id = ?');
    stmt.run(notes || '', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get notes for a question
app.get('/api/questions/:id/notes', (req, res) => {
  const { id } = req.params;
  
  try {
    const stmt = db.prepare('SELECT notes FROM questions WHERE id = ?');
    const result = stmt.get(id);
    res.json({ notes: result?.notes || '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});