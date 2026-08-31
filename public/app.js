const todoForm = document.querySelector('#todo-form');
const taskInput = document.querySelector('#task-input');
const todoList = document.querySelector('#todo-list');
const emptyState = document.querySelector('#empty-state');
const reminderForm = document.querySelector('#reminder-form');
const phoneInput = document.querySelector('#phone-input');
const statusMessage = document.querySelector('#status');
const selectAllButton = document.querySelector('#select-all');

let todos = [];

todoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runSafely(async () => {
    await request('/api/todo', {
      method: 'POST',
      body: JSON.stringify({ task: taskInput.value })
    });
    taskInput.value = '';
    await loadTodos();
    showStatus('Task added.');
  });
});

selectAllButton.addEventListener('click', () => {
  document.querySelectorAll('[data-select-task]').forEach((checkbox) => {
    checkbox.checked = true;
  });
});

reminderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runSafely(async () => {
    const taskIds = [...document.querySelectorAll('[data-select-task]:checked')].map((checkbox) => checkbox.value);
    const response = await request('/api/reminder', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: phoneInput.value, taskIds })
    });
    showStatus(`Sent ${response.reminder.taskCount} task(s) with ${response.reminder.provider}.`);
  });
});

async function loadTodos() {
  const response = await request('/api/todo');
  todos = response.todos;
  renderTodos();
}

function renderTodos() {
  todoList.replaceChildren();
  emptyState.hidden = todos.length > 0;

  todos.forEach((todo) => {
    const item = document.createElement('li');
    item.className = todo.completed ? 'todo completed' : 'todo';

    const select = document.createElement('input');
    select.type = 'checkbox';
    select.value = todo.id;
    select.dataset.selectTask = 'true';
    select.ariaLabel = `Select ${todo.task} for reminder`;

    const complete = document.createElement('input');
    complete.type = 'checkbox';
    complete.checked = todo.completed;
    complete.ariaLabel = `Mark ${todo.task} complete`;
    complete.addEventListener('change', () => runSafely(() => updateTodo(todo.id, { completed: complete.checked })));

    const task = document.createElement('span');
    task.textContent = todo.task;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', async () => {
      const nextTask = prompt('Edit task', todo.task);
      if (nextTask !== null) {
        await runSafely(() => updateTodo(todo.id, { task: nextTask }));
      }
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => runSafely(() => deleteTodo(todo.id)));

    item.append(select, complete, task, edit, remove);
    todoList.append(item);
  });
}

async function updateTodo(id, changes) {
  await request(`/api/todo/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(changes)
  });
  await loadTodos();
  showStatus('Task updated.');
}

async function deleteTodo(id) {
  await request(`/api/todo/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await loadTodos();
  showStatus('Task deleted.');
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (response.status === 204) {
    return {};
  }

  const body = await response.json();
  if (!response.ok) {
    showStatus(body.error || 'Request failed.', true);
    throw new Error(body.error || 'Request failed.');
  }
  return body;
}

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = isError ? 'status error' : 'status';
}

async function runSafely(action) {
  try {
    await action();
  } catch (error) {
    showStatus(error.message, true);
  }
}

runSafely(loadTodos);
