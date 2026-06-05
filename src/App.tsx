import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <svg width="28" height="24" viewBox="0 0 15 12" fill="none" aria-hidden="true">
            <rect x="0"    y="7"   width="3.5" height="5"   rx="0.75" fill="white" opacity="0.55"/>
            <rect x="5.75" y="3.5" width="3.5" height="8.5" rx="0.75" fill="white" opacity="0.8"/>
            <rect x="11.5" y="0"   width="3.5" height="12"  rx="0.75" fill="white"/>
          </svg>
          <h1 className="text-2xl font-semibold tracking-tight">PFS Tool</h1>
        </div>
        <p className="text-gray-400 text-sm">
          React migration — {t('loading')}
        </p>
        <p className="text-gray-600 text-xs">Phase 0 complete ✓</p>
      </div>
    </div>
  );
}
