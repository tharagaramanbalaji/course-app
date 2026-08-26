"""Assignments, enrollment and the learner's view (sections 10 and 11).

The most important assertions here are the ones proving a learner never
receives correctness information, and that module locking is decided by the
backend rather than the client.
"""

from uuid import UUID

from app.models.enums import CourseStatus, ProgressStatus, UserRole
from app.models.progress import ModuleProgress
from tests import factories as f


async def _course_with_two_modules(db_session, author, *, published=True):
    """A published course whose two modules each have content and a quiz."""
    status = CourseStatus.PUBLISHED if published else CourseStatus.DRAFT
    course = await f.make_course(db_session, author, status=status)

    modules = []
    for order in (1, 2):
        module = await f.make_module(db_session, course, display_order=order, title=f"M{order}")
        await f.make_content(db_session, module)
        quiz = await f.make_quiz(db_session, module)
        question = await f.make_question(db_session, quiz)
        await f.make_answers(db_session, question)
        modules.append((module, quiz, question))
    return course, modules


async def _learner(client, db_session, email="lena@example.com"):
    user = await f.make_user(db_session, email=email, role=UserRole.USER)
    return user, await f.auth_headers(client, email)


# --- assignments -----------------------------------------------------


async def test_assigning_a_course_also_creates_the_enrollment(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "ivan@example.com")
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    learner = await f.make_user(db_session, email="lena@example.com")

    response = await client.post(
        f"/api/v1/courses/{course.id}/assignments",
        headers=headers,
        json={"userId": str(learner.id)},
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["assignedBy"] == str(author.id)
    assert data["status"] == "ASSIGNED"

    learner_headers = await f.auth_headers(client, "lena@example.com")
    mine = await client.get("/api/v1/my/courses", headers=learner_headers)
    rows = mine.json()["data"]
    assert len(rows) == 1
    assert rows[0]["enrollment"]["source"] == "ASSIGNMENT"


async def test_a_draft_course_cannot_be_assigned(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "ivan@example.com")
    course = await f.make_course(db_session, author, status=CourseStatus.DRAFT)
    learner = await f.make_user(db_session, email="lena@example.com")

    response = await client.post(
        f"/api/v1/courses/{course.id}/assignments",
        headers=headers,
        json={"userId": str(learner.id)},
    )

    assert response.status_code == 422


async def test_a_course_cannot_be_assigned_to_an_instructor(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "ivan@example.com")
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)

    response = await client.post(
        f"/api/v1/courses/{course.id}/assignments",
        headers=headers,
        json={"userId": str(other.id)},
    )

    assert response.status_code == 422


async def test_the_same_course_is_not_assigned_twice(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "ivan@example.com")
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    learner = await f.make_user(db_session, email="lena@example.com")
    body = {"userId": str(learner.id)}

    first = await client.post(
        f"/api/v1/courses/{course.id}/assignments", headers=headers, json=body
    )
    second = await client.post(
        f"/api/v1/courses/{course.id}/assignments", headers=headers, json=body
    )

    assert first.status_code == 201
    assert second.status_code == 409


async def test_deleting_an_assignment_cancels_it(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "ivan@example.com")
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    learner = await f.make_user(db_session, email="lena@example.com")
    created = await client.post(
        f"/api/v1/courses/{course.id}/assignments",
        headers=headers,
        json={"userId": str(learner.id)},
    )
    assignment_id = created.json()["data"]["id"]

    response = await client.delete(f"/api/v1/assignments/{assignment_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "CANCELLED"
    # The record survives rather than being destroyed.
    still_there = await client.get(f"/api/v1/assignments/{assignment_id}", headers=headers)
    assert still_there.status_code == 200


async def test_a_learner_sees_only_their_own_assignment(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "ivan@example.com")
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    learner = await f.make_user(db_session, email="lena@example.com")
    created = await client.post(
        f"/api/v1/courses/{course.id}/assignments",
        headers=headers,
        json={"userId": str(learner.id)},
    )
    assignment_id = created.json()["data"]["id"]

    _, intruder_headers = await _learner(client, db_session, email="nosy@example.com")
    response = await client.get(
        f"/api/v1/assignments/{assignment_id}", headers=intruder_headers
    )

    assert response.status_code == 404


# --- self-enrollment -------------------------------------------------


async def test_self_enrollment_requires_the_course_to_allow_it(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    _, headers = await _learner(client, db_session)

    response = await client.post(f"/api/v1/courses/{course.id}/enroll", headers=headers)

    assert response.status_code == 422
    assert "self-enrollment" in response.json()["error"]["message"]


async def test_a_draft_course_cannot_be_joined(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author, status=CourseStatus.DRAFT)
    course.allow_self_enrollment = True
    await db_session.flush()
    _, headers = await _learner(client, db_session)

    response = await client.post(f"/api/v1/courses/{course.id}/enroll", headers=headers)

    assert response.status_code == 422


async def test_a_learner_can_join_an_open_course_once(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    course.allow_self_enrollment = True
    await db_session.flush()
    _, headers = await _learner(client, db_session)

    first = await client.post(f"/api/v1/courses/{course.id}/enroll", headers=headers)
    second = await client.post(f"/api/v1/courses/{course.id}/enroll", headers=headers)

    assert first.status_code == 201
    assert first.json()["data"]["source"] == "SELF_ENROLLED"
    assert first.json()["data"]["status"] == "ACTIVE"
    assert second.status_code == 409


async def test_my_courses_reports_progress(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, modules = await _course_with_two_modules(db_session, author)
    course.allow_self_enrollment = True
    await db_session.flush()
    _, headers = await _learner(client, db_session)
    enroll = await client.post(f"/api/v1/courses/{course.id}/enroll", headers=headers)
    enrollment_id = UUID(enroll.json()["data"]["id"])

    response = await client.get(f"/api/v1/my/courses/{course.id}", headers=headers)

    assert response.status_code == 200
    progress = response.json()["data"]["progress"]
    assert progress == {"totalModules": 2, "completedModules": 0, "percentComplete": 0}

    # Completing the first module moves the summary to half.
    db_session.add(
        ModuleProgress(
            enrollment_id=enrollment_id,
            module_id=modules[0][0].id,
            content_completed=True,
            quiz_passed=True,
            status=ProgressStatus.COMPLETED,
        )
    )
    await db_session.commit()

    updated = await client.get(f"/api/v1/my/courses/{course.id}", headers=headers)
    assert updated.json()["data"]["progress"]["percentComplete"] == 50


async def test_an_unenrolled_learner_cannot_open_a_course(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _course_with_two_modules(db_session, author)
    _, headers = await _learner(client, db_session)

    response = await client.get(f"/api/v1/my/courses/{course.id}", headers=headers)

    assert response.status_code == 404


# --- learner views: security and sequencing --------------------------


async def test_a_learner_never_receives_correct_answer_information(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, modules = await _course_with_two_modules(db_session, author)
    _, quiz, question = modules[0]
    learner, headers = await _learner(client, db_session)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()

    questions = await client.get(f"/api/v1/quizzes/{quiz.id}/questions", headers=headers)
    answers = await client.get(f"/api/v1/questions/{question.id}/answers", headers=headers)

    assert questions.status_code == 200
    assert answers.status_code == 200
    for response in (questions, answers):
        assert "isCorrect" not in response.text
        assert "is_correct" not in response.text


async def test_the_learner_quiz_view_hides_the_question_bank(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, modules = await _course_with_two_modules(db_session, author)
    module, _, _ = modules[0]
    learner, headers = await _learner(client, db_session)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/courses/{course.id}/modules/{module.id}/quiz", headers=headers
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["attemptsUsed"] == 0
    assert data["attemptsRemaining"] == 3
    assert "questions" not in data
    assert "isCorrect" not in response.text


async def test_only_the_first_module_is_unlocked_to_begin_with(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _course_with_two_modules(db_session, author)
    learner, headers = await _learner(client, db_session)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()

    response = await client.get(f"/api/v1/courses/{course.id}/modules", headers=headers)

    assert response.status_code == 200
    modules = response.json()["data"]
    assert [m["unlocked"] for m in modules] == [True, False]
    assert [m["status"] for m in modules] == ["NOT_STARTED", "NOT_STARTED"]


async def test_a_locked_module_hides_its_content(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, modules = await _course_with_two_modules(db_session, author)
    second_module = modules[1][0]
    learner, headers = await _learner(client, db_session)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/courses/{course.id}/modules/{second_module.id}/contents", headers=headers
    )

    assert response.status_code == 404
    assert "locked" in response.json()["error"]["message"]


async def test_completing_a_module_unlocks_the_next(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, modules = await _course_with_two_modules(db_session, author)
    learner, headers = await _learner(client, db_session)
    enrollment = await f.make_enrollment(db_session, course, learner)
    db_session.add(
        ModuleProgress(
            enrollment_id=enrollment.id,
            module_id=modules[0][0].id,
            content_completed=True,
            quiz_passed=True,
            status=ProgressStatus.COMPLETED,
        )
    )
    await db_session.commit()

    response = await client.get(f"/api/v1/courses/{course.id}/modules", headers=headers)

    assert [m["unlocked"] for m in response.json()["data"]] == [True, True]

    second_module = modules[1][0]
    contents = await client.get(
        f"/api/v1/courses/{course.id}/modules/{second_module.id}/contents", headers=headers
    )
    assert contents.status_code == 200


async def test_the_learner_content_view_carries_completion_state(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, modules = await _course_with_two_modules(db_session, author)
    module = modules[0][0]
    learner, headers = await _learner(client, db_session)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/courses/{course.id}/modules/{module.id}/contents", headers=headers
    )

    assert response.status_code == 200
    content = response.json()["data"][0]
    assert content["completed"] is False
    # The authoring-only fields are absent from the learner shape.
    assert "moduleId" not in content
