# Course Training Platform

Full-stack course / training application: admins and instructors author courses,
modules, content and quizzes; users consume assigned or self-enrolled courses,
take quizzes, progress module by module, and receive a certificate on completion.

- **Backend:** FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL
- **Frontend:** React (JavaScript), Vite, React Router, TanStack Query, Tailwind
- **API prefix:** `/api/v1`

## Layout

```
course-app/
+-- backend/
|   +-- app/
|   |   +-- api/v1/       # routers + endpoints
|   |   +-- core/         # settings, error envelope
|   |   +-- db/           # declarative base, async session
|   |   +-- models/       # SQLAlchemy models
|   |   +-- repositories/ # data access, ownership and user filtering
|   |   +-- schemas/      # Pydantic request/response models
|   |   +-- services/     # business logic (scoring, progress, completion)
|   |   +-- main.py       # app factory
|   +-- alembic/          # migrations
|   +-- tests/
+-- frontend/
|   +-- src/
|       +-- api/          # axios client
|       +-- app/          # App shell + router
|       +-- components/   # shared UI
|       +-- features/     # feature modules
|       +-- pages/        # route pages
|       +-- test/         # test setup
+-- docker-compose.yml    # PostgreSQL 16
```

## Getting started

### 1. Database

The backend expects a `courseapp` role and a database of the same name on
PostgreSQL 16 or later. Create them once, using your `postgres` superuser
password (on Windows, PostgreSQL 18 installs to `C:\Program Files\PostgreSQL\18`):

```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "CREATE ROLE courseapp LOGIN PASSWORD 'courseapp' CREATEDB;" -c "CREATE DATABASE courseapp OWNER courseapp;"
```

If you have Docker, `docker compose up -d` starts the bundled PostgreSQL 16
container instead; its credentials already match `backend/.env.example`.

Then apply the schema:

```bash
cd backend && .venv/Scripts/python -m alembic upgrade head
```

Create one user per role, for signing in during development:

```bash
cd backend && .venv/Scripts/python scripts/seed.py
```

| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin123! | ADMIN |
| instructor@example.com | Teach123! | INSTRUCTOR |
| learner@example.com | Learn123! | USER |

Once the backend is running, http://localhost:8000/api/v1/health/db confirms the
connection.

### 2. Backend

```bash
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
```

Copy `.env.example` to `.env` and set a real `SECRET_KEY`. Then run the API:

```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs - health check: http://localhost:8000/api/v1/health

Migrations (once models exist):

```bash
cd backend && .venv/Scripts/python -m alembic revision --autogenerate -m "message"
```

```bash
cd backend && .venv/Scripts/python -m alembic upgrade head
```

Tests (SQLite in-memory by default, no Postgres needed):

```bash
cd backend && .venv/Scripts/python -m pytest
```

### 3. Frontend

```bash
cd frontend && npm install
```

```bash
cd frontend && npm run dev
```

App: http://localhost:5173 - `/api` is proxied to the backend on port 8000.

```bash
cd frontend && npm test
```

## Conventions

- UUID primary keys, timestamps on every table (`app/db/base.py` mixins).
- All errors use one envelope: `{"error": {"code", "message", "details"}}`.
- The backend is the source of truth for scoring, progress, completion,
  ownership and certificates - never the client.
