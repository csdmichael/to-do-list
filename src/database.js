import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export class TodoStore {
  constructor(dbPath = process.env.TODO_DB_PATH || './data/todos.sqlite') {
    this.dbPath = resolve(dbPath);
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  }

  list() {
    return this.db
      .prepare('SELECT id, task, completed, createdAt, updatedAt FROM todos ORDER BY createdAt ASC')
      .all()
      .map(mapTodo);
  }

  get(id) {
    const todo = this.db
      .prepare('SELECT id, task, completed, createdAt, updatedAt FROM todos WHERE id = ?')
      .get(id);
    return todo ? mapTodo(todo) : null;
  }

  create(task) {
    const now = new Date().toISOString();
    const todo = {
      id: randomUUID(),
      task: normalizeTask(task),
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    this.db
      .prepare('INSERT INTO todos (id, task, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .run(todo.id, todo.task, 0, todo.createdAt, todo.updatedAt);
    return todo;
  }

  update(id, changes) {
    const existing = this.get(id);
    if (!existing) {
      return null;
    }

    const next = {
      ...existing,
      task: Object.hasOwn(changes, 'task') ? normalizeTask(changes.task) : existing.task,
      completed: Object.hasOwn(changes, 'completed') ? Boolean(changes.completed) : existing.completed,
      updatedAt: new Date().toISOString()
    };

    this.db
      .prepare('UPDATE todos SET task = ?, completed = ?, updatedAt = ? WHERE id = ?')
      .run(next.task, next.completed ? 1 : 0, next.updatedAt, id);
    return next;
  }

  delete(id) {
    return this.db.prepare('DELETE FROM todos WHERE id = ?').run(id).changes > 0;
  }

  close() {
    this.db.close();
  }
}

function normalizeTask(task) {
  if (typeof task !== 'string') {
    throw new ValidationError('Task text is required.');
  }

  const normalized = task.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    throw new ValidationError('Task text is required.');
  }
  if (normalized.length > 500) {
    throw new ValidationError('Task text must be 500 characters or fewer.');
  }
  return normalized;
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function mapTodo(row) {
  return {
    id: row.id,
    task: row.task,
    completed: Boolean(row.completed),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
