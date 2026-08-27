import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "@/api/client";
import ErrorNote from "@/components/ErrorNote";

const STATUS_STYLES = {
  ASSIGNED: "bg-sky-100 text-sky-800",
  STARTED: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-slate-200 text-slate-600",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function CourseAssignmentsPage() {
  const { courseId } = useParams();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}`)).data.data,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}/assignments`)).data.data,
  });

  const candidatesQuery = useQuery({
    queryKey: ["assignable", courseId],
    queryFn: async () =>
      (await api.get(`/courses/${courseId}/assignments/assignable-users`)).data.data,
  });

  const course = courseQuery.data;
  const assignments = assignmentsQuery.data ?? [];
  // Memoised so the lookup below is not rebuilt on every render.
  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);

  const nameById = useMemo(() => {
    const map = new Map();
    for (const person of candidates) {
      map.set(person.id, { name: `${person.firstName} ${person.lastName}`, email: person.email });
    }
    return map;
  }, [candidates]);

  const available = candidates.filter((person) => !person.alreadyAssigned);
  const isPublished = course?.status === "PUBLISHED";

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["assignments", courseId] });
    queryClient.invalidateQueries({ queryKey: ["assignable", courseId] });
  }

  const assign = useMutation({
    mutationFn: (payload) => api.post(`/courses/${courseId}/assignments`, payload),
    onSuccess: () => {
      setUserId("");
      setDueDate("");
      setError("");
      refresh();
    },
    onError: (requestError) => setError(getApiErrorMessage(requestError)),
  });

  const cancel = useMutation({
    mutationFn: (assignmentId) => api.delete(`/assignments/${assignmentId}`),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (requestError) => setError(getApiErrorMessage(requestError)),
  });

  function handleAssign(event) {
    event.preventDefault();
    if (!userId) return;
    assign.mutate({
      userId,
      // The API expects an instant; a date input gives a calendar day.
      dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/courses" className="text-sm text-slate-500 hover:underline">
          ← Back to courses
        </Link>
        <h2 className="mt-1 text-xl font-medium">
          Assignments{course ? ` · ${course.title}` : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Assigning a course also enrolls the learner, in the same transaction.
        </p>
      </div>

      <ErrorNote message={error} />
      {courseQuery.isError && <ErrorNote message={getApiErrorMessage(courseQuery.error)} />}

      {course && !isPublished && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This course is {course.status}. Only a published course can be assigned —{" "}
          <Link to={`/courses/${courseId}/manage`} className="underline">
            publish it first
          </Link>
          .
        </p>
      )}

      {isPublished && (
        <form
          onSubmit={handleAssign}
          className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4"
        >
          <label className="min-w-0 flex-1 text-sm">
            <span className="font-medium">Learner</span>
            <select
              required
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Select a learner…</option>
              {available.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName} ({person.email})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="font-medium">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={assign.isPending || available.length === 0}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {assign.isPending ? "Assigning..." : "Assign course"}
          </button>

          {available.length === 0 && candidatesQuery.isSuccess && (
            <p className="w-full text-xs text-slate-500">
              Every active learner already has this course.
            </p>
          )}
        </form>
      )}

      {assignmentsQuery.isPending && <p className="text-slate-500">Loading assignments...</p>}
      {assignmentsQuery.isError && (
        <ErrorNote message={getApiErrorMessage(assignmentsQuery.error)} />
      )}

      {assignmentsQuery.isSuccess && assignments.length === 0 && (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Nobody is assigned to this course yet.
        </p>
      )}

      {assignments.length > 0 && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Learner</th>
                <th className="px-4 py-2 font-medium">Assigned</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const person = nameById.get(assignment.userId);
                return (
                  <tr key={assignment.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      {person?.name ?? "Unknown"}
                      <span className="block font-mono text-xs text-slate-500">
                        {person?.email ?? assignment.userId}
                      </span>
                    </td>
                    <td className="px-4 py-2">{formatDate(assignment.assignedAt)}</td>
                    <td className="px-4 py-2">{formatDate(assignment.dueDate)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[assignment.status]
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {assignment.status !== "CANCELLED" &&
                        assignment.status !== "COMPLETED" && (
                          <button
                            type="button"
                            onClick={() => cancel.mutate(assignment.id)}
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Cancelling keeps the record and any progress the learner has already made.
      </p>
    </div>
  );
}
