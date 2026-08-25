"""Repository behaviour, especially the filtering that must happen in SQL."""

from datetime import UTC, datetime
from decimal import Decimal

from app.models import (
    Assignment,
    Certificate,
    ContentProgress,
    CourseStatus,
    QuizAttempt,
    UserRole,
)
from app.repositories import (
    AnswerRepository,
    AssignmentRepository,
    CertificateRepository,
    ContentProgressRepository,
    ContentRepository,
    CourseRepository,
    EnrollmentRepository,
    ModuleRepository,
    QuizAttemptRepository,
    QuizRepository,
    UserRepository,
    normalize_email,
)
from tests import factories as f


def test_email_normalisation_lowercases_and_trims():
    assert normalize_email("  Owner@Example.COM ") == "owner@example.com"


async def test_users_are_found_regardless_of_email_case(db_session):
    await f.make_user(db_session, email="Owner@Example.com", role=UserRole.INSTRUCTOR)
    repo = UserRepository(db_session)

    found = await repo.get_by_email("OWNER@EXAMPLE.COM")

    assert found is not None
    assert found.email == "owner@example.com"
    assert await repo.email_exists("owner@example.com") is True


async def test_a_course_is_only_readable_by_its_owner(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.INSTRUCTOR)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, owner)
    repo = CourseRepository(db_session)

    assert await repo.get_owned(course.id, owner.id) is not None
    assert await repo.get_owned(course.id, other.id) is None


async def test_owner_listing_excludes_other_owners_courses(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.INSTRUCTOR)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    await f.make_course(db_session, owner, title="Mine")
    await f.make_course(db_session, other, title="Theirs")
    repo = CourseRepository(db_session)

    mine = await repo.list_by_owner(owner.id)

    assert [c.title for c in mine] == ["Mine"]


async def test_catalogue_shows_published_courses_only(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.INSTRUCTOR)
    await f.make_course(db_session, owner, title="Draft", status=CourseStatus.DRAFT)
    await f.make_course(db_session, owner, title="Archived", status=CourseStatus.ARCHIVED)
    published = await f.make_course(
        db_session, owner, title="Published", status=CourseStatus.PUBLISHED
    )
    repo = CourseRepository(db_session)

    catalogue = await repo.list_catalogue()

    assert [c.title for c in catalogue] == ["Published"]

    published.allow_self_enrollment = True
    await db_session.flush()
    assert len(await repo.list_catalogue(self_enrollable_only=True)) == 1


async def test_a_module_from_another_course_is_not_returned(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    first = await f.make_course(db_session, owner, title="One")
    second = await f.make_course(db_session, owner, title="Two")
    module = await f.make_module(db_session, first)
    repo = ModuleRepository(db_session)

    assert await repo.get_in_course(module.id, first.id) is not None
    assert await repo.get_in_course(module.id, second.id) is None


async def test_display_order_continues_from_the_last_item(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    modules = ModuleRepository(db_session)

    assert await modules.next_display_order(course.id) == 1
    module = await f.make_module(db_session, course, display_order=1)
    assert await modules.next_display_order(course.id) == 2

    contents = ContentRepository(db_session)
    assert await contents.next_display_order(module.id) == 1
    await f.make_content(db_session, module, display_order=1)
    assert await contents.next_display_order(module.id) == 2


async def test_an_answer_from_another_question_is_not_returned(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    first = await f.make_question(db_session, quiz, display_order=1)
    second = await f.make_question(db_session, quiz, display_order=2)
    answers = await f.make_answers(db_session, first)
    repo = AnswerRepository(db_session)

    assert await repo.get_in_question(answers[0].id, first.id) is not None
    assert await repo.get_in_question(answers[0].id, second.id) is None


async def test_correct_answers_can_be_counted_for_validation(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    await f.make_answers(db_session, question)

    assert await AnswerRepository(db_session).count_correct(question.id) == 1


async def test_quiz_is_reachable_from_its_module(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    course = await f.make_course(db_session, owner)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    await f.make_answers(db_session, question)
    await db_session.commit()
    repo = QuizRepository(db_session)

    assert (await repo.get_by_module(module.id)).id == quiz.id

    loaded = await repo.get_with_questions(quiz.id)
    assert len(loaded.questions) == 1
    assert len(loaded.questions[0].answers) == 2
    assert loaded.total_points == Decimal("10.00")


async def test_attempt_numbers_are_assigned_by_the_backend(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    enrollment = await f.make_enrollment(db_session, course, learner)
    repo = QuizAttemptRepository(db_session)

    assert await repo.next_attempt_number(enrollment.id, quiz.id) == 1

    db_session.add(
        QuizAttempt(
            quiz_id=quiz.id,
            enrollment_id=enrollment.id,
            attempt_number=1,
            submitted_at=datetime.now(UTC),
            score=Decimal("40.00"),
            passed=False,
        )
    )
    await db_session.flush()

    assert await repo.next_attempt_number(enrollment.id, quiz.id) == 2
    assert await repo.count_for_quiz(enrollment.id, quiz.id) == 1
    assert await repo.get_active(enrollment.id, quiz.id) is None


async def test_an_unsubmitted_attempt_counts_as_active(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    enrollment = await f.make_enrollment(db_session, course, learner)

    db_session.add(QuizAttempt(quiz_id=quiz.id, enrollment_id=enrollment.id, attempt_number=1))
    await db_session.flush()

    active = await QuizAttemptRepository(db_session).get_active(enrollment.id, quiz.id)
    assert active is not None
    assert active.is_submitted is False


async def test_content_progress_is_counted_per_module(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    module = await f.make_module(db_session, course)
    first = await f.make_content(db_session, module, display_order=1)
    await f.make_content(db_session, module, display_order=2)
    enrollment = await f.make_enrollment(db_session, course, learner)
    repo = ContentProgressRepository(db_session)

    assert await repo.count_completed_in_module(enrollment.id, module.id) == 0

    db_session.add(
        ContentProgress(
            enrollment_id=enrollment.id,
            content_id=first.id,
            completed=True,
            completed_at=datetime.now(UTC),
        )
    )
    await db_session.flush()

    assert await repo.count_completed_in_module(enrollment.id, module.id) == 1
    assert await repo.get_for_content(enrollment.id, first.id) is not None


async def test_an_enrollment_is_only_readable_by_its_learner(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session, email="learner@example.com")
    intruder = await f.make_user(db_session, email="intruder@example.com")
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    enrollment = await f.make_enrollment(db_session, course, learner)
    repo = EnrollmentRepository(db_session)

    assert await repo.get_owned_by_user(enrollment.id, learner.id) is not None
    assert await repo.get_owned_by_user(enrollment.id, intruder.id) is None


async def test_ownership_of_assignments_comes_from_the_course_not_the_assigner(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.INSTRUCTOR)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)

    # Assigned by a different admin: ownership still belongs to the course owner.
    db_session.add(
        Assignment(course_id=course.id, user_id=learner.id, assigned_by=other.id)
    )
    await db_session.flush()
    repo = AssignmentRepository(db_session)

    assert len(await repo.list_for_owner(owner.id)) == 1
    assert len(await repo.list_for_owner(other.id)) == 0
    assert await repo.get_active(course.id, learner.id) is not None


async def test_enrollments_are_listed_for_the_owning_instructor(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.INSTRUCTOR)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    await f.make_enrollment(db_session, course, learner)
    repo = EnrollmentRepository(db_session)

    assert len(await repo.list_for_owner(owner.id)) == 1
    assert len(await repo.list_for_owner(other.id)) == 0


async def test_certificates_are_found_by_enrollment_number_and_user(db_session):
    owner = await f.make_user(db_session, email="owner@example.com", role=UserRole.ADMIN)
    learner = await f.make_user(db_session)
    course = await f.make_course(db_session, owner, status=CourseStatus.PUBLISHED)
    enrollment = await f.make_enrollment(db_session, course, learner)
    db_session.add(
        Certificate(
            certificate_number="CERT-2026-0001",
            enrollment_id=enrollment.id,
            participant_name=learner.full_name,
            course_name=course.title,
            completion_date=datetime.now(UTC),
            final_score=Decimal("92.25"),
        )
    )
    await db_session.flush()
    repo = CertificateRepository(db_session)

    assert await repo.get_by_enrollment(enrollment.id) is not None
    assert await repo.get_by_number("CERT-2026-0001") is not None
    assert await repo.number_exists("CERT-9999-0000") is False
    assert len(await repo.list_for_user(learner.id)) == 1
