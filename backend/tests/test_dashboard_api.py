"""Dashboards and reports (sections 21 to 25).

The point of every test here is scoping: an author sees their own courses
and the learners on them, and nothing else.
"""

from decimal import Decimal

from app.models.enums import CourseStatus, UserRole
from tests import factories as f


async def _owned_course(db_session, author, *, title="Owned"):
    course = await f.make_course(
        db_session, author, title=title, status=CourseStatus.PUBLISHED
    )
    module = await f.make_module(db_session, course, title="M1")
    await f.make_content(db_session, module)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    await f.make_answers(db_session, question)
    await db_session.commit()
    return course, module


# --- learner dashboard ------------------------------------------------


async def test_the_learner_dashboard_counts_only_their_own_data(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _owned_course(db_session, author)
    other_course, _ = await _owned_course(db_session, author, title="Other")

    learner = await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    stranger = await f.make_user(db_session, email="sam@example.com", role=UserRole.USER)
    await f.make_enrollment(db_session, course, learner)
    await f.make_enrollment(db_session, other_course, stranger)
    await db_session.commit()
    headers = await f.auth_headers(client, "lena@example.com")

    response = await client.get("/api/v1/my/dashboard", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["activeCourses"] == 1
    assert data["completedCourses"] == 0
    assert data["certificates"] == 0
    assert len(data["courses"]) == 1
    assert data["courses"][0]["courseId"] == str(course.id)


async def test_the_learner_dashboard_needs_authentication(client):
    assert (await client.get("/api/v1/my/dashboard")).status_code == 401


# --- admin dashboards -------------------------------------------------


async def test_the_overview_covers_only_owned_courses(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    await _owned_course(db_session, author, title="Mine A")
    await _owned_course(db_session, author, title="Mine B")

    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    await _owned_course(db_session, other, title="Theirs")
    await db_session.commit()
    headers = await f.auth_headers(client, "ivan@example.com")

    response = await client.get("/api/v1/admin/dashboard/overview", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["totalCourses"] == 2  # not 3
    assert data["publishedCourses"] == 2


async def test_a_learner_cannot_reach_the_admin_dashboard(client, db_session):
    await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    headers = await f.auth_headers(client, "lena@example.com")

    response = await client.get("/api/v1/admin/dashboard/overview", headers=headers)

    assert response.status_code == 403


async def test_course_stats_exclude_other_owners(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    await _owned_course(db_session, author, title="Mine")
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    await _owned_course(db_session, other, title="Theirs")
    await db_session.commit()
    headers = await f.auth_headers(client, "ivan@example.com")

    response = await client.get("/api/v1/admin/dashboard/courses", headers=headers)

    assert [c["title"] for c in response.json()["data"]] == ["Mine"]


async def test_learner_stats_cover_only_learners_on_owned_courses(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _owned_course(db_session, author)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    other_course, _ = await _owned_course(db_session, other, title="Theirs")

    mine = await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    theirs = await f.make_user(db_session, email="sam@example.com", role=UserRole.USER)
    await f.make_enrollment(db_session, course, mine)
    await f.make_enrollment(db_session, other_course, theirs)
    await db_session.commit()
    headers = await f.auth_headers(client, "ivan@example.com")

    response = await client.get("/api/v1/admin/dashboard/users", headers=headers)

    emails = [u["email"] for u in response.json()["data"]]
    assert emails == ["lena@example.com"]
    assert "sam@example.com" not in response.text


# --- per-course reports -----------------------------------------------


async def test_course_progress_is_owner_scoped(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _owned_course(db_session, author)
    learner = await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()

    headers = await f.auth_headers(client, "ivan@example.com")
    response = await client.get(f"/api/v1/courses/{course.id}/progress", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["totalLearners"] == 1
    assert data["totalModules"] == 1
    assert data["learners"][0]["percentComplete"] == 0

    # Another instructor gets nothing, not a filtered view.
    await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    other_headers = await f.auth_headers(client, "other@example.com")
    denied = await client.get(f"/api/v1/courses/{course.id}/progress", headers=other_headers)
    assert denied.status_code == 404


async def test_learner_detail_requires_an_enrollment(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _owned_course(db_session, author)
    stranger = await f.make_user(db_session, email="sam@example.com", role=UserRole.USER)
    await db_session.commit()
    headers = await f.auth_headers(client, "ivan@example.com")

    response = await client.get(
        f"/api/v1/courses/{course.id}/users/{stranger.id}/progress", headers=headers
    )

    assert response.status_code == 404


async def test_learner_detail_lists_every_module(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, module = await _owned_course(db_session, author)
    learner = await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()
    headers = await f.auth_headers(client, "ivan@example.com")

    response = await client.get(
        f"/api/v1/courses/{course.id}/users/{learner.id}/progress", headers=headers
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["percentComplete"] == 0
    assert len(data["modules"]) == 1
    assert data["modules"][0]["moduleId"] == str(module.id)
    assert data["modules"][0]["status"] == "NOT_STARTED"


async def test_quiz_results_are_owner_scoped(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _owned_course(db_session, author)
    await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    await db_session.commit()

    headers = await f.auth_headers(client, "ivan@example.com")
    mine = await client.get(f"/api/v1/courses/{course.id}/quiz-results", headers=headers)
    assert mine.status_code == 200

    other_headers = await f.auth_headers(client, "other@example.com")
    denied = await client.get(
        f"/api/v1/courses/{course.id}/quiz-results", headers=other_headers
    )
    assert denied.status_code == 404


async def test_course_certificates_are_owner_scoped(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _owned_course(db_session, author)
    await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    await db_session.commit()

    headers = await f.auth_headers(client, "ivan@example.com")
    mine = await client.get(f"/api/v1/courses/{course.id}/certificates", headers=headers)
    assert mine.status_code == 200
    assert mine.json()["data"] == []

    other_headers = await f.auth_headers(client, "other@example.com")
    denied = await client.get(
        f"/api/v1/courses/{course.id}/certificates", headers=other_headers
    )
    assert denied.status_code == 404


async def test_an_empty_overview_does_not_divide_by_zero(client, db_session):
    """A brand new author has no enrollments; the rates must still compute."""
    await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    await db_session.commit()
    headers = await f.auth_headers(client, "ivan@example.com")

    response = await client.get("/api/v1/admin/dashboard/overview", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert Decimal(str(data["completionRate"])) == Decimal("0.00")
    assert Decimal(str(data["averageQuizScore"])) == Decimal("0.00")
