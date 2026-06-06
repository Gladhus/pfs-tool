import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom';
}

const MARGIN = 8;

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), 300); };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setPos(null);
  };

  // Position after render via fixed coords clamped to the viewport, so the
  // tooltip never gets clipped by scroll containers or the screen edge.
  useLayoutEffect(() => {
    if (!visible) return;
    const trig = triggerRef.current;
    const tip = tipRef.current;
    if (!trig || !tip) return;
    const r = trig.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - MARGIN));
    const top = side === 'bottom' ? r.bottom + 6 : r.top - th - 6;
    setPos({ top: Math.max(MARGIN, top), left });
  }, [visible, content, side]);

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          style={pos
            ? { position: 'fixed', top: pos.top, left: pos.left }
            : { position: 'fixed', top: -9999, left: -9999 }}
          className="z-[100] max-w-[min(16rem,calc(100vw-1rem))] rounded bg-fg px-2 py-1 text-xs text-surface-1 shadow-md pointer-events-none"
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
}
