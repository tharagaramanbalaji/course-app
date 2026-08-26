"""Content completion, quiz attempts, completion and certificates.

These cover the rules the whole product rests on: scoring is points-based
and server-side, completion is derived, retries are bounded, and exactly one
certificate is ever issued per enrollment.
"""

from datetime import datetime
from decimal import Decimal

from app.models.enums import CourseStatus, UserRole
from tests import factories as f


async def _build_course(db_session, author, *, module_count=1, passing="70.00", max_attempts=3):
    """A published course whose modules each have one content item and a quiz
    with two questions worth 10 points each."""
    course = await f.make_course(db_session, author, status=CourseStatus.PUBLISHED)
    modules = []

    for order in range(1, module_count + 1):
        module = await f.make_module(db_session, course, display_order=order, title=f"M{order}")
        content = await f.make_content(db_session, module)
        quiz = await f.make_quiz(
            db_session, module, passing_score=passing, max_attempts=max_attempts
        )
        questions = []
        for q_order in (1, 2):
            question = await f.make_question(db_session, quiz, display_order=q_order)
            answers = await f.make_answers(db_session, question)
            questions.append((question, answers))
        modules.append({"module": module, "content": content, "quiz": quiz, "questions": questions})

    await db_session.commit()
    return course, modules


async def _enrolled_learner(client, db_session, course, email="lena@example.com"):
    learner = await f.make_user(db_session, email=email, role=UserRole.USER)
    await f.make_enrollment(db_session, course, learner)
    await db_session.commit()
    return learner, await f.auth_headers(client, email)


def _my(course_id, module_id):
    return f"/api/v1/my/courses/{course_id}/modules/{module_id}"


def _instant(value: str) -> datetime:
    """Compare timestamps as instants.

    SQLite does not persist a timezone, so a value written in this request
    comes back tz-aware while one re-read from the database does not. Both
    are the same moment, and PostgreSQL keeps the offset either way.
    """
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def _selections(questions, *, correct=True):
    """Pick the correct or the wrong answer for every question."""
    return [
        {
            "questionId": str(question.id),
            "answerId": str(next(a for a in answers if a.is_correct is correct).id),
        }
        for question, answers in questions
    ]


# --- content completion ----------------------------------------------


async def test_completing_content_is_idempotent(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, content = mods[0]["module"], mods[0]["content"]
    _, headers = await _enrolled_learner(client, db_session, course)
    url = f"{_my(course.id, module.id)}/contents/{content.id}/complete"

    first = await client.post(url, headers=headers)
    second = await client.post(url, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["data"]["completed"] is True
    # The same row is updated, so completion time does not move.
    assert _instant(first.json()["data"]["completedAt"]) == _instant(
        second.json()["data"]["completedAt"]
    )


async def test_content_alone_does_not_complete_a_module(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, content = mods[0]["module"], mods[0]["content"]
    _, headers = await _enrolled_learner(client, db_session, course)

    response = await client.post(
        f"{_my(course.id, module.id)}/contents/{content.id}/complete", headers=headers
    )

    data = response.json()["data"]
    assert data["module"]["contentCompleted"] is True
    assert data["module"]["quizPassed"] is False
    assert data["module"]["status"] == "IN_PROGRESS"
    assert data["moduleCompleted"] is False
    assert data["courseCompleted"] is False


async def test_content_in_a_locked_module_cannot_be_completed(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author, module_count=2)
    second = mods[1]
    _, headers = await _enrolled_learner(client, db_session, course)

    response = await client.post(
        f"{_my(course.id, second['module'].id)}/contents/{second['content'].id}/complete",
        headers=headers,
    )

    assert response.status_code == 422
    assert "locked" in response.json()["error"]["message"]


# --- quiz attempts ----------------------------------------------------


async def test_starting_an_attempt_hides_correctness(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module = mods[0]["module"]
    _, headers = await _enrolled_learner(client, db_session, course)

    response = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["attemptNumber"] == 1
    assert data["attemptsRemaining"] == 2
    assert len(data["questions"]) == 2
    assert "isCorrect" not in response.text


async def test_an_unsubmitted_attempt_is_resumed_not_duplicated(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module = mods[0]["module"]
    _, headers = await _enrolled_learner(client, db_session, course)
    url = f"{_my(course.id, module.id)}/quiz/attempts"

    first = await client.post(url, headers=headers)
    second = await client.post(url, headers=headers)

    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert second.json()["data"]["attemptNumber"] == 1


async def test_a_wrong_submission_scores_zero_and_fails(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
    attempt_id = start.json()["data"]["id"]

    response = await client.post(
        f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit",
        headers=headers,
        json={"answers": _selections(questions, correct=False)},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert Decimal(str(data["score"])) == Decimal("0.00")
    assert data["passed"] is False
    assert data["correctAnswers"] == 0
    assert data["totalQuestions"] == 2
    assert data["moduleCompleted"] is False
    assert data["attemptsRemaining"] == 2


async def test_a_half_correct_submission_scores_fifty(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
    attempt_id = start.json()["data"]["id"]

    right, wrong = questions[0], questions[1]
    body = {"answers": _selections([right]) + _selections([wrong], correct=False)}
    response = await client.post(
        f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit",
        headers=headers,
        json=body,
    )

    data = response.json()["data"]
    # 10 of 20 points: scoring is points-based, not question-count-based.
    assert Decimal(str(data["score"])) == Decimal("50.00")
    assert Decimal(str(data["pointsEarned"])) == Decimal("10.00")
    assert Decimal(str(data["totalPoints"])) == Decimal("20.00")
    assert data["passed"] is False


async def test_an_attempt_cannot_be_submitted_twice(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
    attempt_id = start.json()["data"]["id"]
    url = f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit"
    body = {"answers": _selections(questions, correct=False)}

    assert (await client.post(url, headers=headers, json=body)).status_code == 200
    repeat = await client.post(url, headers=headers, json=body)

    assert repeat.status_code == 409


async def test_every_question_must_be_answered(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
    attempt_id = start.json()["data"]["id"]

    response = await client.post(
        f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit",
        headers=headers,
        json={"answers": _selections([questions[0]])},
    )

    assert response.status_code == 422
    assert "unanswered" in response.json()["error"]["details"]


async def test_an_answer_from_another_question_is_rejected(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
    attempt_id = start.json()["data"]["id"]

    foreign_answer = questions[1][1][0]
    response = await client.post(
        f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit",
        headers=headers,
        json={
            "answers": [
                {"questionId": str(questions[0][0].id), "answerId": str(foreign_answer.id)},
                *_selections([questions[1]]),
            ]
        },
    )

    assert response.status_code == 422
    assert "answerId" in response.json()["error"]["details"]


async def test_retries_are_capped_by_max_attempts(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author, max_attempts=2)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    wrong = {"answers": _selections(questions, correct=False)}

    for _ in range(2):
        start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
        assert start.status_code == 201
        attempt_id = start.json()["data"]["id"]
        await client.post(
            f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit",
            headers=headers,
            json=wrong,
        )

    third = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)

    assert third.status_code == 422
    assert "No attempts remaining" in third.json()["error"]["message"]


async def test_a_passed_quiz_cannot_be_retaken(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
    attempt_id = start.json()["data"]["id"]
    await client.post(
        f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit",
        headers=headers,
        json={"answers": _selections(questions)},
    )

    again = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)

    assert again.status_code == 409


async def test_an_attempt_from_another_learner_is_not_reachable(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    module, questions = mods[0]["module"], mods[0]["questions"]
    _, headers = await _enrolled_learner(client, db_session, course)
    start = await client.post(f"{_my(course.id, module.id)}/quiz/attempts", headers=headers)
    attempt_id = start.json()["data"]["id"]

    _, other_headers = await _enrolled_learner(
        client, db_session, course, email="nosy@example.com"
    )
    response = await client.post(
        f"{_my(course.id, module.id)}/quiz/attempts/{attempt_id}/submit",
        headers=other_headers,
        json={"answers": _selections(questions)},
    )

    assert response.status_code == 404


# --- completion and certificates --------------------------------------


async def test_passing_the_quiz_and_content_completes_the_module(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author, module_count=2)
    first = mods[0]
    _, headers = await _enrolled_learner(client, db_session, course)

    await client.post(
        f"{_my(course.id, first['module'].id)}/contents/{first['content'].id}/complete",
        headers=headers,
    )
    start = await client.post(
        f"{_my(course.id, first['module'].id)}/quiz/attempts", headers=headers
    )
    result = await client.post(
        f"{_my(course.id, first['module'].id)}/quiz/attempts/{start.json()['data']['id']}/submit",
        headers=headers,
        json={"answers": _selections(first["questions"])},
    )

    data = result.json()["data"]
    assert Decimal(str(data["score"])) == Decimal("100.00")
    assert data["passed"] is True
    assert data["moduleCompleted"] is True
    assert data["courseCompleted"] is False  # module two is still outstanding
    assert data["certificate"] is None

    modules = await client.get(f"/api/v1/courses/{course.id}/modules", headers=headers)
    assert [m["unlocked"] for m in modules.json()["data"]] == [True, True]


async def test_finishing_every_module_issues_one_certificate(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author, module_count=2)
    _, headers = await _enrolled_learner(client, db_session, course)

    last = None
    for entry in mods:
        await client.post(
            f"{_my(course.id, entry['module'].id)}/contents/{entry['content'].id}/complete",
            headers=headers,
        )
        start = await client.post(
            f"{_my(course.id, entry['module'].id)}/quiz/attempts", headers=headers
        )
        last = await client.post(
            f"{_my(course.id, entry['module'].id)}/quiz/attempts/"
            f"{start.json()['data']['id']}/submit",
            headers=headers,
            json={"answers": _selections(entry["questions"])},
        )

    data = last.json()["data"]
    assert data["courseCompleted"] is True
    assert data["certificate"] is not None
    assert Decimal(str(data["certificate"]["finalScore"])) == Decimal("100.00")

    listed = await client.get("/api/v1/my/certificates", headers=headers)
    assert len(listed.json()["data"]) == 1

    course_view = await client.get(f"/api/v1/my/courses/{course.id}", headers=headers)
    assert course_view.json()["data"]["enrollment"]["status"] == "COMPLETED"
    assert course_view.json()["data"]["progress"]["percentComplete"] == 100


async def test_the_final_score_uses_the_passing_attempt_only(client, db_session):
    """A failed retry must not drag the certificate score down."""
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author, passing="50.00")
    entry = mods[0]
    _, headers = await _enrolled_learner(client, db_session, course)
    base = _my(course.id, entry["module"].id)

    await client.post(
        f"{base}/contents/{entry['content'].id}/complete", headers=headers
    )

    # Attempt 1 scores 0 and fails.
    start = await client.post(f"{base}/quiz/attempts", headers=headers)
    await client.post(
        f"{base}/quiz/attempts/{start.json()['data']['id']}/submit",
        headers=headers,
        json={"answers": _selections(entry["questions"], correct=False)},
    )

    # Attempt 2 scores 100 and passes.
    start = await client.post(f"{base}/quiz/attempts", headers=headers)
    result = await client.post(
        f"{base}/quiz/attempts/{start.json()['data']['id']}/submit",
        headers=headers,
        json={"answers": _selections(entry["questions"])},
    )

    data = result.json()["data"]
    assert data["attemptNumber"] == 2
    assert data["courseCompleted"] is True
    # 100, not the 50 average of both attempts.
    assert Decimal(str(data["certificate"]["finalScore"])) == Decimal("100.00")


async def test_a_certificate_is_verifiable_without_authentication(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    entry = mods[0]
    _, headers = await _enrolled_learner(client, db_session, course)
    base = _my(course.id, entry["module"].id)

    await client.post(f"{base}/contents/{entry['content'].id}/complete", headers=headers)
    start = await client.post(f"{base}/quiz/attempts", headers=headers)
    result = await client.post(
        f"{base}/quiz/attempts/{start.json()['data']['id']}/submit",
        headers=headers,
        json={"answers": _selections(entry["questions"])},
    )
    number = result.json()["data"]["certificate"]["certificateNumber"]

    # No Authorization header at all.
    response = await client.get(f"/api/v1/certificates/verify/{number}")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["valid"] is True
    assert data["certificateNumber"] == number
    # Nothing internal is exposed through a shareable number.
    for leaked in ("userId", "enrollmentId", "courseId", "email"):
        assert leaked not in response.text


async def test_an_unknown_certificate_number_is_not_found(client):
    response = await client.get("/api/v1/certificates/verify/CERT-2026-NOPE")

    assert response.status_code == 404


async def test_another_learners_certificate_is_not_readable(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    entry = mods[0]
    _, headers = await _enrolled_learner(client, db_session, course)
    base = _my(course.id, entry["module"].id)

    await client.post(f"{base}/contents/{entry['content'].id}/complete", headers=headers)
    start = await client.post(f"{base}/quiz/attempts", headers=headers)
    result = await client.post(
        f"{base}/quiz/attempts/{start.json()['data']['id']}/submit",
        headers=headers,
        json={"answers": _selections(entry["questions"])},
    )
    certificate_id = result.json()["data"]["certificate"]["id"]

    _, other_headers = await _enrolled_learner(
        client, db_session, course, email="nosy@example.com"
    )
    response = await client.get(
        f"/api/v1/my/certificates/{certificate_id}", headers=other_headers
    )

    assert response.status_code == 404


async def test_a_certificate_can_be_downloaded(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, mods = await _build_course(db_session, author)
    entry = mods[0]
    _, headers = await _enrolled_learner(client, db_session, course)
    base = _my(course.id, entry["module"].id)

    await client.post(f"{base}/contents/{entry['content'].id}/complete", headers=headers)
    start = await client.post(f"{base}/quiz/attempts", headers=headers)
    result = await client.post(
        f"{base}/quiz/attempts/{start.json()['data']['id']}/submit",
        headers=headers,
        json={"answers": _selections(entry["questions"])},
    )
    certificate = result.json()["data"]["certificate"]

    response = await client.get(
        f"/api/v1/my/certificates/{certificate['id']}/download", headers=headers
    )

    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    assert certificate["certificateNumber"] in response.text
    assert "CERTIFICATE OF COMPLETION" in response.text


async def test_no_certificate_before_the_course_is_finished(client, db_session):
    author = await f.make_user(db_session, email="ivan@example.com", role=UserRole.INSTRUCTOR)
    course, _ = await _build_course(db_session, author)
    _, headers = await _enrolled_learner(client, db_session, course)

    response = await client.get(f"/api/v1/my/courses/{course.id}/certificate", headers=headers)

    assert response.status_code == 422
    assert "not complete" in response.json()["error"]["message"]
