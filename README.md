# To-do list reminders

A production-ready Dev implementation of the approved to-do list project. The app provides a browser UI, a Node.js API, SQLite persistence, and an SMS reminder integration path for sending selected tasks to a phone number.

## Features

- Create, view, edit, complete, delete, and select to-do items.
- Send selected tasks to a phone number in E.164 format, such as `+15551234567`.
- Persist tasks in SQLite via the Node.js built-in SQLite module.
- Default dry-run SMS provider for safe local development.
- Optional Azure Communication Services SMS provider for real delivery.
- CI and Azure Web App deployment workflows.

## Run locally

Requires Node.js 22.5 or newer.

```bash
npm test
npm start
```

Then open <http://localhost:3000>.

The default database path is `./data/todos.sqlite`. Override it with `TODO_DB_PATH`.

## SMS configuration

Local development defaults to `SMS_PROVIDER=dry-run`, which formats the reminder and returns a simulated delivery response without sending SMS.

For Azure Communication Services SMS, set these environment variables in Azure App Service application settings or your local shell:

```bash
SMS_PROVIDER=azure
ACS_ENDPOINT=https://<resource-name>.communication.azure.com
ACS_ACCESS_KEY=<access key from Azure; do not commit it>
ACS_FROM_NUMBER=+15551234567
```

Phone numbers are validated at send time and are not persisted by the application.

## API

- `GET /api/todo` — list to-do items.
- `POST /api/todo` — create a to-do item with `{ "task": "..." }`.
- `PUT /api/todo/{id}` — update `task` and/or `completed`.
- `DELETE /api/todo/{id}` — delete a to-do item.
- `POST /api/reminder` — send selected tasks with `{ "phoneNumber": "+15551234567", "taskIds": ["..."] }`.

## Azure deployment

The repository includes:

- `.github/workflows/ci.yml` for pull request validation.
- `.github/workflows/azure-webapp.yml` for deployment to a Dev Azure Web App.
- `infra/main.bicep` for a minimal Linux App Service plan and Web App.

Configure these repository settings before using the deployment workflow:

- Environment variable: `AZURE_WEBAPP_NAME`
- Secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
- App settings for real SMS delivery, if not using dry-run mode.
