"""User management rules (section 3).

Every operation here is ADMIN-only; the role check itself lives in the
endpoint dependency, so these methods assume an authorised caller.
"""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.certificate import Certificate
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.repositories.user import UserRepository, normalize_email
from app.schemas.common import PaginationParams
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)

    async def list_users(
        self,
        pagination: PaginationParams,
        *,
        search: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
    ) -> tuple[Sequence[User], int]:
        return await self.users.search_page(
            limit=pagination.limit,
            offset=pagination.offset,
            search=search,
            role=role,
            status=status,
        )

    async def get_user(self, user_id: UUID) -> User:
        user = await self.users.get(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return user

    async def create_user(self, payload: UserCreate) -> User:
        email = normalize_email(payload.email)
        if await self.users.email_exists(email):
            raise ConflictError("A user with that email already exists.")

        user = User(
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=email,
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
        self.users.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update_user(self, user_id: UUID, payload: UserUpdate) -> User:
        user = await self.get_user(user_id)
        changes = payload.model_dump(exclude_unset=True)

        if "email" in changes and changes["email"] is not None:
            email = normalize_email(changes["email"])
            if email != user.email and await self.users.email_exists(email):
                raise ConflictError("A user with that email already exists.")
            changes["email"] = email

        for field, value in changes.items():
            if value is not None:
                setattr(user, field, value)

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def set_role(self, user_id: UUID, role: UserRole) -> User:
        """Role changes go through their own endpoint rather than a general
        update, so an escalation cannot ride along inside a profile edit."""
        user = await self.get_user(user_id)
        user.role = role
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def set_status(self, user_id: UUID, status: UserStatus) -> User:
        user = await self.get_user(user_id)
        user.status = status
        if status is not UserStatus.ACTIVE:
            # Deactivating also cuts off existing refresh tokens.
            user.token_version += 1
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def delete_user(self, user_id: UUID) -> None:
        """Admin force-delete: cascade-removes all dependent records."""
        from app.models.assignment import Assignment
        from app.models.certificate import Certificate
        from app.models.course import Course
        from app.models.enrollment import Enrollment

        user = await self.get_user(user_id)

        # 1. Courses owned by this user → their enrollments & assignments first
        courses = (
            await self.session.scalars(select(Course).where(Course.created_by == user_id))
        ).all()

        for course in courses:
            # Certificates → enrollments → assignments (order matters for RESTRICT)
            enrollments = (
                await self.session.scalars(
                    select(Enrollment).where(Enrollment.course_id == course.id)
                )
            ).all()
            for enrollment in enrollments:
                if enrollment.certificate:
                    await self.session.delete(enrollment.certificate)
                await self.session.delete(enrollment)

            course_assignments = (
                await self.session.scalars(
                    select(Assignment).where(Assignment.course_id == course.id)
                )
            ).all()
            for assignment in course_assignments:
                await self.session.delete(assignment)

            await self.session.delete(course)

        # 2. Remaining assignments where this user is assignee or assigner
        remaining_assignments = (
            await self.session.scalars(
                select(Assignment).where(
                    or_(
                        Assignment.user_id == user_id,
                        Assignment.assigned_by == user_id,
                    )
                )
            )
        ).all()
        for assignment in remaining_assignments:
            await self.session.delete(assignment)

        # 3. Remaining enrollments (courses owned by others)
        remaining_enrollments = (
            await self.session.scalars(
                select(Enrollment).where(Enrollment.user_id == user_id)
            )
        ).all()
        enrollment_ids = [e.id for e in remaining_enrollments]
        if enrollment_ids:
            certificates = (
                await self.session.scalars(
                    select(Certificate).where(Certificate.enrollment_id.in_(enrollment_ids))
                )
            ).all()
            for certificate in certificates:
                await self.session.delete(certificate)
        for enrollment in remaining_enrollments:
            await self.session.delete(enrollment)

        # 4. The user themselves
        await self.session.delete(user)
        await self.session.commit()
