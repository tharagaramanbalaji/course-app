"""Course management endpoints (section 4)."""

from app.models.enums import CourseStatus, UserRole
from tests import factories as f

COURSES = "/api/v1/courses"

NEW_COURSE = {
    "title": "Backend Development",
    "description": "Learn backend development",
    "category": "Backend",
    "allowSelfEnrollment": True,
}


async def _author(client, db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR):
    user = await f.make_user(db_session, email=email, role=role)
    return user, await f.auth_headers(client, email)


async def test_creating_a_course_requires_authentication(client):
    assert (await client.post(COURSES, json=NEW_COURSE)).status_code == 401


async def test_a_learner_cannot_create_a_course(client, db_session):
    await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    headers = await f.auth_headers(client, "lena@example.com")

    response = await client.post(COURSES, headers=headers, json=NEW_COURSE)

    assert response.status_code == 403


async def test_a_new_course_is_a_draft_owned_by_its_creator(client, db_session):
    author, headers = await _author(client, db_session)

    response = await client.post(COURSES, headers=headers, json=NEW_COURSE)

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["status"] == "DRAFT"
    assert data["createdBy"] == str(author.id)
    assert data["publishedAt"] is None
    assert data["allowSelfEnrollment"] is True


async def test_the_client_cannot_choose_the_status_or_owner(client, db_session):
    author, headers = await _author(client, db_session)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.ADMIN)

    response = await client.post(
        COURSES,
        headers=headers,
        json={**NEW_COURSE, "status": "PUBLISHED", "createdBy": str(other.id)},
    )

    data = response.json()["data"]
    assert data["status"] == "DRAFT"
    assert data["createdBy"] == str(author.id)


async def test_authors_see_only_their_own_courses(client, db_session):
    author, headers = await _author(client, db_session)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    await f.make_course(db_session, author, title="Mine")
    await f.make_course(db_session, other, title="Theirs")

    response = await client.get(COURSES, headers=headers)

    assert [c["title"] for c in response.json()["data"]] == ["Mine"]


async def test_learners_see_only_published_courses(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    await f.make_course(db_session, author, title="Draft", status=CourseStatus.DRAFT)
    await f.make_course(db_session, author, title="Live", status=CourseStatus.PUBLISHED)
    await f.make_course(db_session, author, title="Old", status=CourseStatus.ARCHIVED)
    await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    headers = await f.auth_headers(client, "lena@example.com")

    response = await client.get(COURSES, headers=headers)

    assert [c["title"] for c in response.json()["data"]] == ["Live"]


async def test_another_authors_course_is_not_reachable(client, db_session):
    _, headers = await _author(client, db_session)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, other, title="Theirs")

    response = await client.get(f"{COURSES}/{course.id}", headers=headers)

    # Not 403: probing ids must not confirm that the course exists.
    assert response.status_code == 404


async def test_a_learner_cannot_open_a_draft(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author, status=CourseStatus.DRAFT)
    await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    headers = await f.auth_headers(client, "lena@example.com")

    response = await client.get(f"{COURSES}/{course.id}", headers=headers)

    assert response.status_code == 404


async def test_an_owner_can_edit_a_draft(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)

    response = await client.patch(
        f"{COURSES}/{course.id}", headers=headers, json={"title": "Renamed"}
    )

    assert response.status_code == 200
    assert response.json()["data"]["title"] == "Renamed"


async def test_a_published_course_cannot_be_edited(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)

    response = await client.patch(
        f"{COURSES}/{course.id}", headers=headers, json={"title": "Renamed"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BUSINESS_RULE_VIOLATION"


async def test_a_published_course_cannot_be_deleted(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)

    response = await client.delete(f"{COURSES}/{course.id}", headers=headers)

    assert response.status_code == 422


async def test_a_draft_can_be_deleted(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)

    response = await client.delete(f"{COURSES}/{course.id}", headers=headers)

    assert response.status_code == 204
    assert (await client.get(f"{COURSES}/{course.id}", headers=headers)).status_code == 404


async def test_an_empty_course_cannot_be_published(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)

    response = await client.post(f"{COURSES}/{course.id}/publish", headers=headers)

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "BUSINESS_RULE_VIOLATION"
    assert "The course has no modules." in error["details"]["problems"]


async def test_publication_reports_every_problem_at_once(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    # A module with no content and no quiz.
    await f.make_module(db_session, course, display_order=1, title="Empty")

    response = await client.post(f"{COURSES}/{course.id}/publish", headers=headers)

    problems = response.json()["error"]["details"]["problems"]
    assert "Module 1 (Empty) has no content." in problems
    assert "Module 1 (Empty) has no quiz." in problems


async def test_a_question_without_a_correct_answer_blocks_publication(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course, title="One")
    await f.make_content(db_session, module)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    answers = await f.make_answers(db_session, question)
    for answer in answers:
        answer.is_correct = False
    await db_session.flush()

    response = await client.post(f"{COURSES}/{course.id}/publish", headers=headers)

    problems = response.json()["error"]["details"]["problems"]
    assert "Module 1 (One), question 1 has no correct answer." in problems


async def test_a_complete_course_publishes(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course, title="One")
    await f.make_content(db_session, module)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    await f.make_answers(db_session, question)

    response = await client.post(f"{COURSES}/{course.id}/publish", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "PUBLISHED"
    assert data["publishedAt"] is not None

    # Publishing is a one-way door in V1.
    again = await client.post(f"{COURSES}/{course.id}/publish", headers=headers)
    assert again.status_code == 422


async def test_only_the_owner_can_publish(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author)
    await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "other@example.com")

    response = await client.post(f"{COURSES}/{course.id}/publish", headers=headers)

    assert response.status_code == 404


# --- unpublish and archive: the sanctioned way around "no post-publication
# editing", not an exception to it -----------------------------------------


async def test_unpublishing_returns_a_course_to_draft_and_allows_editing(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)

    response = await client.post(f"{COURSES}/{course.id}/unpublish", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "DRAFT"
    assert data["publishedAt"] is None

    # The existing DRAFT-only edit rule now applies normally - no separate
    # "editing while published" path was introduced.
    edit = await client.patch(
        f"{COURSES}/{course.id}", headers=headers, json={"title": "Fixed title"}
    )
    assert edit.status_code == 200
    assert edit.json()["data"]["title"] == "Fixed title"


async def test_only_a_published_course_can_be_unpublished(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.DRAFT)

    response = await client.post(f"{COURSES}/{course.id}/unpublish", headers=headers)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BUSINESS_RULE_VIOLATION"


async def test_only_the_owner_can_unpublish(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "other@example.com")

    response = await client.post(f"{COURSES}/{course.id}/unpublish", headers=headers)

    assert response.status_code == 404


async def test_archiving_retires_a_published_course_without_deleting_it(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)

    response = await client.post(f"{COURSES}/{course.id}/archive", headers=headers)

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ARCHIVED"

    # Still there, and still not editable - archiving is not a way to
    # sidestep "no post-publication editing" either.
    edit = await client.patch(
        f"{COURSES}/{course.id}", headers=headers, json={"title": "Renamed"}
    )
    assert edit.status_code == 422


async def test_an_already_archived_course_cannot_be_archived_again(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.ARCHIVED)

    response = await client.post(f"{COURSES}/{course.id}/archive", headers=headers)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BUSINESS_RULE_VIOLATION"


async def test_only_the_owner_can_archive(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "other@example.com")

    response = await client.post(f"{COURSES}/{course.id}/archive", headers=headers)

    assert response.status_code == 404


# --- ADMIN manages every course, not just its own ---------------------


async def test_an_admin_sees_every_course_not_just_its_own(client, db_session):
    instructor = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    await f.make_course(db_session, instructor, title="Instructor's course")
    await f.make_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    headers = await f.auth_headers(client, "admin@example.com")

    response = await client.get(COURSES, headers=headers)

    titles = [row["title"] for row in response.json()["data"]]
    assert "Instructor's course" in titles


async def test_an_admin_can_edit_and_delete_an_instructors_draft_course(client, db_session):
    instructor = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, instructor, status=CourseStatus.DRAFT)
    await f.make_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    headers = await f.auth_headers(client, "admin@example.com")

    edit = await client.patch(
        f"{COURSES}/{course.id}", headers=headers, json={"title": "Edited by admin"}
    )
    assert edit.status_code == 200
    assert edit.json()["data"]["title"] == "Edited by admin"

    delete = await client.delete(f"{COURSES}/{course.id}", headers=headers)
    assert delete.status_code == 204


async def test_an_admin_can_publish_unpublish_and_archive_an_instructors_course(
    client, db_session
):
    instructor = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, instructor)
    module = await f.make_module(db_session, course, title="One")
    await f.make_content(db_session, module)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    await f.make_answers(db_session, question)
    await f.make_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    headers = await f.auth_headers(client, "admin@example.com")

    published = await client.post(f"{COURSES}/{course.id}/publish", headers=headers)
    assert published.status_code == 200
    assert published.json()["data"]["status"] == "PUBLISHED"

    unpublished = await client.post(f"{COURSES}/{course.id}/unpublish", headers=headers)
    assert unpublished.status_code == 200
    assert unpublished.json()["data"]["status"] == "DRAFT"

    archived = await client.post(f"{COURSES}/{course.id}/archive", headers=headers)
    assert archived.status_code == 200
    assert archived.json()["data"]["status"] == "ARCHIVED"


async def test_an_instructor_still_cannot_reach_another_instructors_course(client, db_session):
    """The ADMIN carve-out does not leak into INSTRUCTOR: ownership scoping
    for a non-admin author is unchanged."""
    owner = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, owner, status=CourseStatus.DRAFT)
    await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    headers = await f.auth_headers(client, "other@example.com")

    response = await client.patch(
        f"{COURSES}/{course.id}", headers=headers, json={"title": "Hijacked"}
    )

    assert response.status_code == 404
