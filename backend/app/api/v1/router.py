"""Aggregates every /api/v1 route.

Feature routers (auth, courses, modules, quizzes, enrollments, progress,
certificates, admin/user dashboards) get included here as they are built.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import health

api_router = APIRouter()
api_router.include_router(health.router)
