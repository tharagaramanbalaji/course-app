"""Schema-level guarantees: defaults, uniqueness, check constraints, cascades."""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import (
    Answer,
    Base,
    Certificate,
    Content,
    ContentType,
    Course,
    CourseStatus,
    Enrollment,
    EnrollmentSource,
    EnrollmentStatus,
    Module,
    ModuleProgress,
    ProgressStatus,
    Question,
    Quiz,
    QuizAttempt,
    User,
    UserRole,
    UserStatus,
)
from tests import factories as f

EXPECTED_TABLES = {
    "users",
    "courses",
    "modules",
    "contents",
    "quizzes",
    "questions",
    "answers",
    "assignments",
    "enrollments",
    "content_progress",
    "module_progress",
    "quiz_attempts",
    "quiz_attempt_answers",
    "certificates",
}


def test_metadata_defines_every_required_table():
    assert set(Base.metadata.tables) == EXPECTED_TABLES


async def test_new_user_defaults_to_active_learner(db_session):
    user = await f.make_user(db_session)

    assert user.role is UserRole.USER
    assert user.status is UserStatus.ACTIVE
    assert user.id is not None
    assert user.created_at is not None


async def test_new_course_defaults_to_private_draft(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, owner)

    assert course.status is CourseStatus.DRAFT
    assert course.allow_self_enrollment is False
    assert course.published_at is None
    assert course.is_editable is True


async def test_email_must_be_unique(db_session):
    await f.make_user(db_session, email="dup@example.com")

    db_session.add(
        User(first_name="Other", last_name="Person", email="dup@example.com", password_hash="x")
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_module_order_is_unique_within_a_course(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    await f.make_module(db_session, course, display_order=1)

    db_session.add(Module(course_id=course.id, title="Clash", display_order=1))
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_module_order_may_repeat_across_courses(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    first = await f.make_course(db_session, owner, title="One")
    second = await f.make_course(db_session, owner, title="Two")

    first_module = await f.make_module(db_session, first, display_order=1)
    second_module = await f.make_module(db_session, second, display_order=1)

    # Ordering is scoped to the course, so the same position is fine in both.
    assert first_module.display_order == second_module.display_order


async def test_display_order_must_be_positive(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)

    db_session.add(Module(course_id=course.id, title="Zeroth", display_order=0))
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_a_module_can_have_only_one_quiz(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)
    await f.make_quiz(db_session, module)

    db_session.add(Quiz(module_id=module.id, title="Second", passing_score=Decimal("50.00")))
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.parametrize("passing_score", ["-1.00", "100.01"])
async def test_passing_score_must_be_a_percentage(db_session, passing_score):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)

    db_session.add(Quiz(module_id=module.id, title="Quiz", passing_score=Decimal(passing_score)))
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_max_attempts_may_be_null_but_not_zero(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    unlimited = await f.make_module(db_session, course, display_order=1)
    invalid = await f.make_module(db_session, course, display_order=2)

    quiz = await f.make_quiz(db_session, unlimited, max_attempts=None)
    assert quiz.max_attempts is None  # NULL means unlimited retries

    db_session.add(
        Quiz(
            module_id=invalid.id,
            title="Quiz",
            passing_score=Decimal("70.00"),
            max_attempts=0,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_question_points_must_be_positive(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)

    db_session.add(
        Question(quiz_id=quiz.id, question_text="Free?", points=Decimal("0.00"), display_order=1)
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_text_content_requires_a_body(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)

    db_session.add(
        Content(
            module_id=module.id,
            title="Empty",
            content_type=ContentType.TEXT,
            content_body=None,
            display_order=1,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_video_content_requires_a_url(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)

    db_session.add(
        Content(
            module_id=module.id,
            title="No source",
            content_type=ContentType.VIDEO,
            video_url=None,
            display_order=1,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_one_enrollment_per_user_and_course(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    await f.make_enrollment(db_session, course, learner)

    db_session.add(
        Enrollment(
            course_id=course.id,
            user_id=learner.id,
            source=EnrollmentSource.ASSIGNMENT,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_enrollment_defaults_to_active_and_incomplete(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)

    enrollment = await f.make_enrollment(db_session, course, learner)

    assert enrollment.status is EnrollmentStatus.ACTIVE
    assert enrollment.completed_at is None


async def test_attempt_number_is_unique_per_enrollment_and_quiz(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    enrollment = await f.make_enrollment(db_session, course, learner)

    db_session.add(QuizAttempt(quiz_id=quiz.id, enrollment_id=enrollment.id, attempt_number=1))
    await db_session.flush()

    db_session.add(QuizAttempt(quiz_id=quiz.id, enrollment_id=enrollment.id, attempt_number=1))
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_a_started_attempt_has_no_score_yet(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    enrollment = await f.make_enrollment(db_session, course, learner)

    attempt = QuizAttempt(quiz_id=quiz.id, enrollment_id=enrollment.id, attempt_number=1)
    db_session.add(attempt)
    await db_session.flush()

    assert attempt.score is None
    assert attempt.passed is None
    assert attempt.is_submitted is False


async def test_certificate_number_is_unique(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)

    first = await f.make_user(db_session, email="a@example.com")
    first_enrollment = await f.make_enrollment(db_session, course, first)
    db_session.add(
        Certificate(
            certificate_number="CERT-0001",
            enrollment_id=first_enrollment.id,
            participant_name=first.full_name,
            course_name=course.title,
            completion_date=first_enrollment.started_at,
            final_score=Decimal("88.50"),
        )
    )
    await db_session.flush()

    second = await f.make_user(db_session, email="b@example.com")
    second_enrollment = await f.make_enrollment(db_session, course, second)
    db_session.add(
        Certificate(
            certificate_number="CERT-0001",
            enrollment_id=second_enrollment.id,
            participant_name=second.full_name,
            course_name=course.title,
            completion_date=second_enrollment.started_at,
            final_score=Decimal("91.00"),
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_one_certificate_per_enrollment(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    enrollment = await f.make_enrollment(db_session, course, learner)

    db_session.add(
        Certificate(
            certificate_number="CERT-0001",
            enrollment_id=enrollment.id,
            participant_name=learner.full_name,
            course_name=course.title,
            completion_date=enrollment.started_at,
            final_score=Decimal("90.00"),
        )
    )
    await db_session.flush()

    db_session.add(
        Certificate(
            certificate_number="CERT-0002",
            enrollment_id=enrollment.id,
            participant_name=learner.full_name,
            course_name=course.title,
            completion_date=enrollment.started_at,
            final_score=Decimal("90.00"),
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_module_progress_starts_not_started(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    module = await f.make_module(db_session, course)
    enrollment = await f.make_enrollment(db_session, course, learner)

    progress = ModuleProgress(enrollment_id=enrollment.id, module_id=module.id)
    db_session.add(progress)
    await db_session.flush()

    assert progress.status is ProgressStatus.NOT_STARTED
    assert progress.is_complete is False

    progress.content_completed = True
    progress.quiz_passed = True
    assert progress.is_complete is True


async def test_deleting_a_draft_course_removes_its_structure(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)
    await f.make_content(db_session, module)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    await f.make_answers(db_session, question)
    await db_session.commit()

    course = await db_session.get(Course, course.id)
    await db_session.delete(course)
    await db_session.commit()

    for model in (Module, Content, Quiz, Question, Answer):
        rows = (await db_session.scalars(select(model))).all()
        assert rows == [], f"{model.__name__} rows survived the course deletion"
