'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={clsx(
        'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
        'focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900'
      )}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <>
          <MoonIcon className="h-5 w-5" />
          <span>Dark</span>
        </>
      ) : (
        <>
          <SunIcon className="h-5 w-5" />
          <span>Light</span>
        </>
      )}
    </button>
  )
}
