# 🎓 LearnFlow — Enterprise Course & Training Platform

A full-stack, enterprise-grade learning management and training platform. Admins and instructors create, structure, and manage courses, multimedia lessons, and quizzes; learners explore assigned and self-enrolled courses, progress through sequential modules, take knowledge checks, and generate verifiable completion certificates upon passing.

---

## 🌟 Key Features

| Domain | Capability | Description |
|---|---|---|
| **Role-Based Access** | 👑 **Admin** | Full system control, user management, course assignment, global analytics & completion metrics. |
| | 🧑‍🏫 **Instructor** | Course authoring studio, module & content builder (Markdown & Video), quiz editor with passing criteria. |
| | 🎓 **Learner** | Catalogue discovery, sequential module progression, interactive quizzes, progress tracking, certificate downloads. |
| **Curriculum Authoring** | 📚 **Modular Learning** | Multi-module courses with text passages and embedded video lectures. |
| | ❓ **Quizzes & Scoring** | Multiple-choice questions with configurable passing scores, question randomization, and attempt limits. |
| | 🔄 **Smart Progression** | Server-side validation, automatic unlocks upon passing quizzes, idempotent progress synchronization. |
| **Certification** | 📜 **Verifiable Certificates** | Unique certificate ID, immutable score & completion date snapshots, print/download ready. |
| **Enterprise Integrations** | 🔐 **SSO & Security** | Google Workspace / OAuth2 SSO support, JWT authentication with token invalidation, role-based route guards. |

---

## 🏗️ Architecture Overview

The platform follows a clean, modular, decoupled client-server architecture with strict separation of concerns and server-side state authority.

```
                                  ┌──────────────────────────────────────────────┐
                                  │             React 18 + Vite SPA              │
                                  │  - React Router DOM v6 (RBAC Route Guards)  │
                                  │  - TanStack Query (Server State Cache)       │
                                  │  - Tailwind CSS & Framer Motion UI           │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                               HTTPS / REST API (JSON)
                                               JWT Bearer Auth Header
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │             FastAPI Backend (Python)         │
                                  ├──────────────────────────────────────────────┤
                                  │ 1. API Routers (`/api/v1/*`)                 │
                                  │ 2. Pydantic v2 Schemas (Validation/DTOs)     │
                                  │ 3. Service Layer (Scoring, Progression, Cert)│
                                  │ 4. Repository Layer (Data Access & Tenancy)  │
                                  │ 5. Security & Auth (JWT, Password Hashing)   │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                SQLAlchemy 2.0 (Async)
                                                Asyncpg Driver (Pool)
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │          PostgreSQL 16 Database              │
                                  │  - Relational Integrity & Cascade Deletes    │
                                  │  - Check Constraints & Unique Indexes        │
                                  │  - Alembic Migration Versioning              │
                                  └──────────────────────────────────────────────┘
```

### Layered Backend Design
1. **API Routers (`app/api/v1/endpoints/`)**: Handle HTTP requests, query parameters, path variables, status codes, and user authorization dependencies.
2. **Schemas (`app/schemas/`)**: Pydantic v2 models that validate inputs, sanitize payloads, and ensure answer keys (`is_correct`) are never leaked to learner clients.
3. **Services (`app/services/`)**: Encapsulate core business logic:
   - `ProgressionService`: Evaluates content completion, quiz results, and unlocks subsequent modules.
   - `QuizService`: Grades attempts against answer keys on the server, calculates percentages, and verifies retry limits.
   - `CertificateService`: Issues tamper-proof certificates upon 100% course completion.
4. **Repositories (`app/repositories/`)**: Abstract database queries, enforcing strict instructor and admin data ownership boundaries.
5. **Database Models (`app/models/`)**: SQLAlchemy 2 declarative models with UUID primary keys and UTC timestamp mixins.

---

## 🗄️ Database Schema & Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    users ||--o{ courses : "creates / owns"
    users ||--o{ assignments : "assigned_to / assigned_by"
    users ||--o{ enrollments : "enrolled_in"

    courses ||--o{ modules : "contains (ordered)"
    courses ||--o{ assignments : "targeted_in"
    courses ||--o{ enrollments : "enrolled_users"

    modules ||--o{ contents : "contains (ordered)"
    modules ||--o| quizzes : "has_assessment"
    modules ||--o{ module_progress : "tracked_for"

    contents ||--o{ content_progress : "tracked_for"

    quizzes ||--o{ questions : "contains (ordered)"
    quizzes ||--o{ quiz_attempts : "attempted_in"

    questions ||--o{ answers : "options"
    questions ||--o{ quiz_attempt_answers : "answered_in"

    enrollments ||--o{ content_progress : "records"
    enrollments ||--o{ module_progress : "records"
    enrollments ||--o{ quiz_attempts : "attempts"
    enrollments ||--o| certificates : "earns_on_completion"

    quiz_attempts ||--o{ quiz_attempt_answers : "contains_answers"

    users {
        uuid id PK
        string email UK
        string first_name
        string last_name
        string password_hash
        enum role "ADMIN | INSTRUCTOR | USER"
        enum status "ACTIVE | SUSPENDED"
        enum auth_provider "LOCAL | GOOGLE"
        int token_version
        datetime created_at
    }

    courses {
        uuid id PK
        string title
        text description
        string category
        string thumbnail_url
        enum status "DRAFT | PUBLISHED | ARCHIVED"
        uuid created_by FK
        boolean allow_self_enrollment
        datetime published_at
        datetime created_at
    }

    modules {
        uuid id PK
        uuid course_id FK
        string title
        text description
        int display_order
        datetime created_at
    }

    contents {
        uuid id PK
        uuid module_id FK
        string title
        enum content_type "TEXT | VIDEO"
        text content_body
        string video_url
        int display_order
        datetime created_at
    }

    quizzes {
        uuid id PK
        uuid module_id FK "UNIQUE"
        string title
        numeric passing_score
        int max_attempts
        boolean randomize_questions
        datetime created_at
    }

    questions {
        uuid id PK
        uuid quiz_id FK
        text question_text
        numeric points
        int display_order
        datetime created_at
    }

    answers {
        uuid id PK
        uuid question_id FK
        text answer_text
        boolean is_correct
        int display_order
        datetime created_at
    }

    assignments {
        uuid id PK
        uuid course_id FK
        uuid user_id FK
        uuid assigned_by FK
        datetime assigned_at
        datetime due_date
        enum status "ASSIGNED | COMPLETED | EXPIRED"
    }

    enrollments {
        uuid id PK
        uuid course_id FK
        uuid user_id FK
        enum source "SELF_ENROLLED | ASSIGNED"
        enum status "ACTIVE | COMPLETED | DROPPED"
        datetime started_at
        datetime completed_at
    }

    module_progress {
        uuid id PK
        uuid enrollment_id FK
        uuid module_id FK
        boolean content_completed
        boolean quiz_passed
        enum status "NOT_STARTED | IN_PROGRESS | COMPLETED"
        datetime completed_at
    }

    content_progress {
        uuid id PK
        uuid enrollment_id FK
        uuid content_id FK
        boolean completed
        datetime completed_at
    }

    quiz_attempts {
        uuid id PK
        uuid quiz_id FK
        uuid enrollment_id FK
        int attempt_number
        numeric score
        boolean passed
        datetime started_at
        datetime submitted_at
    }

    quiz_attempt_answers {
        uuid id PK
        uuid attempt_id FK
        uuid question_id FK
        uuid answer_id FK
        boolean is_correct
        numeric points_earned
    }

    certificates {
        uuid id PK
        string certificate_number UK
        uuid enrollment_id FK "UNIQUE"
        string participant_name
        string course_name
        datetime completion_date
        numeric final_score
        string certificate_url
        datetime created_at
    }
```

---

## 💻 Local Setup Instructions

### Prerequisites
- **Node.js**: v18.0 or later (v20+ recommended)
- **Python**: 3.11 or 3.12
- **PostgreSQL**: PostgreSQL 16+ (or Docker)

---

### Step 1: Database Setup

#### Option A: Using Docker (Fastest)
```bash
docker compose up -d
```
*Starts PostgreSQL 16 on port 5432 with username `courseapp` and password `courseapp`.*

#### Option B: Native PostgreSQL
Execute in PostgreSQL shell (`psql`):
```sql
CREATE ROLE courseapp LOGIN PASSWORD 'courseapp' CREATEDB;
CREATE DATABASE courseapp OWNER courseapp;
```

---

### Step 2: Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   - **Windows**:
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements-dev.txt
   ```

4. **Environment Configuration**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(The default `.env` is preconfigured to connect to `postgresql+asyncpg://courseapp:courseapp@localhost:5432/courseapp`)*.

5. **Run Migrations & Seed Default Data**:
   ```bash
   python scripts/setup_db.py
   ```
   *This automatically applies Alembic migrations, creates default seed accounts, and imports the master course catalog.*

6. **Start the Backend API Server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   - API Root: `http://localhost:8000`
   - Interactive Swagger Docs: `http://localhost:8000/docs`
   - OpenAPI Specification: `http://localhost:8000/openapi.json`
   - Health Check: `http://localhost:8000/api/v1/health`

---

### Step 3: Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Start the Frontend Development Server**:
   ```bash
   npm run dev
   ```
   - Web App URL: `http://localhost:5173`
   - Requests to `/api/*` are automatically proxied to `http://localhost:8000`.

---

## 🔑 Demo & Test Credentials

The database is pre-seeded with accounts for each role:

| Role | Email | Password | Access & Capabilities |
|---|---|---|---|
| 👑 **Admin** | `admin@example.com` | `Admin123!` | System dashboard, user management, course assignment, global analytics. |
| 🧑‍🏫 **Instructor** | `instructor@example.com` | `Teach123!` | Course creation studio, markdown/video lessons, module quizzes. |
| 🎓 **Learner** | `learner@example.com` | `Learn123!` | Course catalog, lesson player, quiz taking, certificate generation. |

---

## 🧪 Running Automated Tests

### Backend Test Suite (Pytest)
Executes 177 unit and integration tests (Auth, RBAC, Course Management, Quiz Grading, Progress Engine, Certificates, SSO):
```bash
cd backend
pytest
```

### Frontend Test Suite (Vitest)
Executes React component and authentication flow tests:
```bash
cd frontend
npm test
```

---

## 📁 Project Structure

```
course-app/
├── backend/
│   ├── alembic/                # Database migrations
│   ├── app/
│   │   ├── api/v1/             # API routes & controllers
│   │   ├── core/               # Configuration, security, error handling
│   │   ├── db/                 # Base classes & async database session
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── repositories/       # Database query abstraction & tenancy
│   │   ├── schemas/            # Pydantic request/response validation
│   │   ├── services/           # Business logic (quiz scoring, certs, progression)
│   │   └── main.py             # FastAPI entrypoint & middleware
│   ├── data/                   # Master course curriculum dataset (JSON)
│   ├── scripts/                # Database bootstrap, migration & seeding scripts
│   └── tests/                  # Backend automated test suite (177 tests)
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios HTTP client & interceptors
│   │   ├── app/                # Root App component & RBAC router
│   │   ├── components/         # Reusable UI components (Modals, Nav, Cards)
│   │   ├── features/           # Feature-specific components
│   │   ├── pages/              # Route pages (Dashboard, Studio, Player, Certs)
│   │   └── test/               # Vitest configuration & mocks
│   └── package.json
├── docker-compose.yml          # Containerized PostgreSQL 16
├── DEPLOYMENT_GUIDE.md         # Production deployment manual (Vercel + Render)
└── README.md                   # Project documentation
```

---

## 🚀 Cloud Deployment

For a 100% free production deployment using **Render** (FastAPI backend + Managed PostgreSQL) and **Vercel** (React SPA frontend), refer to the detailed step-by-step guide in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

