import Database from "better-sqlite3";
import fs from "node:fs";

export function openDb(file) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  return db;
}

export function migrate(db) {
  const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf-8");
  db.exec(schema);
}

export const queries = {
  create: db => db.prepare(
    "INSERT INTO notes (title, content) VALUES (?, ?)"
  ),
  getOne: db => db.prepare("SELECT * FROM notes WHERE id = ?"),
  update: db => db.prepare(
    "UPDATE notes SET title = COALESCE(?, title), content = COALESCE(?, content), updated_at = datetime('now') WHERE id = ?"
  ),
  del: db => db.prepare("DELETE FROM notes WHERE id = ?"),
  list: (db, { q, sort, order, limit, offset }) => {
    const where = q ? "WHERE title LIKE @like OR content LIKE @like" : "";
    const sortCol = sort === "updated_at" ? "updated_at" : "created_at";
    const sortOrder = order?.toUpperCase() === "ASC" ? "ASC" : "DESC";
    const sql = `
      SELECT * FROM notes
      ${where}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT @limit OFFSET @offset
    `;
    return db.prepare(sql).all({
      like: q ? `%${q}%` : undefined,
      limit, offset
    });
  }
};
