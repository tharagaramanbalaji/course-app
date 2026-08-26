"""Aggregates every /api/v1 route."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    answers,
    assignments,
    auth,
    contents,
    courses,
    health,
    learning,
    modules,
    questions,
    quizzes,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(courses.router)
api_router.include_router(modules.router)
api_router.include_router(contents.router)
api_router.include_router(quizzes.router)
api_router.include_router(questions.router)
api_router.include_router(answers.router)
api_router.include_router(assignments.course_router)
api_router.include_router(assignments.router)
api_router.include_router(learning.enroll_router)
api_router.include_router(learning.my_router)
