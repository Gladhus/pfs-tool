// Custom logo — three ascending bars representing net worth growth.
// Kept as a React component since it's a bespoke brand asset.
// Issue #11 tracks replacing generic icons with Lucide React.
export default function Logo({ size = 20 }: { size?: number }) {
  const h = size;
  const w = Math.round(size * 15 / 12);
  return (
    <svg width={w} height={h} viewBox="0 0 15 12" fill="none" aria-hidden="true">
      <rect x="0"    y="7"   width="3.5" height="5"   rx="0.75" fill="currentColor" opacity="0.55"/>
      <rect x="5.75" y="3.5" width="3.5" height="8.5" rx="0.75" fill="currentColor" opacity="0.8"/>
      <rect x="11.5" y="0"   width="3.5" height="12"  rx="0.75" fill="currentColor"/>
    </svg>
  );
}
