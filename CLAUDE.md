# Course Training Platform — working notes

Full-stack training app. Backend is the source of truth for auth, ownership,
enrollment, progress, quiz scoring, retries, completion and certificates.
Never trust the frontend for business-critical state.

## Stack

FastAPI + SQLAlchemy 2 async + Alembic + PostgreSQL; React (plain JavaScript, no
TypeScript) + Vite + React Router + TanStack Query + Tailwind. Components are
`.jsx`, helpers `.js`, imported through the `@/` alias. All endpoints under `/api/v1`.

## Non-negotiable rules

- Roles: `ADMIN`, `INSTRUCTOR`, `USER`. Authoring is scoped to owned courses:
  every course-scoped admin operation verifies `auth_user.id == course.created_by`.
- Course lifecycle `DRAFT → PUBLISHED → ARCHIVED`. V1 has **no** post-publication
  editing and no versioning; mutations on a published course return a business-rule error.
- Hierarchy: Course → Module → (Content, Quiz → Question → Answer). One quiz per module.
- Module completion is derived: all required content completed **and** quiz passed.
  Course completion is derived: every module completed. No client-driven "complete" endpoints.
- Assignment and Enrollment are separate tables. Enrollment source is
  `ASSIGNMENT` or `SELF_ENROLLED`; self-enrollment requires
  `courses.allow_self_enrollment` and a `PUBLISHED` course.
- Modules are sequential in V1 — the backend decides accessibility (locked/unlocked).
- Quiz security: user-facing responses must never include `isCorrect`. Correctness,
  scoring and pass/fail are computed from the database.
- Attempts: backend assigns the attempt number and enforces `max_attempts`.
- Scoring is points-based: quiz score = earned/possible * 100; final course score
  aggregates across all module quizzes and is stored on the certificate.
- Certificates: generated only on course completion, idempotent (one per enrollment),
  unique certificate number, immutable historical record.
- Quiz submission, course completion and certificate generation are transactional.

## Conventions

- UUID primary keys; `UUIDPrimaryKeyMixin` + `TimestampMixin` from `app/db/base.py`.
- Error envelope: `{"error": {"code", "message", "details"}}` via `app/core/exceptions.py`.
  Raise `NotFoundError` / `ConflictError` / `BusinessRuleError` / `PermissionDeniedError`
  rather than bare `HTTPException`.
- Endpoints stay thin: validation in `schemas/`, rules in `services/`.
- Ownership and user filtering are enforced in the query/service layer, never in the client.
- New models must be imported in `app/models/__init__.py` for Alembic autogenerate.
- Backend tests run against in-memory SQLite via `DATABASE_URL_OVERRIDE`.
