"""Dashboards (sections 21 to 25).

Every admin aggregate starts from the set of courses the caller owns and
joins outwards from there. Nothing queries all rows and filters afterwards,
and there is no endpoint that returns another owner's data at all.
"""

from collections.abc import Sequence
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.course import Course
from app.models.enums import CourseStatus, EnrollmentStatus, ProgressStatus
from app.models.user import User
from app.repositories.certificate import CertificateRepository
from app.repositories.course import CourseRepository, ModuleRepository
from app.repositories.enrollment import AssignmentRepository, EnrollmentRepository
from app.repositories.progress import ModuleProgressRepository
from app.repositories.quiz import QuizRepository
from app.repositories.quiz_attempt import QuizAttemptRepository
from app.repositories.user import UserRepository
from app.schemas.dashboard import (
    AdminOverview,
    CompletionRow,
    CourseProgressReport,
    CourseStat,
    LearnerProgressDetail,
    LearnerProgressRow,
    LearnerStat,
    ModuleProgressRow,
    QuizResultRow,
    RecentAttempt,
    UserDashboard,
)
from app.services.authoring import AuthoringGuard
from app.services.enrollment import EnrollmentService
from app.services.progression import as_percentage

RECENT_ATTEMPT_LIMIT = 10


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.courses = CourseRepository(session)
        self.modules = ModuleRepository(session)
        self.quizzes = QuizRepository(session)
        self.enrollments = EnrollmentRepository(session)
        self.assignments = AssignmentRepository(session)
        self.progress = ModuleProgressRepository(session)
        self.attempts = QuizAttemptRepository(session)
        self.certificates = CertificateRepository(session)
        self.users = UserRepository(session)
        self.enrollment_service = EnrollmentService(session)
        self.guard = AuthoringGuard(session)

    # --- learner dashboard (section 21) ---------------------------------

    async def user_dashboard(self, learner: User) -> UserDashboard:
        rows = await self.enrollment_service.my_courses(learner)
        enrollments = await self.enrollments.list_for_user(learner.id)
        assignments = await self.assignments.list_for_user(learner.id)
        certificates = await self.certificates.list_for_user(learner.id)

        recent: list[RecentAttempt] = []
        for enrollment in enrollments:
            course = await self.courses.get(enrollment.course_id)
            for attempt in await self.attempts.list_for_enrollment(enrollment.id):
                quiz = await self.quizzes.get(attempt.quiz_id)
                module = await self.modules.get(quiz.module_id) if quiz else None
                recent.append(
                    RecentAttempt(
                        attempt_id=attempt.id,
                        course_title=course.title if course else "",
                        module_title=module.title if module else "",
                        attempt_number=attempt.attempt_number,
                        score=attempt.score,
                        passed=attempt.passed,
                        submitted_at=attempt.submitted_at,
                    )
                )

        recent.sort(key=lambda a: (a.submitted_at is None, a.submitted_at), reverse=True)

        return UserDashboard(
            assigned_courses=len(
                {a.course_id for a in assignments if a.status.value != "CANCELLED"}
            ),
            self_enrolled_courses=sum(
                1 for e in enrollments if e.source.value == "SELF_ENROLLED"
            ),
            active_courses=sum(
                1 for e in enrollments if e.status is EnrollmentStatus.ACTIVE
            ),
            completed_courses=sum(
                1 for e in enrollments if e.status is EnrollmentStatus.COMPLETED
            ),
            certificates=len(certificates),
            recent_quiz_attempts=recent[:RECENT_ATTEMPT_LIMIT],
            courses=rows,
        )

    # --- admin dashboards (section 22) ----------------------------------

    async def _owned_courses(self, author: User) -> Sequence[Course]:
        return await self.courses.list_by_owner(author.id)

    async def admin_overview(self, author: User) -> AdminOverview:
        courses = await self._owned_courses(author)
        enrollments = await self.enrollments.list_for_owner(author.id)
        assignments = await self.assignments.list_for_owner(author.id)

        completed = [e for e in enrollments if e.status is EnrollmentStatus.COMPLETED]

        scores: list[Decimal] = []
        certificates = 0
        for enrollment in enrollments:
            if await self.certificates.get_by_enrollment(enrollment.id) is not None:
                certificates += 1
            for attempt in await self.attempts.list_for_enrollment(enrollment.id):
                if attempt.score is not None:
                    scores.append(attempt.score)

        average = (
            (sum(scores) / len(scores)).quantize(Decimal("0.01")) if scores else Decimal("0.00")
        )
        rate = (
            (Decimal(len(completed)) / Decimal(len(enrollments)) * 100).quantize(
                Decimal("0.01")
            )
            if enrollments
            else Decimal("0.00")
        )

        return AdminOverview(
            total_courses=len(courses),
            published_courses=sum(1 for c in courses if c.status is CourseStatus.PUBLISHED),
            draft_courses=sum(1 for c in courses if c.status is CourseStatus.DRAFT),
            total_assigned_users=len(
                {a.user_id for a in assignments if a.status.value != "CANCELLED"}
            ),
            active_enrollments=sum(
                1 for e in enrollments if e.status is EnrollmentStatus.ACTIVE
            ),
            completed_enrollments=len(completed),
            certificates_issued=certificates,
            average_quiz_score=average,
            completion_rate=rate,
        )

    async def admin_courses(self, author: User) -> list[CourseStat]:
        stats: list[CourseStat] = []

        for course in await self._owned_courses(author):
            modules = await self.modules.list_by_course(course.id)
            enrollments = await self.enrollments.list_by_course(course.id)
            assignments = await self.assignments.list_by_course(course.id)
            completed = sum(
                1 for e in enrollments if e.status is EnrollmentStatus.COMPLETED
            )

            stats.append(
                CourseStat(
                    course_id=course.id,
                    title=course.title,
                    status=course.status,
                    modules=len(modules),
                    assignments=len(assignments),
                    enrollments=len(enrollments),
                    completed=completed,
                    completion_rate=as_percentage(
                        Decimal(completed), Decimal(len(enrollments) or 0)
                    ),
                )
            )
        return stats

    async def admin_users(self, author: User) -> list[LearnerStat]:
        """Learners associated with owned courses, and nobody else."""
        enrollments = await self.enrollments.list_for_owner(author.id)

        by_user: dict[UUID, list] = {}
        for enrollment in enrollments:
            by_user.setdefault(enrollment.user_id, []).append(enrollment)

        stats: list[LearnerStat] = []
        for user_id, rows in by_user.items():
            learner = await self.users.get(user_id)
            if learner is None:
                continue
            certificates = 0
            for enrollment in rows:
                if await self.certificates.get_by_enrollment(enrollment.id) is not None:
                    certificates += 1
            stats.append(
                LearnerStat(
                    user_id=learner.id,
                    first_name=learner.first_name,
                    last_name=learner.last_name,
                    email=learner.email,
                    enrolled_courses=len(rows),
                    completed_courses=sum(
                        1 for e in rows if e.status is EnrollmentStatus.COMPLETED
                    ),
                    certificates=certificates,
                )
            )
        return stats

    async def admin_progress(self, author: User) -> list[LearnerProgressRow]:
        rows: list[LearnerProgressRow] = []
        for course in await self._owned_courses(author):
            report = await self.course_progress(author, course.id)
            rows.extend(report.learners)
        return rows

    async def admin_quiz_results(self, author: User) -> list[QuizResultRow]:
        rows: list[QuizResultRow] = []
        for course in await self._owned_courses(author):
            rows.extend(await self.course_quiz_results(author, course.id))
        return rows

    async def admin_completions(self, author: User) -> list[CompletionRow]:
        rows: list[CompletionRow] = []

        for course in await self._owned_courses(author):
            for enrollment in await self.enrollments.list_by_course(course.id):
                if enrollment.status is not EnrollmentStatus.COMPLETED:
                    continue
                learner = await self.users.get(enrollment.user_id)
                certificate = await self.certificates.get_by_enrollment(enrollment.id)
                rows.append(
                    CompletionRow(
                        course_id=course.id,
                        course_title=course.title,
                        user_id=enrollment.user_id,
                        participant_name=learner.full_name if learner else "",
                        completed_at=enrollment.completed_at,
                        certificate_number=(
                            certificate.certificate_number if certificate else None
                        ),
                        final_score=certificate.final_score if certificate else None,
                    )
                )
        return rows

    # --- per-course reports (sections 23 to 24) -------------------------

    async def course_progress(self, author: User, course_id: UUID) -> CourseProgressReport:
        course = await self.guard.course(author, course_id)
        modules = await self.modules.list_by_course(course.id)
        enrollments = await self.enrollments.list_by_course(course.id)

        learners: list[LearnerProgressRow] = []
        for enrollment in enrollments:
            learner = await self.users.get(enrollment.user_id)
            completed = await self.progress.count_completed(enrollment.id)
            learners.append(
                LearnerProgressRow(
                    user_id=enrollment.user_id,
                    participant_name=learner.full_name if learner else "",
                    email=learner.email if learner else "",
                    course_id=course.id,
                    course_title=course.title,
                    enrollment_status=enrollment.status,
                    completed_modules=completed,
                    total_modules=len(modules),
                    percent_complete=(
                        round(completed / len(modules) * 100) if modules else 0
                    ),
                )
            )

        finished = sum(
            1 for e in enrollments if e.status is EnrollmentStatus.COMPLETED
        )
        return CourseProgressReport(
            course_id=course.id,
            title=course.title,
            total_modules=len(modules),
            total_learners=len(enrollments),
            completed_learners=finished,
            completion_rate=as_percentage(
                Decimal(finished), Decimal(len(enrollments) or 0)
            ),
            learners=learners,
        )

    async def learner_progress(
        self, author: User, course_id: UUID, user_id: UUID
    ) -> LearnerProgressDetail:
        course = await self.guard.course(author, course_id)

        enrollment = await self.enrollments.get_for_user_and_course(user_id, course_id)
        if enrollment is None:
            raise NotFoundError("That user is not enrolled in this course.")

        learner = await self.users.get(user_id)
        modules = await self.modules.list_by_course(course.id)
        rows = {
            row.module_id: row
            for row in await self.progress.list_for_enrollment(enrollment.id)
        }

        module_rows = [
            ModuleProgressRow(
                module_id=module.id,
                module_title=module.title,
                display_order=module.display_order,
                status=(
                    rows[module.id].status if module.id in rows else ProgressStatus.NOT_STARTED
                ),
                content_completed=bool(
                    module.id in rows and rows[module.id].content_completed
                ),
                quiz_passed=bool(module.id in rows and rows[module.id].quiz_passed),
                completed_at=rows[module.id].completed_at if module.id in rows else None,
            )
            for module in modules
        ]
        completed = sum(1 for r in module_rows if r.status is ProgressStatus.COMPLETED)

        return LearnerProgressDetail(
            user_id=user_id,
            participant_name=learner.full_name if learner else "",
            course_id=course.id,
            course_title=course.title,
            enrollment_status=enrollment.status,
            percent_complete=round(completed / len(modules) * 100) if modules else 0,
            modules=module_rows,
        )

    async def course_quiz_results(self, author: User, course_id: UUID) -> list[QuizResultRow]:
        course = await self.guard.course(author, course_id)
        modules = {m.id: m for m in await self.modules.list_by_course(course.id)}

        rows: list[QuizResultRow] = []
        for enrollment in await self.enrollments.list_by_course(course.id):
            learner = await self.users.get(enrollment.user_id)
            for attempt in await self.attempts.list_for_enrollment(enrollment.id):
                quiz = await self.quizzes.get(attempt.quiz_id)
                if quiz is None or quiz.module_id not in modules:
                    continue
                rows.append(
                    QuizResultRow(
                        attempt_id=attempt.id,
                        course_id=course.id,
                        course_title=course.title,
                        module_title=modules[quiz.module_id].title,
                        quiz_title=quiz.title,
                        user_id=enrollment.user_id,
                        participant_name=learner.full_name if learner else "",
                        attempt_number=attempt.attempt_number,
                        score=attempt.score,
                        passed=attempt.passed,
                        submitted_at=attempt.submitted_at,
                    )
                )
        return rows
