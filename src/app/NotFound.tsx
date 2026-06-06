import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-slate-400">
      <p className="text-6xl font-bold text-slate-700">404</p>
      <p className="text-sm">Page not found.</p>
      <Link to="/overview" className="text-sm text-emerald-500 hover:text-emerald-400 underline">
        Go to Overview
      </Link>
    </div>
  );
}
