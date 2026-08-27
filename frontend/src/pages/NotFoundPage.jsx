import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <img src="/logo.png" alt="LearnFlow" className="h-14 w-auto object-contain opacity-80" />
      <p className="mt-6 text-6xl font-extrabold tracking-tight text-slate-200">404</p>
      <h1 className="mt-2 text-xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Back to Dashboard
      </Link>
    </div>
  );
}
