"""
Import custom courses from backend/data/courses.json into PostgreSQL database.
Optionally clear existing courses, enrollments, and progress before loading.

Usage:
    .venv/Scripts/python scripts/import_courses_json.py [--clear]
"""

import asyncio
import json
import sys
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select

from app.db.session import AsyncSessionLocal
from app.models.assignment import Assignment
from app.models.certificate import Certificate
from app.models.content import Content
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.enums import ContentType, CourseStatus
from app.models.module import Module
from app.models.progress import ContentProgress, ModuleProgress
from app.models.quiz import Answer, Question, Quiz
from app.models.quiz_attempt import QuizAttempt, QuizAttemptAnswer
from app.models.user import User

INSTRUCTOR_EMAIL = "instructor@example.com"
JSON_FILE_PATH = Path(__file__).resolve().parents[1] / "data" / "courses.json"


async def import_courses(json_path: Path | str | None = None, clear_existing: bool = False):
    target_path = Path(json_path) if json_path else JSON_FILE_PATH
    if not target_path.exists():
        print(f"[ERROR] File not found at {target_path}")
        print("Please save your generated courses JSON to backend/data/courses.json")
        return

    with open(target_path, "r", encoding="utf-8") as f:
        courses_data = json.load(f)

    async with AsyncSessionLocal() as session:
        # Find instructor user
        result = await session.execute(select(User).where(User.email == INSTRUCTOR_EMAIL))
        instructor = result.scalar_one_or_none()
        if not instructor:
            print(f"[ERROR] Instructor user {INSTRUCTOR_EMAIL} not found. Run scripts/seed.py first!")
            return

        if clear_existing:
            print("[CLEAR] Clearing all existing courses, enrollments, progress, and assignments...")
            await session.execute(delete(QuizAttemptAnswer))
            await session.execute(delete(QuizAttempt))
            await session.execute(delete(ContentProgress))
            await session.execute(delete(ModuleProgress))
            await session.execute(delete(Certificate))
            await session.execute(delete(Enrollment))
            await session.execute(delete(Assignment))
            await session.execute(delete(Answer))
            await session.execute(delete(Question))
            await session.execute(delete(Quiz))
            await session.execute(delete(Content))
            await session.execute(delete(Module))
            await session.execute(delete(Course))
            await session.commit()
            print("[SUCCESS] Reset all courses and learner enrollments/assignments!")

        created_count = 0
        for item in courses_data:
            course = Course(
                created_by=instructor.id,
                title=item["title"],
                description=item["description"],
                category=item.get("category", "General"),
                allow_self_enrollment=item.get("allow_self_enrollment", True),
                status=CourseStatus[item.get("status", "PUBLISHED")],
                published_at=datetime.now(UTC) if item.get("status") == "PUBLISHED" else None,
            )
            session.add(course)
            await session.flush()

            for m_idx, m_data in enumerate(item.get("modules", []), start=1):
                module = Module(
                    course_id=course.id,
                    title=m_data["title"],
                    description=m_data.get("description", ""),
                    display_order=m_idx,
                )
                session.add(module)
                await session.flush()

                # Add contents
                for c_idx, c_data in enumerate(m_data.get("contents", []), start=1):
                    c_type = ContentType[c_data["type"]]
                    content = Content(
                        module_id=module.id,
                        content_type=c_type,
                        title=c_data["title"],
                        content_body=c_data.get("body") if c_type == ContentType.TEXT else None,
                        video_url=c_data.get("url") if c_type == ContentType.VIDEO else None,
                        display_order=c_idx,
                    )
                    session.add(content)

                # Add Quiz
                quiz_data = m_data.get("quiz")
                if quiz_data:
                    quiz = Quiz(
                        module_id=module.id,
                        title=quiz_data["title"],
                        passing_score=Decimal(str(quiz_data.get("passing_score", 70.0))),
                        max_attempts=quiz_data.get("max_attempts", 3),
                    )
                    session.add(quiz)
                    await session.flush()

                    for q_idx, q_data in enumerate(quiz_data.get("questions", []), start=1):
                        question = Question(
                            quiz_id=quiz.id,
                            question_text=q_data["text"],
                            points=Decimal(str(q_data.get("points", 10.0))),
                            display_order=q_idx,
                        )
                        session.add(question)
                        await session.flush()

                        for a_idx, a_data in enumerate(q_data.get("answers", []), start=1):
                            answer = Answer(
                                question_id=question.id,
                                answer_text=a_data["text"],
                                is_correct=a_data.get("is_correct", False),
                                display_order=a_idx,
                            )
                            session.add(answer)

            created_count += 1
            print(f"  [OK] Imported course: {course.title} ({len(item.get('modules', []))} modules)")

        await session.commit()
        print(f"\n[DONE] Successfully imported {created_count} courses!")


if __name__ == "__main__":
    clear = "--clear" in sys.argv
    asyncio.run(import_courses(clear_existing=clear))
