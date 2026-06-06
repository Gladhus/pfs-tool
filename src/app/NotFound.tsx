import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4 bg-bg text-muted">
      <p className="text-6xl font-bold text-fg-2">404</p>
      <p className="text-sm">Page not found.</p>
      <Link to="/overview" className="text-sm text-accent hover:text-accent-dark underline">
        Go to Overview
      </Link>
    </div>
  );
}
