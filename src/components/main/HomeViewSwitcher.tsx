'use client';

import type { ReactNode } from 'react';
import styles from './HomeViewSwitcher.module.css';

type HomeView = 'focus' | 'dashboard' | 'home';

interface HomeViewSwitcherProps {
  view: HomeView;
  isAdmin: boolean;
  disabled: boolean;
  onChange: (view: HomeView) => void;
}

const OPTIONS: Array<{ id: HomeView; label: string; adminOnly?: boolean; icon: ReactNode }> = [
  {
    id: 'home', label: '홈페이지', adminOnly: true,
    icon: <><path d="M5 11.2 12 5l7 6.2" /><path d="M7.5 10.5V19h9v-8.5M10.2 19v-5h3.6v5" /></>,
  },
  {
    id: 'focus', label: '감상',
    icon: <><path d="M3.5 12s3.2-5.2 8.5-5.2S20.5 12 20.5 12 17.3 17.2 12 17.2 3.5 12 3.5 12Z" /><circle cx="12" cy="12" r="2.4" /></>,
  },
  {
    id: 'dashboard', label: '전체 위젯',
    icon: <><rect x="4.5" y="4.5" width="6" height="6" rx="1.3" /><rect x="13.5" y="4.5" width="6" height="6" rx="1.3" /><rect x="4.5" y="13.5" width="6" height="6" rx="1.3" /><rect x="13.5" y="13.5" width="6" height="6" rx="1.3" /></>,
  },
];

export function HomeViewSwitcher({ view, isAdmin, disabled, onChange }: HomeViewSwitcherProps) {
  return (
    <div className={styles.switcher} role="group" aria-label="홈 화면 보기 모드"
      onClick={e => e.stopPropagation()}>
      {OPTIONS.filter(option => !option.adminOnly || isAdmin).map(option => (
        <button key={option.id} type="button" className={view === option.id ? styles.active : ''}
          aria-pressed={view === option.id} disabled={disabled}
          onClick={() => onChange(option.id)}>
          <svg viewBox="0 0 24 24" aria-hidden>{option.icon}</svg>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
