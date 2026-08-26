"""Authoring endpoints: modules, contents, quizzes, questions, answers."""

import pytest

from app.models.enums import CourseStatus, UserRole
from tests import factories as f


async def _author(client, db_session, email="ivan@example.com"):
    user = await f.make_user(db_session, email=email, role=UserRole.INSTRUCTOR)
    return user, await f.auth_headers(client, email)


def _modules_url(course_id):
    return f"/api/v1/courses/{course_id}/modules"


# --- modules ---------------------------------------------------------


async def test_a_module_is_appended_when_no_position_is_given(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)

    first = await client.post(
        _modules_url(course.id), headers=headers, json={"title": "One"}
    )
    second = await client.post(
        _modules_url(course.id), headers=headers, json={"title": "Two"}
    )

    assert first.status_code == 201
    assert first.json()["data"]["displayOrder"] == 1
    assert second.json()["data"]["displayOrder"] == 2


async def test_a_taken_position_is_a_conflict(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    await f.make_module(db_session, course, display_order=1)

    response = await client.post(
        _modules_url(course.id), headers=headers, json={"title": "Clash", "displayOrder": 1}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


async def test_modules_cannot_be_added_to_a_published_course(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)

    response = await client.post(
        _modules_url(course.id), headers=headers, json={"title": "Late"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BUSINESS_RULE_VIOLATION"


async def test_another_authors_modules_are_not_reachable(client, db_session):
    _, headers = await _author(client, db_session)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, other)

    response = await client.get(_modules_url(course.id), headers=headers)

    assert response.status_code == 404


async def test_a_learner_cannot_create_a_module(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, author)
    await f.make_user(db_session, email="lena@example.com", role=UserRole.USER)
    headers = await f.auth_headers(client, "lena@example.com")

    response = await client.post(
        _modules_url(course.id), headers=headers, json={"title": "Mine now"}
    )

    assert response.status_code == 403


async def test_modules_can_be_reordered(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    first = await f.make_module(db_session, course, display_order=1, title="One")
    second = await f.make_module(db_session, course, display_order=2, title="Two")
    third = await f.make_module(db_session, course, display_order=3, title="Three")

    response = await client.patch(
        f"{_modules_url(course.id)}/reorder",
        headers=headers,
        json={"moduleIds": [str(third.id), str(first.id), str(second.id)]},
    )

    assert response.status_code == 200
    ordered = [(m["title"], m["displayOrder"]) for m in response.json()["data"]]
    assert ordered == [("Three", 1), ("One", 2), ("Two", 3)]


@pytest.mark.parametrize(
    "build,expected_detail",
    [
        (lambda ids: [ids[0], ids[0], ids[1]], None),
        (lambda ids: [ids[0]], "missing"),
    ],
    ids=["duplicate id", "incomplete list"],
)
async def test_a_reorder_must_be_a_permutation(client, db_session, build, expected_detail):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    first = await f.make_module(db_session, course, display_order=1)
    second = await f.make_module(db_session, course, display_order=2)
    ids = [str(first.id), str(second.id)]

    response = await client.patch(
        f"{_modules_url(course.id)}/reorder", headers=headers, json={"moduleIds": build(ids)}
    )

    assert response.status_code == 422
    if expected_detail:
        assert expected_detail in response.json()["error"]["details"]


async def test_a_module_from_another_course_cannot_be_slipped_into_a_reorder(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, title="Mine")
    other_course = await f.make_course(db_session, author, title="Other")
    mine = await f.make_module(db_session, course, display_order=1)
    theirs = await f.make_module(db_session, other_course, display_order=1)

    response = await client.patch(
        f"{_modules_url(course.id)}/reorder",
        headers=headers,
        json={"moduleIds": [str(mine.id), str(theirs.id)]},
    )

    assert response.status_code == 422
    assert "unknown" in response.json()["error"]["details"]


# --- contents --------------------------------------------------------


def _contents_url(course_id, module_id):
    return f"/api/v1/courses/{course_id}/modules/{module_id}/contents"


async def test_text_content_requires_a_body(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)

    response = await client.post(
        _contents_url(course.id, module.id),
        headers=headers,
        json={"title": "Empty", "contentType": "TEXT"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_video_content_requires_a_url(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)

    response = await client.post(
        _contents_url(course.id, module.id),
        headers=headers,
        json={"title": "No source", "contentType": "VIDEO"},
    )

    assert response.status_code == 422


async def test_content_of_both_types_can_be_created(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)

    text = await client.post(
        _contents_url(course.id, module.id),
        headers=headers,
        json={"title": "Reading", "contentType": "TEXT", "contentBody": "Some words."},
    )
    video = await client.post(
        _contents_url(course.id, module.id),
        headers=headers,
        json={
            "title": "Watching",
            "contentType": "VIDEO",
            "videoUrl": "https://example.com/v.mp4",
        },
    )

    assert text.status_code == 201
    assert text.json()["data"]["displayOrder"] == 1
    assert video.status_code == 201
    assert video.json()["data"]["displayOrder"] == 2


async def test_a_module_from_another_course_is_rejected(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, title="Mine")
    other_course = await f.make_course(db_session, author, title="Other")
    foreign_module = await f.make_module(db_session, other_course)

    response = await client.post(
        _contents_url(course.id, foreign_module.id),
        headers=headers,
        json={"title": "Wrong home", "contentType": "TEXT", "contentBody": "x"},
    )

    assert response.status_code == 404


async def test_contents_can_be_reordered(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)
    first = await f.make_content(db_session, module, display_order=1)
    second = await f.make_content(db_session, module, display_order=2)

    response = await client.patch(
        f"{_contents_url(course.id, module.id)}/reorder",
        headers=headers,
        json={"contentIds": [str(second.id), str(first.id)]},
    )

    assert response.status_code == 200
    assert [c["id"] for c in response.json()["data"]] == [str(second.id), str(first.id)]


# --- quizzes, questions, answers -------------------------------------


def _quiz_url(course_id, module_id):
    return f"/api/v1/courses/{course_id}/modules/{module_id}/quiz"


async def test_a_module_accepts_only_one_quiz(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)
    payload = {"title": "Module Quiz", "passingScore": 70, "maxAttempts": 3}

    first = await client.post(_quiz_url(course.id, module.id), headers=headers, json=payload)
    second = await client.post(_quiz_url(course.id, module.id), headers=headers, json=payload)

    assert first.status_code == 201
    assert second.status_code == 409


async def test_a_passing_score_above_one_hundred_is_rejected(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)

    response = await client.post(
        _quiz_url(course.id, module.id),
        headers=headers,
        json={"title": "Quiz", "passingScore": 101},
    )

    assert response.status_code == 422


async def test_questions_and_answers_can_be_authored(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)

    question = await client.post(
        f"/api/v1/quizzes/{quiz.id}/questions",
        headers=headers,
        json={"questionText": "Which protocol?", "points": 5},
    )
    assert question.status_code == 201
    question_id = question.json()["data"]["id"]

    answer = await client.post(
        f"/api/v1/questions/{question_id}/answers",
        headers=headers,
        json={"answerText": "POST", "isCorrect": True},
    )

    assert answer.status_code == 201
    assert answer.json()["data"]["isCorrect"] is True


async def test_zero_points_are_rejected(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)

    response = await client.post(
        f"/api/v1/quizzes/{quiz.id}/questions",
        headers=headers,
        json={"questionText": "Free marks?", "points": 0},
    )

    assert response.status_code == 422


async def test_ownership_is_enforced_through_the_quiz_chain(client, db_session):
    """A quiz id alone must not grant access: ownership is resolved by
    walking quiz -> module -> course."""
    _, headers = await _author(client, db_session)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, other)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)

    response = await client.post(
        f"/api/v1/quizzes/{quiz.id}/questions",
        headers=headers,
        json={"questionText": "Sneaking in", "points": 1},
    )

    assert response.status_code == 404


async def test_ownership_is_enforced_through_the_question_chain(client, db_session):
    _, headers = await _author(client, db_session)
    other = await f.make_user(db_session, email="other@example.com", role=UserRole.INSTRUCTOR)
    course = await f.make_course(db_session, other)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)

    response = await client.post(
        f"/api/v1/questions/{question.id}/answers",
        headers=headers,
        json={"answerText": "Sneaking in", "isCorrect": True},
    )

    assert response.status_code == 404


async def test_questions_cannot_be_added_to_a_published_course(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)

    response = await client.post(
        f"/api/v1/quizzes/{quiz.id}/questions",
        headers=headers,
        json={"questionText": "Late", "points": 1},
    )

    assert response.status_code == 422


async def test_questions_can_be_reordered(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    first = await f.make_question(db_session, quiz, display_order=1)
    second = await f.make_question(db_session, quiz, display_order=2)

    response = await client.patch(
        f"/api/v1/quizzes/{quiz.id}/questions/reorder",
        headers=headers,
        json={"questionIds": [str(second.id), str(first.id)]},
    )

    assert response.status_code == 200
    assert [q["displayOrder"] for q in response.json()["data"]] == [1, 2]
    assert [q["id"] for q in response.json()["data"]] == [str(second.id), str(first.id)]


async def test_the_author_sees_which_answer_is_correct(client, db_session):
    author, headers = await _author(client, db_session)
    course = await f.make_course(db_session, author)
    module = await f.make_module(db_session, course)
    quiz = await f.make_quiz(db_session, module)
    question = await f.make_question(db_session, quiz)
    await f.make_answers(db_session, question)

    response = await client.get(f"/api/v1/questions/{question.id}/answers", headers=headers)

    assert response.status_code == 200
    assert [a["isCorrect"] for a in response.json()["data"]] == [True, False]
