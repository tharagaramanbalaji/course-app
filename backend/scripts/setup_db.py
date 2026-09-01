"""Production database setup script.

Performs:
1. Alembic schema migrations (alembic upgrade head)
2. Default user seeding (admin, instructor, learner)
3. Initial master course import from data/courses.json (if courses table is empty)

Can be executed as part of Render build or release command:
    python scripts/setup_db.py
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path

# Add backend root to sys.path
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import select, func  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.course import Course  # noqa: E402
from scripts.seed import main as seed_users  # noqa: E402
from scripts.import_courses_json import import_courses  # noqa: E402


def run_migrations() -> None:
    print("[SETUP] Running database migrations (alembic upgrade head)...")
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("[ERROR] Alembic migrations failed:\n", result.stderr)
        sys.exit(result.returncode)
    print("[OK] Migrations completed successfully.")


async def bootstrap_data() -> None:
    # 1. Seed demo/admin users
    print("\n[SETUP] Seeding default users (admin, instructor, learner)...")
    await seed_users()

    # 2. Check if courses exist; if not, import master course catalog
    print("\n[SETUP] Checking course catalogue...")
    async with AsyncSessionLocal() as session:
        course_count = await session.scalar(select(func.count(Course.id)))

    courses_json_path = BASE_DIR / "data" / "courses.json"
    if course_count == 0 and courses_json_path.exists():
        print(f"[SETUP] Database has 0 courses. Importing master curriculum from {courses_json_path.name}...")
        await import_courses(courses_json_path, clear_existing=False)
        print("[OK] Master course catalog imported successfully.")
    else:
        print(f"[OK] Database already contains {course_count} course(s). Skipping initial JSON import.")


async def main() -> None:
    print("========================================")
    print("  CourseApp Production Database Setup   ")
    print("========================================")
    run_migrations()
    await bootstrap_data()
    print("\n[SUCCESS] Database is fully initialized and ready for production.")


if __name__ == "__main__":
    asyncio.run(main())
