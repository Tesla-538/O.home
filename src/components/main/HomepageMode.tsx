'use client';

import React, { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WidgetConf, WidgetType } from '@/lib/mainStore';
import { renderWidget } from '@/components/main/widgets';
import { useAuth } from '@/lib/auth';
import styles from './HomepageMode.module.css';

type ToolTab = 'today' | 'memo' | 'recent';
type PieceId = 'clock' | 'search' | 'banner' | 'latest' | 'tools';
type PieceLayout = { x: number; y: number; width?: number; height?: number };
type LayoutState = Record<PieceId, PieceLayout>;

const MOBILE_LAYOUT_KEY = 'ohome.homeLayout.mobile.v1';
const DESKTOP_LAYOUT_KEY = 'ohome.homeLayout.desktop.v1';
const DEFAULT_LAYOUT: LayoutState = {
  clock: { x: 0, y: 0 }, search: { x: 0, y: 0 }, banner: { x: 0, y: 0 },
  latest: { x: 0, y: 0 }, tools: { x: 0, y: 0 },
};

interface HomepageModeProps { widgets: WidgetConf[] }

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

function SearchArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12h13" />
      <path d="m13 7 5 5-5 5" />
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

function MovablePiece({ id, className = '', children, layout, dragging, resizing, editing, onPointerDown, onPointerMove, onPointerEnd, onResizeStart, onLongPress, onClickCapture }: {
  id: PieceId;
  className?: string;
  children: ReactNode;
  layout: PieceLayout;
  dragging: boolean;
  resizing: boolean;
  editing: boolean;
  onPointerDown: (id: PieceId, e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeStart: (id: PieceId, e: ReactPointerEvent<HTMLButtonElement>) => void;
  onLongPress: (id: PieceId, e: React.MouseEvent<HTMLDivElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const sized = layout.width != null || layout.height != null;
  const style = {
    '--piece-x': `${layout.x}px`, '--piece-y': `${layout.y}px`,
    ...(layout.width != null ? { width: `${layout.width}px` } : {}),
    ...(layout.height != null ? { height: `${layout.height}px` } : {}),
  } as CSSProperties;
  return (
    <div className={`${styles.piece} ${className} ${sized ? styles.sized : ''} ${editing ? styles.editing : ''} ${dragging ? styles.dragging : ''} ${resizing ? styles.resizing : ''}`}
      style={style} data-home-piece={id}
      onPointerDown={e => onPointerDown(id, e)} onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
      onContextMenu={e => onLongPress(id, e)} onClickCapture={onClickCapture}>
      {children}
      {editing && (
        <button type="button" className={styles.resizeHandle} aria-label="가로·세로 크기 조절"
          onPointerDown={e => onResizeStart(id, e)}
          onClick={e => { e.preventDefault(); e.stopPropagation(); }} />
      )}
    </div>
  );
}

export function HomepageMode({ widgets }: HomepageModeProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ToolTab>('today');
  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  const [dragging, setDragging] = useState<PieceId | null>(null);
  const [resizing, setResizing] = useState<PieceId | null>(null);
  const [layoutEditing, setLayoutEditing] = useState(false);
  const layoutRef = useRef(layout);
  const layoutKeyRef = useRef(DESKTOP_LAYOUT_KEY);
  const suppressClickUntil = useRef(0);
  const dragRef = useRef<{
    id: PieceId; pointerId: number; startX: number; startY: number;
    originX: number; originY: number; timer: number; active: boolean;
    rect: DOMRect; element: HTMLDivElement;
  } | null>(null);
  const resizeRef = useRef<{
    id: PieceId; pointerId: number; startX: number; startY: number;
    originWidth: number; originHeight: number; element: HTMLDivElement; handle: HTMLButtonElement;
    cleanup?: () => void;
  } | null>(null);
  layoutRef.current = layout;

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width:620px)');
    const loadLayout = () => {
      const key = media.matches ? MOBILE_LAYOUT_KEY : DESKTOP_LAYOUT_KEY;
      layoutKeyRef.current = key;
      try {
        const saved = localStorage.getItem(key);
        const next = saved ? { ...DEFAULT_LAYOUT, ...JSON.parse(saved) } : DEFAULT_LAYOUT;
        layoutRef.current = next;
        setLayout(next);
      } catch {
        layoutRef.current = DEFAULT_LAYOUT;
        setLayout(DEFAULT_LAYOUT);
      }
      setLayoutEditing(false);
      setDragging(null);
      setResizing(null);
      resizeRef.current?.cleanup?.();
      resizeRef.current = null;
    };
    loadLayout();
    media.addEventListener('change', loadLayout);
    return () => {
      media.removeEventListener('change', loadLayout);
      if (dragRef.current) window.clearTimeout(dragRef.current.timer);
      resizeRef.current?.cleanup?.();
      resizeRef.current = null;
    };
  }, []);

  const enabled = useMemo(() => widgets.filter(w => w.enabled), [widgets]);
  const find = (type: WidgetType) => enabled.find(w => w.type === type);
  const memo = find('memo');
  const latest = find('latest');
  const banner = find('banner');
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
    if (value.startsWith('/')) { router.push(value); return; }
    if (/^https?:\/\//i.test(value)) { window.location.assign(value); return; }
    if (/^[^\s/]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) { window.location.assign(`https://${value}`); return; }
    window.location.assign(`https://www.google.com/search?q=${encodeURIComponent(value)}`);
  };

  const beginMove = (id: PieceId, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (dragRef.current) window.clearTimeout(dragRef.current.timer);
    const element = e.currentTarget;
    const current = layoutRef.current[id];
    const draft: NonNullable<typeof dragRef.current> = {
      id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
      originX: current.x, originY: current.y, active: false,
      rect: element.getBoundingClientRect(), element, timer: 0,
    };
    dragRef.current = draft;
    const activate = () => {
      if (dragRef.current !== draft) return;
      draft.active = true;
      draft.rect = element.getBoundingClientRect();
      try { element.setPointerCapture(draft.pointerId); } catch { /* 합성 입력·취소된 포인터도 배치는 계속 허용 */ }
      setLayoutEditing(true);
      setDragging(id);
      navigator.vibrate?.(18);
    };
    if (layoutEditing) activate();
    else draft.timer = window.setTimeout(activate, 460);
  };

  const movePiece = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !drag.active) return;
    e.preventDefault();
    const rawDx = e.clientX - drag.startX;
    const rawDy = e.clientY - drag.startY;
    const dx = Math.min(window.innerWidth - 12 - drag.rect.right, Math.max(12 - drag.rect.left, rawDx));
    const dy = Math.min(window.innerHeight - 12 - drag.rect.bottom, Math.max(64 - drag.rect.top, rawDy));
    const next = {
      ...layoutRef.current,
      [drag.id]: {
        ...layoutRef.current[drag.id],
        x: Math.round(drag.originX + dx), y: Math.round(drag.originY + dy),
      },
    };
    layoutRef.current = next;
    setLayout(next);
  };

  const endMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    window.clearTimeout(drag.timer);
    if (drag.active) {
      e.preventDefault();
      suppressClickUntil.current = Date.now() + 380;
      try { drag.element.releasePointerCapture(drag.pointerId); } catch { /* 이미 해제됨 */ }
      try { localStorage.setItem(layoutKeyRef.current, JSON.stringify(layoutRef.current)); } catch { /* 현재 세션만 유지 */ }
    }
    dragRef.current = null;
    setDragging(null);
  };

  const minSize = (id: PieceId) => {
    if (id === 'clock') return { width: 240, height: 112 };
    if (id === 'search') return { width: 240, height: 48 };
    if (id === 'banner') return { width: 220, height: 120 };
    if (id === 'latest') return { width: 260, height: 118 };
    return { width: 260, height: 220 };
  };

  const beginResize = (id: PieceId, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const element = handle.parentElement as HTMLDivElement | null;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const draft: NonNullable<typeof resizeRef.current> = {
      id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
      originWidth: rect.width, originHeight: rect.height, element, handle,
    };
    resizeRef.current = draft;
    setResizing(id);
    const move = (event: PointerEvent) => {
      if (resizeRef.current !== draft || event.pointerId !== draft.pointerId) return;
      event.preventDefault();
      const currentRect = draft.element.getBoundingClientRect();
      const min = minSize(draft.id);
      const maxWidth = Math.max(min.width, window.innerWidth - 12 - currentRect.left);
      const maxHeight = Math.max(min.height, window.innerHeight - 12 - currentRect.top);
      const width = Math.round(Math.min(maxWidth, Math.max(min.width, draft.originWidth + event.clientX - draft.startX)));
      const height = Math.round(Math.min(maxHeight, Math.max(min.height, draft.originHeight + event.clientY - draft.startY)));
      const next = {
        ...layoutRef.current,
        [draft.id]: { ...layoutRef.current[draft.id], width, height },
      };
      layoutRef.current = next;
      setLayout(next);
    };
    const finish = (event: PointerEvent) => {
      if (resizeRef.current !== draft || event.pointerId !== draft.pointerId) return;
      event.preventDefault();
      suppressClickUntil.current = Date.now() + 380;
      try { localStorage.setItem(layoutKeyRef.current, JSON.stringify(layoutRef.current)); } catch { /* 현재 세션만 유지 */ }
      draft.cleanup?.();
      resizeRef.current = null;
      setResizing(null);
    };
    draft.cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish, { passive: false });
    window.addEventListener('pointercancel', finish, { passive: false });
  };

  const blockDraggedClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() >= suppressClickUntil.current) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const enterLayoutEditing = (_id: PieceId, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setLayoutEditing(true);
    navigator.vibrate?.(18);
  };

  const resetLayout = () => {
    layoutRef.current = DEFAULT_LAYOUT;
    setLayout(DEFAULT_LAYOUT);
    setResizing(null);
    resizeRef.current?.cleanup?.();
    resizeRef.current = null;
    try { localStorage.removeItem(layoutKeyRef.current); } catch { /* 무시 */ }
  };

  const movableProps = (id: PieceId) => ({
    id, layout: layout[id], dragging: dragging === id, resizing: resizing === id, editing: layoutEditing,
    onPointerDown: beginMove, onPointerMove: movePiece, onPointerEnd: endMove,
    onResizeStart: beginResize,
    onLongPress: enterLayoutEditing, onClickCapture: blockDraggedClick,
  });

  return (
    <div className={styles.shell} aria-label="관리자 홈페이지 모드">
      {layoutEditing && (
        <div className={styles.mobileHint}>
          <span>배치·크기 조정 중</span>
          <button type="button" onClick={resetLayout}>초기화</button>
          <button type="button" onClick={() => setLayoutEditing(false)}>완료</button>
        </div>
      )}

      <div className={styles.primary}>
        <section className={styles.hero}>
          <MovablePiece {...movableProps('clock')} className={styles.clockPiece}>
            <p className={styles.greeting}>{greeting}, {user?.nickname ?? '관리자'}</p>
            <div className={styles.clockRow}>
              <time className={styles.clock}>{clock}</time>
              <span>{date}</span>
            </div>
          </MovablePiece>

          <MovablePiece {...movableProps('search')} className={styles.searchPiece}>
            <form className={styles.search} onSubmit={submitSearch} role="search">
              <SearchIcon />
              <input value={query} onChange={e => setQuery(e.target.value)}
                aria-label="웹 검색 또는 주소 입력" placeholder="검색하거나 주소를 입력하세요" />
              <button type="submit" className={styles.searchSubmit} aria-label="검색"><SearchArrow /></button>
            </form>
          </MovablePiece>
        </section>

        {banner && (
          <MovablePiece {...movableProps('banner')} className={styles.mobileBanner}>
            <section className={styles.widgetSurface} aria-label="기존 배너 위젯">{renderWidget(banner)}</section>
          </MovablePiece>
        )}

        <MovablePiece {...movableProps('latest')} className={styles.latestPiece}>
          <section className={styles.latest} aria-label="기존 최신 콘텐츠 위젯">
            <div className={styles.sectionLabel}><span>LATEST STORIES</span><i /></div>
            <div className={styles.widgetSurface}>
              {latest ? renderWidget(latest) : <EmptyLinkedWidget label="LATEST" />}
            </div>
          </section>
        </MovablePiece>
      </div>

      <MovablePiece {...movableProps('tools')} className={styles.toolsPiece}>
        <aside className={styles.tools} aria-label="기존 홈 위젯 도구 패널">
          <div className={styles.tabs} role="tablist" aria-label="홈페이지 도구">
            {([['today', '오늘'], ['memo', '메모'], ['recent', '최근']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id}
                className={tab === id ? styles.tabOn : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          <div className={styles.toolScroll}>
            {tab === 'today' && (
              <>
                <div className={styles.widgetSurface}>{todo ? renderWidget(todo) : <EmptyLinkedWidget label="TO-DO" />}</div>
                <div className={styles.widgetSurface}>{dday ? renderWidget(dday) : <EmptyLinkedWidget label="D-DAY" />}</div>
              </>
            )}
            {tab === 'memo' && (
              <div className={`${styles.widgetSurface} ${styles.memoSurface}`}>
                {memo ? renderWidget(memo) : <EmptyLinkedWidget label="MEMO" />}
              </div>
            )}
            {tab === 'recent' && (
              <div className={styles.widgetSurface}>{diary ? renderWidget(diary) : <EmptyLinkedWidget label="DIARY" />}</div>
            )}
          </div>
        </aside>
      </MovablePiece>
    </div>
  );
}
