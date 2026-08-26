"""Create one user per role, for local development.

Run from the backend directory:

    .venv/Scripts/python scripts/seed.py

Safe to run repeatedly: existing users are left alone. Development only --
the passwords here are deliberately obvious and must never reach a real
environment.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import hash_password  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402
from app.repositories.user import UserRepository, normalize_email  # noqa: E402

SEED_USERS = [
    ("admin@example.com", "Admin123!", "Ada", "Admin", UserRole.ADMIN),
    ("instructor@example.com", "Teach123!", "Ivan", "Instructor", UserRole.INSTRUCTOR),
    ("learner@example.com", "Learn123!", "Lena", "Learner", UserRole.USER),
]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        users = UserRepository(session)
        created = 0

        for email, password, first_name, last_name, role in SEED_USERS:
            if await users.get_by_email(email):
                print(f"  exists   {email}")
                continue
            users.add(
                User(
                    first_name=first_name,
                    last_name=last_name,
                    email=normalize_email(email),
                    password_hash=hash_password(password),
                    role=role,
                )
            )
            created += 1
            print(f"  created  {email:26} {role.value:11} password: {password}")

        await session.commit()
        print(f"\n{created} user(s) created.")


if __name__ == "__main__":
    asyncio.run(main())
