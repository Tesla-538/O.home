'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WidgetConf, WidgetType } from '@/lib/mainStore';
import { renderWidget } from '@/components/main/widgets';
import { useAuth } from '@/lib/auth';
import styles from './HomepageMode.module.css';

type ToolTab = 'today' | 'memo' | 'recent';

interface HomepageModeProps {
  widgets: WidgetConf[];
  motionLocked: boolean;
  onFocusMode: () => void;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 12s3.2-5.2 8.5-5.2S20.5 12 20.5 12 17.3 17.2 12 17.2 3.5 12 3.5 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

function EmptyLinkedWidget({ label }: { label: string }) {
  return (
    <div className={styles.empty}>
      <b>{label}</b>
      <span>현재 홈에 등록된 위젯이 없습니다.</span>
    </div>
  );
}

export function HomepageMode({ widgets, motionLocked, onFocusMode }: HomepageModeProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ToolTab>('today');

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const enabled = useMemo(() => widgets.filter(w => w.enabled), [widgets]);
  const find = (type: WidgetType) => enabled.find(w => w.type === type);
  const memo = find('memo');
  const latest = find('latest');
  const diary = find('diary');
  const dday = find('dday');
  const todo = find('todo');

  const hour = now?.getHours() ?? 8;
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
  const clock = now?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) ?? '--:--';
  const date = now?.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }) ?? '';

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (value.startsWith('/')) {
      router.push(value);
      return;
    }
    if (/^https?:\/\//i.test(value)) {
      window.location.assign(value);
      return;
    }
    if (/^[^\s/]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) {
      window.location.assign(`https://${value}`);
      return;
    }
    window.location.assign(`https://www.google.com/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <div className={styles.shell} aria-label="관리자 홈페이지 모드">
      <div className={styles.scrim} aria-hidden />

      <div className={styles.primary}>
        <section className={styles.hero}>
          <p className={styles.greeting}>{greeting}, {user?.nickname ?? '관리자'}</p>
          <div className={styles.clockRow}>
            <time className={styles.clock}>{clock}</time>
            <span>{date}</span>
          </div>

          <form className={styles.search} onSubmit={submitSearch} role="search">
            <SearchIcon />
            <input value={query} onChange={e => setQuery(e.target.value)}
              aria-label="웹 검색 또는 주소 입력" placeholder="검색하거나 주소를 입력하세요" />
            <kbd>Enter</kbd>
          </form>

          <div className={styles.modeSwitch} aria-label="홈 화면 모드">
            <span className={styles.modeCurrent}>홈페이지 모드</span>
            <button type="button" onClick={onFocusMode} disabled={motionLocked}>
              <EyeIcon /> 감상 모드
            </button>
          </div>
        </section>

        <section className={styles.latest} aria-label="기존 최신 콘텐츠 위젯">
          <div className={styles.sectionLabel}><span>LATEST STORIES</span><i /></div>
          <div className={styles.widgetSurface}>
            {latest ? renderWidget(latest) : <EmptyLinkedWidget label="LATEST" />}
          </div>
        </section>
      </div>

      <aside className={styles.tools} aria-label="기존 홈 위젯 도구 패널">
        <div className={styles.tabs} role="tablist" aria-label="홈페이지 도구">
          {([
            ['today', '오늘'],
            ['memo', '메모'],
            ['recent', '최근'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id}
              className={tab === id ? styles.tabOn : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className={styles.toolScroll}>
          {tab === 'today' && (
            <>
              <div className={styles.widgetSurface}>
                {todo ? renderWidget(todo) : <EmptyLinkedWidget label="TO-DO" />}
              </div>
              <div className={styles.widgetSurface}>
                {dday ? renderWidget(dday) : <EmptyLinkedWidget label="D-DAY" />}
              </div>
            </>
          )}
          {tab === 'memo' && (
            <div className={`${styles.widgetSurface} ${styles.memoSurface}`}>
              {memo ? renderWidget(memo) : <EmptyLinkedWidget label="MEMO" />}
            </div>
          )}
          {tab === 'recent' && (
            <div className={styles.widgetSurface}>
              {diary ? renderWidget(diary) : <EmptyLinkedWidget label="DIARY" />}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
