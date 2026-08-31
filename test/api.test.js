import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { TodoStore } from '../src/database.js';
import { createApp } from '../src/server.js';

test('to-do API supports create, list, update, delete', async (t) => {
  const app = await startTestApp(t);

  const created = await app.request('/api/todo', {
    method: 'POST',
    body: JSON.stringify({ task: '  Buy milk  ' })
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.todo.task, 'Buy milk');
  assert.equal(created.body.todo.completed, false);

  const listed = await app.request('/api/todo');
  assert.equal(listed.body.todos.length, 1);

  const updated = await app.request(`/api/todo/${created.body.todo.id}`, {
    method: 'PUT',
    body: JSON.stringify({ task: 'Buy oat milk', completed: true })
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.todo.task, 'Buy oat milk');
  assert.equal(updated.body.todo.completed, true);

  const deleted = await app.request(`/api/todo/${created.body.todo.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);

  const empty = await app.request('/api/todo');
  assert.deepEqual(empty.body.todos, []);
});

test('reminder endpoint validates phone numbers and sends selected tasks', async (t) => {
  const sent = [];
  const app = await startTestApp(t, {
    smsClient: {
      async send(message) {
        sent.push(message);
        return { provider: 'test', to: message.to, characterCount: message.message.length };
      }
    }
  });

  const first = await app.request('/api/todo', {
    method: 'POST',
    body: JSON.stringify({ task: 'Call dentist' })
  });
  await app.request('/api/todo', {
    method: 'POST',
    body: JSON.stringify({ task: 'Water plants' })
  });

  const invalid = await app.request('/api/reminder', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: '555-1234', taskIds: [first.body.todo.id] })
  });
  assert.equal(invalid.status, 400);

  const reminder = await app.request('/api/reminder', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: '+15551234567', taskIds: [first.body.todo.id] })
  });

  assert.equal(reminder.status, 200);
  assert.equal(reminder.body.reminder.taskCount, 1);
  assert.match(reminder.body.reminder.message, /1\. Call dentist/);
  assert.equal(sent[0].to, '+15551234567');
  assert.equal(sent[0].message, reminder.body.reminder.message);
});

test('static file server rejects path traversal', async (t) => {
  const app = await startTestApp(t);
  const response = await app.request('/../README.md');

  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'Not found.');
});

async function startTestApp(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'todo-api-'));
  const store = new TodoStore(join(directory, 'todos.sqlite'));
  const server = createApp({ store, ...options });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => {
    server.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    request: async (path, options = {}) => {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const text = await response.text();
      return {
        status: response.status,
        body: text ? JSON.parse(text) : null
      };
    }
  };
}
