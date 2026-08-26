"""Aggregates every /api/v1 route."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    answers,
    assignments,
    auth,
    certificates,
    contents,
    courses,
    health,
    learning,
    modules,
    my_learning,
    questions,
    quizzes,
    users,
)

api_router = APIRouter()

# Public and infrastructure
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(certificates.router)

# Administration
api_router.include_router(users.router)
api_router.include_router(admin.router)

# Course authoring
api_router.include_router(courses.router)
api_router.include_router(modules.router)
api_router.include_router(contents.router)
api_router.include_router(quizzes.router)
api_router.include_router(questions.router)
api_router.include_router(answers.router)

# Assignment and reporting on owned courses
api_router.include_router(assignments.course_router)
api_router.include_router(assignments.router)
api_router.include_router(admin.course_router)

# Learner
api_router.include_router(learning.enroll_router)
api_router.include_router(my_learning.router)
api_router.include_router(learning.my_router)
