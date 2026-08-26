"""Training content authoring and the learner view (section 6)."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, ConflictError
from app.models.content import Content
from app.models.enrollment import Enrollment
from app.models.enums import ContentType
from app.models.user import User
from app.repositories.course import ContentRepository
from app.repositories.progress import ContentProgressRepository
from app.schemas.content import (
    ContentCreate,
    ContentLearnerRead,
    ContentReorder,
    ContentUpdate,
)
from app.services.authoring import AuthoringGuard, apply_order, validate_reorder


class ContentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.guard = AuthoringGuard(session)
        self.contents = ContentRepository(session)
        self.progress = ContentProgressRepository(session)

    # --- authoring -----------------------------------------------------

    async def create_content(
        self,
        author: User,
        course_id: UUID,
        module_id: UUID,
        payload: ContentCreate,
    ) -> Content:
        module = await self.guard.draft_module(author, course_id, module_id)

        display_order = payload.display_order
        if display_order is None:
            display_order = await self.contents.next_display_order(module.id)
        else:
            await self._require_free_position(module.id, display_order)

        content = Content(
            module_id=module.id,
            title=payload.title,
            content_type=payload.content_type,
            content_body=payload.content_body,
            video_url=payload.video_url,
            display_order=display_order,
        )
        self.contents.add(content)
        await self.session.commit()
        await self.session.refresh(content)
        return content

    async def list_for_author(
        self, author: User, course_id: UUID, module_id: UUID
    ) -> Sequence[Content]:
        module = await self.guard.module(author, course_id, module_id)
        return await self.contents.list_by_module(module.id)

    async def get_for_author(
        self, author: User, course_id: UUID, module_id: UUID, content_id: UUID
    ) -> Content:
        return await self.guard.content(author, course_id, module_id, content_id)

    async def update_content(
        self,
        author: User,
        course_id: UUID,
        module_id: UUID,
        content_id: UUID,
        payload: ContentUpdate,
    ) -> Content:
        content = await self.guard.draft_content(author, course_id, module_id, content_id)
        changes = payload.model_dump(exclude_unset=True)

        new_order = changes.pop("display_order", None)
        if new_order is not None and new_order != content.display_order:
            await self._require_free_position(content.module_id, new_order)
            content.display_order = new_order

        for field, value in changes.items():
            if value is not None:
                setattr(content, field, value)

        self._require_payload_matches_type(content)

        await self.session.commit()
        await self.session.refresh(content)
        return content

    async def delete_content(
        self, author: User, course_id: UUID, module_id: UUID, content_id: UUID
    ) -> None:
        content = await self.guard.draft_content(author, course_id, module_id, content_id)
        await self.contents.delete(content)
        await self.session.commit()

    async def reorder_contents(
        self, author: User, course_id: UUID, module_id: UUID, payload: ContentReorder
    ) -> Sequence[Content]:
        module = await self.guard.draft_module(author, course_id, module_id)
        contents = list(await self.contents.list_by_module(module.id))

        validate_reorder([c.id for c in contents], payload.content_ids, noun="content item")
        await apply_order(self.session, contents, payload.content_ids)

        await self.session.commit()
        return await self.contents.list_by_module(module.id)

    async def _require_free_position(self, module_id: UUID, display_order: int) -> None:
        taken = await self.contents.exists(
            Content.module_id == module_id, Content.display_order == display_order
        )
        if taken:
            raise ConflictError(
                f"Another content item already occupies position {display_order}. "
                "Use the reorder endpoint to move items around."
            )

    @staticmethod
    def _require_payload_matches_type(content: Content) -> None:
        """An edit must not leave a TEXT item without a body, or a VIDEO
        item without a URL. Checked here so the caller gets a business-rule
        error rather than a database integrity failure."""
        if content.content_type is ContentType.TEXT and not content.content_body:
            raise BusinessRuleError("TEXT content requires contentBody.")
        if content.content_type is ContentType.VIDEO and not content.video_url:
            raise BusinessRuleError("VIDEO content requires videoUrl.")

    # --- learner view --------------------------------------------------

    async def list_for_learner(
        self, enrollment: Enrollment, module_id: UUID
    ) -> list[ContentLearnerRead]:
        contents = await self.contents.list_by_module(module_id)
        progress_rows = await self.progress.list_for_enrollment(enrollment.id)
        completed_ids = {row.content_id for row in progress_rows if row.completed}

        return [
            ContentLearnerRead(
                id=content.id,
                title=content.title,
                content_type=content.content_type,
                content_body=content.content_body,
                video_url=content.video_url,
                display_order=content.display_order,
                completed=content.id in completed_ids,
            )
            for content in contents
        ]
