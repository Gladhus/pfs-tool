import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { Button } from '@/ui/Button';
import { Delta } from '@/ui/Delta';
import { StatCard } from '@/ui/StatCard';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { SegmentControl } from '@/ui/SegmentControl';
import { ToastHost } from '@/ui/ToastHost';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

describe('Button', () => {
  it('renders with default variant class', () => {
    const { container } = render(<Button>Click me</Button>);
    expect(container.firstChild).toHaveClass('bg-surface-2');
  });

  it('renders primary variant with accent class', () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    expect(container.firstChild).toHaveClass('bg-accent');
  });

  it('renders danger variant', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toHaveClass('bg-red');
  });
});

describe('Delta', () => {
  it('renders positive value with ok color', () => {
    render(<Delta value={1200} locale="en" currency="CAD" />);
    const el = screen.getByText(/\+/);
    expect(el).toHaveClass('text-ok');
  });

  it('renders negative value with red color', () => {
    render(<Delta value={-500} locale="en" currency="CAD" />);
    const el = screen.getByText(/-/);
    expect(el).toHaveClass('text-red');
  });

  it('masks value when isPrivate=true', () => {
    render(<Delta value={1000} locale="en" currency="CAD" isPrivate />);
    expect(screen.getByText(/••/)).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders with label and value text', () => {
    render(
      <StatCard head={{ label: 'Cash' }} valueText="$5,000" />,
    );
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('$5,000')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('renders message and calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        message="Are you sure?"
      />,
      { wrapper },
    );

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={vi.fn()}
        message="Sure?"
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('SegmentControl', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma' },
  ] as const;

  it('marks selected option as aria-checked', () => {
    render(<SegmentControl options={[...options]} value="b" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when clicking a different option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SegmentControl options={[...options]} value="a" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('moves focus with ArrowRight key', async () => {
    const user = userEvent.setup();

    render(<SegmentControl options={[...options]} value="a" onChange={vi.fn()} />);
    screen.getByRole('radio', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Beta' }));
  });
});

describe('ToastHost', () => {
  it('renders without crashing when no toasts', () => {
    render(<ToastHost />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
