import type { LucideIcon } from 'lucide-react';
import {
  TrendingUp, Home, CreditCard, Activity, Clock,
  Plus, Pencil, Trash2, Archive, Check, X,
  ChevronDown, ChevronUp, ChevronRight,
  ArrowUp, ArrowDown, ExternalLink, Download, Upload,
  RefreshCw, Save, Copy, Eraser, Eye, EyeOff,
  User, Users, Settings, Search, Sun, Moon,
  Database, Inbox, PieChart, HelpCircle, AlertCircle,
  LayoutDashboard, Calendar, Table2, Lock, Wallet, ChartColumnIncreasing,
} from 'lucide-react';

const ICONS = {
  investments:  TrendingUp,
  realestate:   Home,
  cash:         CreditCard,
  debts:        Activity,
  other:        Clock,
  plus:         Plus,
  edit:         Pencil,
  trash:        Trash2,
  archive:      Archive,
  check:        Check,
  x:            X,
  chevronDown:  ChevronDown,
  chevronUp:    ChevronUp,
  chevronRight: ChevronRight,
  arrowUp:      ArrowUp,
  arrowDown:    ArrowDown,
  externalLink: ExternalLink,
  download:     Download,
  upload:       Upload,
  refresh:      RefreshCw,
  eraser:       Eraser,
  save:         Save,
  copy:         Copy,
  eye:          Eye,
  eyeOff:       EyeOff,
  user:         User,
  users:        Users,
  settings:     Settings,
  search:       Search,
  sun:          Sun,
  moon:         Moon,
  database:     Database,
  inbox:        Inbox,
  trendingUp:   TrendingUp,
  pieChart:     PieChart,
  helpCircle:   HelpCircle,
  alert:        AlertCircle,
  dashboard:    LayoutDashboard,
  calendar:     Calendar,
  table:        Table2,
  lock:         Lock,
  wallet:       Wallet,
  logo:         ChartColumnIncreasing,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-label'?: string;
}

export function Icon({ name, size = 16, strokeWidth = 2, className, 'aria-label': label }: IconProps) {
  const Component = ICONS[name] as LucideIcon;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
