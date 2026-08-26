"""Module authoring and the learner's sequential view (section 5)."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enrollment import Enrollment
from app.models.enums import ProgressStatus
from app.models.module import Module
from app.models.user import User
from app.repositories.course import ContentRepository, ModuleRepository
from app.repositories.progress import ModuleProgressRepository
from app.repositories.quiz import QuizRepository
from app.schemas.module import ModuleCreate, ModuleLearnerRead, ModuleReorder, ModuleUpdate
from app.services.authoring import AuthoringGuard, apply_order, validate_reorder


class ModuleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.guard = AuthoringGuard(session)
        self.modules = ModuleRepository(session)
        self.contents = ContentRepository(session)
        self.quizzes = QuizRepository(session)
        self.progress = ModuleProgressRepository(session)

    # --- authoring -----------------------------------------------------

    async def create_module(self, author: User, course_id: UUID, payload: ModuleCreate) -> Module:
        await self.guard.draft_course(author, course_id)

        display_order = payload.display_order
        if display_order is None:
            display_order = await self.modules.next_display_order(course_id)
        else:
            await self._require_free_position(course_id, display_order)

        module = Module(
            course_id=course_id,
            title=payload.title,
            description=payload.description,
            display_order=display_order,
        )
        self.modules.add(module)
        await self.session.commit()
        await self.session.refresh(module)
        return module

    async def list_for_author(self, author: User, course_id: UUID) -> Sequence[Module]:
        await self.guard.course(author, course_id)
        return await self.modules.list_by_course(course_id)

    async def get_for_author(self, author: User, course_id: UUID, module_id: UUID) -> Module:
        return await self.guard.module(author, course_id, module_id)

    async def update_module(
        self,
        author: User,
        course_id: UUID,
        module_id: UUID,
        payload: ModuleUpdate,
    ) -> Module:
        module = await self.guard.draft_module(author, course_id, module_id)
        changes = payload.model_dump(exclude_unset=True)

        new_order = changes.pop("display_order", None)
        if new_order is not None and new_order != module.display_order:
            await self._require_free_position(course_id, new_order)
            module.display_order = new_order

        for field, value in changes.items():
            if value is not None:
                setattr(module, field, value)

        await self.session.commit()
        await self.session.refresh(module)
        return module

    async def delete_module(self, author: User, course_id: UUID, module_id: UUID) -> None:
        module = await self.guard.draft_module(author, course_id, module_id)
        await self.modules.delete(module)
        await self.session.commit()

    async def reorder_modules(
        self, author: User, course_id: UUID, payload: ModuleReorder
    ) -> Sequence[Module]:
        await self.guard.draft_course(author, course_id)
        modules = list(await self.modules.list_by_course(course_id))

        validate_reorder([m.id for m in modules], payload.module_ids, noun="module")
        await apply_order(self.session, modules, payload.module_ids)

        await self.session.commit()
        return await self.modules.list_by_course(course_id)

    async def _require_free_position(self, course_id: UUID, display_order: int) -> None:
        taken = await self.modules.exists(
            Module.course_id == course_id, Module.display_order == display_order
        )
        if taken:
            raise ConflictError(
                f"Another module already occupies position {display_order}. "
                "Use the reorder endpoint to move modules around."
            )

    # --- learner view --------------------------------------------------

    async def list_for_learner(
        self, enrollment: Enrollment, course_id: UUID
    ) -> list[ModuleLearnerRead]:
        """Modules with this learner's progress and unlock state.

        Modules are sequential in V1: one opens only once every earlier
        module is complete. The backend decides this; the client only
        renders what it is told.
        """
        modules = await self.modules.list_by_course(course_id)
        progress_rows = await self.progress.list_for_enrollment(enrollment.id)
        progress_by_module = {row.module_id: row for row in progress_rows}

        view: list[ModuleLearnerRead] = []
        previous_complete = True

        for module in modules:
            row = progress_by_module.get(module.id)
            status = row.status if row else ProgressStatus.NOT_STARTED
            quiz = await self.quizzes.get_by_module(module.id)
            contents = await self.contents.list_by_module(module.id)

            view.append(
                ModuleLearnerRead(
                    id=module.id,
                    title=module.title,
                    description=module.description,
                    display_order=module.display_order,
                    status=status,
                    content_completed=bool(row and row.content_completed),
                    quiz_passed=bool(row and row.quiz_passed),
                    unlocked=previous_complete,
                    has_quiz=quiz is not None,
                    content_count=len(contents),
                )
            )
            previous_complete = status is ProgressStatus.COMPLETED

        return view

    async def get_for_learner(
        self, enrollment: Enrollment, course_id: UUID, module_id: UUID
    ) -> ModuleLearnerRead:
        modules = await self.list_for_learner(enrollment, course_id)
        for module in modules:
            if module.id == module_id:
                return module
        raise NotFoundError("Module not found in this course.")
