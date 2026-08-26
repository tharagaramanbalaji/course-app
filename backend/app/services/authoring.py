"""Ownership and lifecycle resolution for course authoring.

Every authoring route has to answer two questions before doing anything:
does the caller own the course this node belongs to, and is that course
still a DRAFT? The endpoints for questions and answers receive only a
quiz or question id, so the answer means walking back up to
``courses.created_by``. That walk lives here rather than being repeated.

A node the caller does not own is reported as missing, not forbidden:
probing ids must not reveal that another author's course exists.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.content import Content
from app.models.course import Course
from app.models.enums import CourseStatus
from app.models.module import Module
from app.models.quiz import Answer, Question, Quiz
from app.models.user import User
from app.repositories.course import ContentRepository, CourseRepository, ModuleRepository
from app.repositories.quiz import AnswerRepository, QuestionRepository, QuizRepository


def _require_draft(course: Course) -> None:
    if course.status is not CourseStatus.DRAFT:
        raise BusinessRuleError(
            f"This course is {course.status.value} and can no longer be edited. "
            "V1 does not support editing after publication."
        )


class AuthoringGuard:
    """Resolves an authoring node, proving ownership on the way down."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.courses = CourseRepository(session)
        self.modules = ModuleRepository(session)
        self.contents = ContentRepository(session)
        self.quizzes = QuizRepository(session)
        self.questions = QuestionRepository(session)
        self.answers = AnswerRepository(session)

    # --- courses -------------------------------------------------------

    async def course(self, author: User, course_id: UUID) -> Course:
        """An owned course in any lifecycle state."""
        course = await self.courses.get_owned(course_id, author.id)
        if course is None:
            raise NotFoundError("Course not found.")
        return course

    async def draft_course(self, author: User, course_id: UUID) -> Course:
        course = await self.course(author, course_id)
        _require_draft(course)
        return course

    # --- modules -------------------------------------------------------

    async def module(self, author: User, course_id: UUID, module_id: UUID) -> Module:
        await self.course(author, course_id)
        module = await self.modules.get_in_course(module_id, course_id)
        if module is None:
            raise NotFoundError("Module not found in this course.")
        return module

    async def draft_module(self, author: User, course_id: UUID, module_id: UUID) -> Module:
        course = await self.draft_course(author, course_id)
        module = await self.modules.get_in_course(module_id, course.id)
        if module is None:
            raise NotFoundError("Module not found in this course.")
        return module

    # --- contents ------------------------------------------------------

    async def content(
        self, author: User, course_id: UUID, module_id: UUID, content_id: UUID
    ) -> Content:
        module = await self.module(author, course_id, module_id)
        content = await self.contents.get_in_module(content_id, module.id)
        if content is None:
            raise NotFoundError("Content not found in this module.")
        return content

    async def draft_content(
        self, author: User, course_id: UUID, module_id: UUID, content_id: UUID
    ) -> Content:
        module = await self.draft_module(author, course_id, module_id)
        content = await self.contents.get_in_module(content_id, module.id)
        if content is None:
            raise NotFoundError("Content not found in this module.")
        return content

    # --- quizzes, questions, answers -----------------------------------
    #
    # These routes are addressed by quiz or question id alone, so ownership
    # is resolved by loading the chain up to the course.

    async def quiz(self, author: User, quiz_id: UUID) -> Quiz:
        quiz = await self.quizzes.get_with_course(quiz_id)
        if quiz is None or quiz.module.course.created_by != author.id:
            raise NotFoundError("Quiz not found.")
        return quiz

    async def draft_quiz(self, author: User, quiz_id: UUID) -> Quiz:
        quiz = await self.quiz(author, quiz_id)
        _require_draft(quiz.module.course)
        return quiz

    async def question(self, author: User, question_id: UUID) -> Question:
        question = await self.questions.get_with_course(question_id)
        if question is None or question.quiz.module.course.created_by != author.id:
            raise NotFoundError("Question not found.")
        return question

    async def draft_question(self, author: User, question_id: UUID) -> Question:
        question = await self.question(author, question_id)
        _require_draft(question.quiz.module.course)
        return question

    async def answer(self, author: User, answer_id: UUID) -> Answer:
        answer = await self.answers.get_with_course(answer_id)
        if answer is None or answer.question.quiz.module.course.created_by != author.id:
            raise NotFoundError("Answer not found.")
        return answer

    async def draft_answer(self, author: User, answer_id: UUID) -> Answer:
        answer = await self.answer(author, answer_id)
        _require_draft(answer.question.quiz.module.course)
        return answer


def validate_reorder(existing_ids: list[UUID], requested_ids: list[UUID], *, noun: str) -> None:
    """A reorder must be a permutation of what already exists.

    Rejecting partial lists keeps the operation total: after it runs, every
    sibling has a known position and no gap or duplicate is possible.
    """
    if len(set(requested_ids)) != len(requested_ids):
        raise BusinessRuleError(f"The same {noun} appears more than once.")

    existing = set(existing_ids)
    requested = set(requested_ids)

    unknown = requested - existing
    if unknown:
        raise BusinessRuleError(
            "Some ids do not belong here.",
            {"unknown": sorted(str(i) for i in unknown)},
        )

    missing = existing - requested
    if missing:
        raise BusinessRuleError(
            f"Every {noun} must be included in a reorder.",
            {"missing": sorted(str(i) for i in missing)},
        )


# Sibling order is unique per parent, so assigning final positions directly
# would collide with whichever row still holds the target value. Everything
# is parked out of the way first. The flush between the two passes is
# essential: without it SQLAlchemy would collapse both assignments into a
# single UPDATE per row and the parking would never reach the database.
REORDER_OFFSET = 100_000


async def apply_order(session: AsyncSession, items: list, requested_ids: list[UUID]) -> None:
    """Renumber ``items`` to match ``requested_ids`` without colliding."""
    by_id = {item.id: item for item in items}

    for index, item in enumerate(items, start=1):
        item.display_order = REORDER_OFFSET + index
    await session.flush()

    for position, item_id in enumerate(requested_ids, start=1):
        by_id[item_id].display_order = position
    await session.flush()
