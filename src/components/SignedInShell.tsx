import { useUIStore } from '@/stores/ui.store';

// Phase 1: tab placeholders. Phases 3–8 replace each with real content.

function TabPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
      {label} — coming soon
    </div>
  );
}

export default function SignedInShell() {
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {activeTab === 'overview'  && <TabPlaceholder label="Overview" />}
      {activeTab === 'history'   && <TabPlaceholder label="History" />}
      {activeTab === 'detail'    && <TabPlaceholder label="Detail" />}
      {activeTab === 'entry'     && <TabPlaceholder label="Entry" />}
      {activeTab === 'settings'  && <TabPlaceholder label="Settings" />}
    </main>
  );
}
