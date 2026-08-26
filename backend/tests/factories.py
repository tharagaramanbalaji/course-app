"""Helpers for building the object graph tests need.

These construct valid rows only; the rules about who may create what live in
the service layer and are tested there.
"""

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    Answer,
    Content,
    ContentType,
    Course,
    CourseStatus,
    Enrollment,
    EnrollmentSource,
    Module,
    Question,
    Quiz,
    User,
    UserRole,
    UserStatus,
)
from app.repositories.user import normalize_email

DEFAULT_PASSWORD = "Password123!"
# bcrypt is deliberately slow, so the common case is hashed once per session.
_DEFAULT_PASSWORD_HASH = hash_password(DEFAULT_PASSWORD)


async def make_user(
    session: AsyncSession,
    *,
    email: str = "learner@example.com",
    role: UserRole = UserRole.USER,
    password: str = DEFAULT_PASSWORD,
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    user = User(
        first_name="Test",
        last_name="User",
        email=normalize_email(email),
        password_hash=(
            _DEFAULT_PASSWORD_HASH if password == DEFAULT_PASSWORD else hash_password(password)
        ),
        role=role,
        status=status,
    )
    session.add(user)
    await session.flush()
    return user


async def make_course(
    session: AsyncSession,
    owner: User,
    *,
    title: str = "Security Basics",
    status: CourseStatus = CourseStatus.DRAFT,
) -> Course:
    course = Course(
        title=title,
        description="A course used by the tests.",
        created_by=owner.id,
        status=status,
    )
    session.add(course)
    await session.flush()
    return course


async def make_module(
    session: AsyncSession,
    course: Course,
    *,
    display_order: int = 1,
    title: str = "Module",
) -> Module:
    module = Module(course_id=course.id, title=title, display_order=display_order)
    session.add(module)
    await session.flush()
    return module


async def make_content(
    session: AsyncSession,
    module: Module,
    *,
    display_order: int = 1,
    content_type: ContentType = ContentType.TEXT,
) -> Content:
    content = Content(
        module_id=module.id,
        title="Content",
        content_type=content_type,
        content_body="Body text." if content_type is ContentType.TEXT else None,
        video_url=None if content_type is ContentType.TEXT else "https://example.com/v.mp4",
        display_order=display_order,
    )
    session.add(content)
    await session.flush()
    return content


async def make_quiz(
    session: AsyncSession,
    module: Module,
    *,
    passing_score: str = "70.00",
    max_attempts: int | None = 3,
) -> Quiz:
    quiz = Quiz(
        module_id=module.id,
        title="Module quiz",
        passing_score=Decimal(passing_score),
        max_attempts=max_attempts,
    )
    session.add(quiz)
    await session.flush()
    return quiz


async def make_question(
    session: AsyncSession,
    quiz: Quiz,
    *,
    display_order: int = 1,
    points: str = "10.00",
) -> Question:
    question = Question(
        quiz_id=quiz.id,
        question_text="Which one is correct?",
        points=Decimal(points),
        display_order=display_order,
    )
    session.add(question)
    await session.flush()
    return question


async def make_answers(session: AsyncSession, question: Question) -> list[Answer]:
    answers = [
        Answer(
            question_id=question.id,
            answer_text="Right",
            is_correct=True,
            display_order=1,
        ),
        Answer(
            question_id=question.id,
            answer_text="Wrong",
            is_correct=False,
            display_order=2,
        ),
    ]
    session.add_all(answers)
    await session.flush()
    return answers


async def make_enrollment(
    session: AsyncSession,
    course: Course,
    user: User,
    *,
    source: EnrollmentSource = EnrollmentSource.SELF_ENROLLED,
) -> Enrollment:
    enrollment = Enrollment(course_id=course.id, user_id=user.id, source=source)
    session.add(enrollment)
    await session.flush()
    return enrollment


async def auth_headers(client, email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
    """Log in over HTTP and return the Authorization header for that user."""
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['data']['accessToken']}"}
