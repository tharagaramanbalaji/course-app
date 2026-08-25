import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-medium">Page not found</h2>
      <Link className="text-blue-600 underline" to="/">
        Back to start
      </Link>
    </section>
  );
}
