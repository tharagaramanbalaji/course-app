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

PostgreSQL 18 is already installed locally (`C:\Program Files\PostgreSQL\18`)
and listening on port 5432, but the `courseapp` role does not exist yet.
Create it once, using your `postgres` superuser password:

```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "CREATE ROLE courseapp LOGIN PASSWORD 'courseapp' CREATEDB;" -c "CREATE DATABASE courseapp OWNER courseapp;"
```

Docker is not installed on this machine. If you would rather use the bundled
container (Postgres 16), install Docker Desktop and run `docker compose up -d`
instead - the credentials in `docker-compose.yml` match `backend/.env.example`.

Verify the connection at http://localhost:8000/api/v1/health/db once the backend
is running.

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
