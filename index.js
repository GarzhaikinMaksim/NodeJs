import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { openDb, migrate, queries } from "./db.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://127.0.0.1:5173","http://localhost:5173"]
}));

const PORT = Number(process.env.PORT ?? 8000);
const DB_FILE = process.env.DATABASE_FILE ?? "./notes.db";
const db = openDb(DB_FILE);
migrate(db);

const NoteCreate = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1)
});
const NoteUpdate = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional()
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/notes", (req, res) => {
  const parsed = NoteCreate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { title, content } = parsed.data;
  const stmt = queries.create(db);
  const info = stmt.run(title.trim(), content.trim());
  const row = queries.getOne(db).get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.get("/api/notes", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const limit = Math.min(Number(req.query.limit ?? 10), 100);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const sort = req.query.sort === "updated_at" ? "updated_at" : "created_at";
  const order = req.query.order === "asc" ? "ASC" : "DESC";

  const rows = queries.list(db, { q, sort, order, limit, offset });
  res.json(rows);
});

app.get("/api/notes/:id", (req, res) => {
  const row = queries.getOne(db).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

app.patch("/api/notes/:id", (req, res) => {
  const parsed = NoteUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const id = Number(req.params.id);
  const exists = queries.getOne(db).get(id);
  if (!exists) return res.status(404).json({ error: "Not found" });

  const { title, content } = parsed.data;
  queries.update(db).run(title?.trim() ?? null, content?.trim() ?? null, id);
  const updated = queries.getOne(db).get(id);
  res.json(updated);
});

app.delete("/api/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = queries.del(db).run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

if (process.argv.includes("--init")) {
  const seed = db.prepare("INSERT INTO notes (title, content) VALUES (?, ?)");
  seed.run("Добро пожаловать", "Это ваша первая заметка 🎉");
  seed.run("Горячие клавиши", "Создать, редактировать, удалить — всё просто.");
  console.log("Seeded. Run server normally now.");
  process.exit(0);
}

app.listen(PORT, () => console.log(`API listening on http://127.0.0.1:${PORT}`));
