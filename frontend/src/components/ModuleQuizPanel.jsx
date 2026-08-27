import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, getApiErrorMessage } from "@/api/client";
import ErrorNote from "@/components/ErrorNote";

const EMPTY_QUIZ = {
  title: "Module Quiz",
  passingScore: 70,
  maxAttempts: 3,
  randomizeQuestions: false,
};

const EMPTY_QUESTION = { questionText: "", points: 10 };

/**
 * Authoring for one module's quiz: settings, questions and answers.
 *
 * The publish rules are mirrored as inline warnings rather than left for the
 * publish attempt to reveal, so an author can see what is still missing
 * while they are building rather than after they press the button.
 */
export default function ModuleQuizPanel({ courseId, module, editable }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [quizForm, setQuizForm] = useState(EMPTY_QUIZ);
  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION);
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [expanded, setExpanded] = useState(true);

  const quizKey = ["quiz", module.id];
  const quizUrl = `/courses/${courseId}/modules/${module.id}/quiz`;

  const quizQuery = useQuery({
    queryKey: quizKey,
    queryFn: async () => {
      try {
        return (await api.get(quizUrl)).data.data;
      } catch (requestError) {
        // No quiz yet is a normal state, not a failure to surface.
        if (requestError?.response?.status === 404) return null;
        throw requestError;
      }
    },
    retry: false,
  });

  const quiz = quizQuery.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: quizKey });
  const report = (requestError) => setError(getApiErrorMessage(requestError));

  function mutation(fn) {
    return {
      mutationFn: fn,
      onSuccess: () => {
        setError("");
        refresh();
      },
      onError: report,
    };
  }

  const createQuiz = useMutation(mutation((payload) => api.post(quizUrl, payload)));
  const updateQuiz = useMutation(mutation((payload) => api.patch(quizUrl, payload)));
  const deleteQuiz = useMutation(mutation(() => api.delete(quizUrl)));

  const createQuestion = useMutation(
    mutation((payload) => api.post(`/quizzes/${quiz.id}/questions`, payload)),
  );
  const deleteQuestion = useMutation(
    mutation((questionId) => api.delete(`/quizzes/${quiz.id}/questions/${questionId}`)),
  );
  const reorderQuestions = useMutation(
    mutation((questionIds) =>
      api.patch(`/quizzes/${quiz.id}/questions/reorder`, { questionIds }),
    ),
  );

  const createAnswer = useMutation(
    mutation(({ questionId, payload }) =>
      api.post(`/questions/${questionId}/answers`, payload),
    ),
  );
  const updateAnswer = useMutation(
    mutation(({ questionId, answerId, payload }) =>
      api.patch(`/questions/${questionId}/answers/${answerId}`, payload),
    ),
  );
  const deleteAnswer = useMutation(
    mutation(({ questionId, answerId }) =>
      api.delete(`/questions/${questionId}/answers/${answerId}`),
    ),
  );

  function handleCreateQuiz(event) {
    event.preventDefault();
    createQuiz.mutate({
      title: quizForm.title,
      passingScore: Number(quizForm.passingScore),
      maxAttempts: quizForm.maxAttempts === "" ? null : Number(quizForm.maxAttempts),
      randomizeQuestions: quizForm.randomizeQuestions,
    });
  }

  function handleSaveSettings(event) {
    event.preventDefault();
    updateQuiz.mutate(
      {
        title: quizForm.title,
        passingScore: Number(quizForm.passingScore),
        maxAttempts: quizForm.maxAttempts === "" ? null : Number(quizForm.maxAttempts),
        randomizeQuestions: quizForm.randomizeQuestions,
      },
      { onSuccess: () => setShowSettings(false) },
    );
  }

  function handleAddQuestion(event) {
    event.preventDefault();
    createQuestion.mutate(
      { questionText: questionForm.questionText, points: Number(questionForm.points) },
      { onSuccess: () => setQuestionForm(EMPTY_QUESTION) },
    );
  }

  function handleAddAnswer(event, questionId) {
    event.preventDefault();
    const draft = answerDrafts[questionId] ?? { answerText: "", isCorrect: false };
    if (!draft.answerText.trim()) return;
    createAnswer.mutate(
      { questionId, payload: { answerText: draft.answerText, isCorrect: draft.isCorrect } },
      {
        onSuccess: () =>
          setAnswerDrafts((drafts) => ({
            ...drafts,
            [questionId]: { answerText: "", isCorrect: false },
          })),
      },
    );
  }

  /** V1 quizzes are single-selection, so marking one correct clears the rest. */
  function markCorrect(question, answerId) {
    const updates = question.answers
      .filter((answer) => (answer.id === answerId) !== answer.isCorrect)
      .map((answer) =>
        updateAnswer.mutateAsync({
          questionId: question.id,
          answerId: answer.id,
          payload: { isCorrect: answer.id === answerId },
        }),
      );
    Promise.all(updates).catch(report);
  }

  function moveQuestion(index, direction) {
    const ids = quiz.questions.map((question) => question.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderQuestions.mutate(ids);
  }

  if (quizQuery.isPending) {
    return <p className="text-xs text-slate-500">Loading quiz...</p>;
  }

  // --- no quiz yet ---------------------------------------------------

  if (!quiz) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-white p-3">
        <ErrorNote message={error} />
        {!editable ? (
          <p className="text-xs text-slate-500">
            This module has no quiz, and the course can no longer be edited.
          </p>
        ) : (
          <form onSubmit={handleCreateQuiz} className="space-y-2">
            <p className="text-xs font-medium text-slate-700">
              No quiz yet. A module needs one before the course can be published.
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                required
                value={quizForm.title}
                onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                placeholder="Quiz title"
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm sm:col-span-2"
              />
              <label className="text-xs text-slate-600">
                Pass %
                <input
                  required
                  type="number"
                  min={0}
                  max={100}
                  value={quizForm.passingScore}
                  onChange={(e) =>
                    setQuizForm({ ...quizForm, passingScore: e.target.value })
                  }
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                Max attempts
                <input
                  type="number"
                  min={1}
                  value={quizForm.maxAttempts}
                  onChange={(e) =>
                    setQuizForm({ ...quizForm, maxAttempts: e.target.value })
                  }
                  placeholder="unlimited"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={quizForm.randomizeQuestions}
                onChange={(e) =>
                  setQuizForm({ ...quizForm, randomizeQuestions: e.target.checked })
                }
              />
              Randomise question order for each learner
            </label>
            <button
              type="submit"
              disabled={createQuiz.isPending}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {createQuiz.isPending ? "Creating..." : "Create Quiz"}
            </button>
          </form>
        )}
      </div>
    );
  }

  // --- quiz exists ---------------------------------------------------

  const questions = quiz.questions ?? [];
  const totalPoints = questions.reduce((sum, q) => sum + Number(q.points), 0);
  const problems = questions.flatMap((question, index) => {
    const found = [];
    if ((question.answers ?? []).length < 2) {
      found.push(`Question ${index + 1} needs at least two answers.`);
    }
    if (!(question.answers ?? []).some((answer) => answer.isCorrect)) {
      found.push(`Question ${index + 1} has no correct answer marked.`);
    }
    return found;
  });
  if (questions.length === 0) problems.push("The quiz has no questions.");

  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          {expanded ? "▾" : "▸"} Quiz: {quiz.title}
        </button>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          pass {quiz.passingScore}%
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {quiz.maxAttempts ? `${quiz.maxAttempts} attempts` : "unlimited attempts"}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {questions.length} question{questions.length === 1 ? "" : "s"} · {totalPoints} pts
        </span>
        {quiz.randomizeQuestions && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            randomised
          </span>
        )}

        {editable && (
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setQuizForm({
                  title: quiz.title,
                  passingScore: quiz.passingScore,
                  maxAttempts: quiz.maxAttempts ?? "",
                  randomizeQuestions: quiz.randomizeQuestions,
                });
                setShowSettings((open) => !open);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => deleteQuiz.mutate()}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Delete quiz
            </button>
          </span>
        )}
      </div>

      <div className="mt-2">
        <ErrorNote message={error} />
      </div>

      {problems.length > 0 && editable && (
        <ul className="mt-2 list-inside list-disc rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {showSettings && editable && (
        <form
          onSubmit={handleSaveSettings}
          className="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3"
        >
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              required
              value={quizForm.title}
              onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
              className="rounded border border-slate-300 px-2.5 py-1.5 text-sm sm:col-span-2"
            />
            <label className="text-xs text-slate-600">
              Pass %
              <input
                required
                type="number"
                min={0}
                max={100}
                value={quizForm.passingScore}
                onChange={(e) => setQuizForm({ ...quizForm, passingScore: e.target.value })}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Max attempts
              <input
                type="number"
                min={1}
                value={quizForm.maxAttempts}
                onChange={(e) => setQuizForm({ ...quizForm, maxAttempts: e.target.value })}
                placeholder="unlimited"
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={quizForm.randomizeQuestions}
              onChange={(e) =>
                setQuizForm({ ...quizForm, randomizeQuestions: e.target.checked })
              }
            />
            Randomise question order
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Save settings
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          {questions.map((question, index) => {
            const answers = question.answers ?? [];
            const draft = answerDrafts[question.id] ?? { answerText: "", isCorrect: false };

            return (
              <div key={question.id} className="rounded border border-slate-200 p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                    Q{index + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-sm">{question.questionText}</p>
                  <span className="text-xs text-slate-500">{question.points} pts</span>

                  {editable && (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, -1)}
                        disabled={index === 0}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:opacity-40"
                        aria-label="Move question up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 1)}
                        disabled={index === questions.length - 1}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:opacity-40"
                        aria-label="Move question down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteQuestion.mutate(question.id)}
                        className="rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>

                <ul className="mt-2 space-y-1">
                  {answers.map((answer) => (
                    <li key={answer.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={answer.isCorrect}
                        disabled={!editable}
                        onChange={() => markCorrect(question, answer.id)}
                        aria-label={`Mark "${answer.answerText}" correct`}
                      />
                      <span
                        className={
                          answer.isCorrect ? "font-medium text-green-800" : "text-slate-700"
                        }
                      >
                        {answer.answerText}
                      </span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() =>
                            deleteAnswer.mutate({
                              questionId: question.id,
                              answerId: answer.id,
                            })
                          }
                          className="ml-auto text-xs text-red-600 hover:underline"
                        >
                          remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {editable && (
                  <form
                    onSubmit={(event) => handleAddAnswer(event, question.id)}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input
                      value={draft.answerText}
                      onChange={(e) =>
                        setAnswerDrafts((drafts) => ({
                          ...drafts,
                          [question.id]: { ...draft, answerText: e.target.value },
                        }))
                      }
                      placeholder="Add an answer option"
                      className="min-w-0 flex-1 rounded border border-slate-300 px-2.5 py-1 text-sm"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={draft.isCorrect}
                        onChange={(e) =>
                          setAnswerDrafts((drafts) => ({
                            ...drafts,
                            [question.id]: { ...draft, isCorrect: e.target.checked },
                          }))
                        }
                      />
                      correct
                    </label>
                    <button
                      type="submit"
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            );
          })}

          {editable && (
            <form
              onSubmit={handleAddQuestion}
              className="flex flex-wrap items-end gap-2 rounded border border-dashed border-slate-300 p-3"
            >
              <label className="min-w-0 flex-1 text-xs text-slate-600">
                New question
                <input
                  required
                  value={questionForm.questionText}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, questionText: e.target.value })
                  }
                  placeholder="Which protocol is used for..."
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
              <label className="w-24 text-xs text-slate-600">
                Points
                <input
                  required
                  type="number"
                  min={1}
                  step="0.5"
                  value={questionForm.points}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, points: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={createQuestion.isPending}
                className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {createQuestion.isPending ? "Adding..." : "Add Question"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
