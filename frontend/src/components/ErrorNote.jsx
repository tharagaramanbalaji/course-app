/** Renders a backend error, including the problem list a failed publish returns. */
export default function ErrorNote({ message, problems = [] }) {
  if (!message) return null;

  return (
    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <p>{message}</p>
      {problems.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-0.5">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
