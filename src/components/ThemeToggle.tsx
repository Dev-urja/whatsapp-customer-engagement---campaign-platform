import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="theme-toggle flex items-center gap-1 p-1 rounded-xl border bg-slate-100 border-slate-200"
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
        title="Light theme"
        className={`flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all ${
          compact ? 'px-2 py-1.5' : 'px-3 py-1.5'
        } ${theme === 'light' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <Sun className="w-3.5 h-3.5" />
        {!compact && 'Light'}
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
        title="Dark theme"
        className={`flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all ${
          compact ? 'px-2 py-1.5' : 'px-3 py-1.5'
        } ${theme === 'dark' ? 'bg-slate-700 text-urja-secondary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <Moon className="w-3.5 h-3.5" />
        {!compact && 'Dark'}
      </button>
    </div>
  );
}
