interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}>
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="text-xs text-muted max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
