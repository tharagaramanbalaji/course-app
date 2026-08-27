import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, getApiErrorMessage, getApiErrorProblems } from "@/api/client";
import ErrorNote from "@/components/ErrorNote";

/**
 * Quiz-taking for one module: shows the pass bar, lets a learner start an
 * attempt, answer every question, submit and see the score - then retry if
 * attempts remain. Correctness always comes back from the submit response;
 * nothing here computes or assumes it.
 */
export default function LearnerQuizPanel({ courseId, module, onProgress }) {
  const queryClient = useQueryClient();
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [selections, setSelections] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);

  const quizUrl = `/courses/${courseId}/modules/${module.id}/quiz`;
  const attemptsUrl = `/my/courses/${courseId}/modules/${module.id}/quiz/attempts`;

  const quizQuery = useQuery({
    queryKey: ["learner-quiz", courseId, module.id],
    queryFn: async () => (await api.get(quizUrl)).data.data,
    enabled: module.hasQuiz,
  });

  function reportError(mutationError) {
    setError(getApiErrorMessage(mutationError));
    setProblems(getApiErrorProblems(mutationError));
  }

  function refreshEverything() {
    queryClient.invalidateQueries({ queryKey: ["learner-quiz", courseId, module.id] });
    queryClient.invalidateQueries({ queryKey: ["learner-modules", courseId] });
    queryClient.invalidateQueries({ queryKey: ["my-course", courseId] });
    onProgress?.();
  }

  const startAttempt = useMutation({
    mutationFn: () => api.post(attemptsUrl),
    onSuccess: ({ data }) => {
      setActiveAttempt(data.data);
      setSelections({});
      setResult(null);
      setError("");
      setProblems([]);
    },
    onError: reportError,
  });

  const submitAttempt = useMutation({
    mutationFn: (answers) =>
      api.post(`${attemptsUrl}/${activeAttempt.id}/submit`, { answers }),
    onSuccess: ({ data }) => {
      setResult(data.data);
      setActiveAttempt(null);
      setError("");
      setProblems([]);
      refreshEverything();
    },
    onError: reportError,
  });

  function handleSubmit(event) {
    event.preventDefault();
    const answers = activeAttempt.questions.map((question) => ({
      questionId: question.id,
      answerId: selections[question.id],
    }));
    if (answers.some((answer) => !answer.answerId)) {
      setError("Answer every question before submitting.");
      setProblems([]);
      return;
    }
    submitAttempt.mutate(answers);
  }

  if (!module.hasQuiz) {
    return (
      <p className="card border-dashed text-xs text-slate-500">
        This module has no quiz. Complete the content above to finish it.
      </p>
    );
  }

  const quiz = quizQuery.data;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold text-slate-900">
          Module Quiz{quiz ? `: ${quiz.title}` : ""}
        </h4>
        {module.quizPassed && <span className="badge-brand">✓ Passed</span>}
      </div>

      <ErrorNote message={error} problems={problems} />

      {quizQuery.isPending && <p className="mt-2 text-xs text-slate-500">Loading quiz...</p>}

      {quiz && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="badge-slate">Passing score: {quiz.passingScore}%</span>
          <span className="badge-slate">
            {quiz.maxAttempts ? `${quiz.maxAttempts} attempts allowed` : "Unlimited attempts"}
          </span>
          <span className="badge-slate">
            {quiz.attemptsUsed} attempt{quiz.attemptsUsed === 1 ? "" : "s"} used
          </span>
          {quiz.attemptsRemaining !== null && (
            <span className="badge-slate">{quiz.attemptsRemaining} remaining</span>
          )}
        </div>
      )}

      {result && (
        <div
          className={`mt-3 rounded-xl border p-4 text-sm ${
            result.passed
              ? "border-[#7ABA78]/50 bg-[#F4FAF4] text-[#063F2A]"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <p className="font-bold">
            {result.passed ? "🎉 Passed!" : "Not a pass yet."} Score: {result.score}%
          </p>
          <p className="mt-1 text-xs opacity-90">
            {result.correctAnswers} of {result.totalQuestions} correct &middot;{" "}
            {result.pointsEarned} / {result.totalPoints} points
          </p>
          {result.moduleCompleted && (
            <p className="mt-1 text-xs opacity-90">This module is now complete.</p>
          )}
          {result.courseCompleted && (
            <p className="mt-1 text-xs font-semibold">
              The whole course is complete
              {result.certificate ? " - a certificate was generated." : "."}
            </p>
          )}
          {!result.passed && (
            <p className="mt-1 text-xs opacity-90">
              {result.attemptsRemaining === null
                ? "You can retry this quiz."
                : result.attemptsRemaining > 0
                  ? `${result.attemptsRemaining} attempt(s) remaining.`
                  : "No attempts remaining."}
            </p>
          )}
        </div>
      )}

      {!activeAttempt && !module.quizPassed && quiz && (
        <button
          type="button"
          onClick={() => startAttempt.mutate()}
          disabled={startAttempt.isPending || quiz.attemptsRemaining === 0}
          className="btn-primary mt-4"
        >
          {startAttempt.isPending
            ? "Starting..."
            : quiz.attemptsUsed > 0
              ? "Retry quiz"
              : "Start quiz"}
        </button>
      )}

      {activeAttempt && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {activeAttempt.questions.map((question, index) => (
            <fieldset key={question.id} className="rounded-xl border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">
                Q{index + 1}. {question.questionText}{" "}
                <span className="text-xs font-normal text-slate-500">
                  ({question.points} pts)
                </span>
              </legend>
              <div className="mt-2 space-y-1">
                {question.answers.map((answer) => (
                  <label
                    key={answer.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                      selections[question.id] === answer.id
                        ? "border-[#0A6847] bg-[#F4FAF4] text-[#063F2A]"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={answer.id}
                      checked={selections[question.id] === answer.id}
                      onChange={() =>
                        setSelections((current) => ({
                          ...current,
                          [question.id]: answer.id,
                        }))
                      }
                      className="text-[#0A6847] focus:ring-[#0A6847]/30"
                    />
                    {answer.answerText}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <button type="submit" disabled={submitAttempt.isPending} className="btn-primary">
            {submitAttempt.isPending ? "Submitting..." : "Submit answers"}
          </button>
        </form>
      )}
    </div>
  );
}
