import { createReadStream, existsSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { TodoStore, ValidationError } from './database.js';
import { createSmsClient, formatReminderMessage, validatePhoneNumber } from './sms.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_PUBLIC_DIR = resolve(__dirname, '../public');

export function createApp({ store = new TodoStore(), smsClient = createSmsClient(), publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  return createHttpServer(async (request, response) => {
    try {
      addSecurityHeaders(response);
      const url = new URL(request.url, 'http://localhost');

      if (url.pathname === '/api/todo' && request.method === 'GET') {
        return sendJson(response, 200, { todos: store.list() });
      }

      if (url.pathname === '/api/todo' && request.method === 'POST') {
        const body = await readJson(request);
        return sendJson(response, 201, { todo: store.create(body.task) });
      }

      const todoMatch = url.pathname.match(/^\/api\/todo\/([^/]+)$/);
      if (todoMatch && request.method === 'PUT') {
        const body = await readJson(request);
        if (!Object.hasOwn(body, 'task') && !Object.hasOwn(body, 'completed')) {
          return sendJson(response, 400, { error: 'Provide task text or completed status to update.' });
        }
        const todo = store.update(decodeURIComponent(todoMatch[1]), body);
        return todo ? sendJson(response, 200, { todo }) : sendJson(response, 404, { error: 'To-do item not found.' });
      }

      if (todoMatch && request.method === 'DELETE') {
        const deleted = store.delete(decodeURIComponent(todoMatch[1]));
        if (deleted) {
          response.writeHead(204);
          return response.end();
        }
        return sendJson(response, 404, { error: 'To-do item not found.' });
      }

      if (url.pathname === '/api/reminder' && request.method === 'POST') {
        const body = await readJson(request);
        return sendJson(response, 200, { reminder: await sendReminder(body, store, smsClient) });
      }

      if (request.method === 'GET') {
        return serveStatic(url.pathname, response, publicDir);
      }

      return sendJson(response, 405, { error: 'Method not allowed.' });
    } catch (error) {
      if (error instanceof ValidationError || error.name === 'SyntaxError') {
        return sendJson(response, 400, { error: error.message });
      }
      return sendJson(response, 500, { error: 'Unexpected server error.' });
    }
  });
}

async function sendReminder(body, store, smsClient) {
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  if (!validatePhoneNumber(phoneNumber)) {
    throw new ValidationError('Enter a phone number in E.164 format, for example +15551234567.');
  }

  const todos = store.list();
  const selectedTodos = Array.isArray(body.taskIds) && body.taskIds.length > 0
    ? todos.filter((todo) => body.taskIds.includes(todo.id))
    : todos.filter((todo) => !todo.completed);

  if (selectedTodos.length === 0) {
    throw new ValidationError('Select at least one to-do item to send.');
  }

  const message = formatReminderMessage(selectedTodos);
  const delivery = await smsClient.send({ to: phoneNumber, message });
  return {
    provider: delivery.provider,
    taskCount: selectedTodos.length,
    message,
    delivery
  };
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) {
      throw new ValidationError('Request body is too large.');
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function serveStatic(pathname, response, publicDir) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const root = resolve(publicDir);
  const filePath = resolve(root, `.${safePath}`);
  const relativePath = relative(root, filePath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath) || !existsSync(filePath)) {
    return sendJson(response, 404, { error: 'Not found.' });
  }

  const stream = createReadStream(filePath);
  stream.on('open', () => {
    response.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600'
    });
    stream.pipe(response);
  });
  stream.on('error', (error) => {
    if (!response.headersSent) {
      return sendJson(response, 500, { error: 'Unable to read static file.' });
    }
    return response.destroy(error);
  });
}

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml'
  }[extname(filePath)] || 'application/octet-stream';
}

function addSecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp();
  server.listen(port, () => {
    console.log(`To-do list app listening on http://localhost:${port}`);
  });
}
