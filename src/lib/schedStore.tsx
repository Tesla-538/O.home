'use client';
// 스케줄러 (4.12) — 월간 캘린더 일정 + 카테고리(관리자 편집) + 등록 권한 옵션
// 투두/D-day는 메인 위젯 데이터(mainStore)를 그대로 공유
import { useCallback, useEffect, useState } from 'react';
import { newId } from './postStore';
import type { Visibility } from './charStore';
import { getRawSetting, setSetting } from './settingStore';

export interface SchedCategory { id: string; label: string; color: string }

export const DEFAULT_SCHED_CATS: SchedCategory[] = [
  { id: 'sc-trpg', label: 'TRPG 세션', color: '#b39b6b' },
  { id: 'sc-due', label: '마감', color: '#a63a45' },
  { id: 'sc-anniv', label: '기념일', color: '#4c6a8e' },
];

export interface SchedEvent {
  id: string;
  title: string;
  start: string;             // YYYY-MM-DD
  end?: string;              // 기간 일정 (선택)
  catId: string;
  color?: string;            // 개별 색 (없으면 카테고리 색)
  memo?: string;
  visibility: Visibility;
  repeat: 'none' | 'yearly'; // 매년 반복
  updatedAt?: string;         // Google Calendar 충돌 해결용 최종 수정 시각
  googleEventId?: string;
  googleUpdatedAt?: string;
}

// 배포 기본 — 더미 일정 없음 (v1.9)
const SEED_EVENTS: SchedEvent[] = [];

export interface SchedState {
  events: SchedEvent[];
  cats: SchedCategory[];
  allowMember: boolean;      // 회원도 일정 등록 허용 (4.12 등록 권한 옵션)
  googleDeletedIds?: string[];
}

export type NewSchedEvent = Omit<SchedEvent, 'id' | 'updatedAt' | 'googleEventId' | 'googleUpdatedAt'>;

const DEFAULTS: SchedState = { events: SEED_EVENTS, cats: DEFAULT_SCHED_CATS, allowMember: false };
const KEY = 'ohome.sched.v1';

export function useSched() {
  const [st, setSt] = useState<SchedState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = getRawSetting(KEY);
      if (raw) setSt({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* 기본값 */ }
    setLoaded(true);
  }, []);
  const apply = useCallback((fn: (s: SchedState) => SchedState) => {
    setSt(s => {
      const n = fn(s);
      try { setSetting(KEY, n); } catch { /* 무시 */ }
      return n;
    });
  }, []);
  const addEvent = useCallback((ev: NewSchedEvent) =>
    apply(s => ({ ...s, events: [...s.events, { id: newId(), ...ev, updatedAt: new Date().toISOString() }] })), [apply]);
  const importEvents = useCallback((events: NewSchedEvent[]) => {
    apply(s => {
      const seen = new Set(s.events.map(e => `${e.title}\u0000${e.start}\u0000${e.end ?? ''}`));
      const next = [...s.events];
      for (const event of events) {
        const sig = `${event.title}\u0000${event.start}\u0000${event.end ?? ''}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        next.push({ id: newId(), ...event, updatedAt: new Date().toISOString() });
      }
      return { ...s, events: next };
    });
  }, [apply]);
  const updateEvent = useCallback((id: string, p: Partial<SchedEvent>) =>
    apply(s => ({ ...s, events: s.events.map(e => (e.id === id ? { ...e, ...p, updatedAt: new Date().toISOString() } : e)) })), [apply]);
  const removeEvent = useCallback((id: string) =>
    apply(s => {
      const event = s.events.find(e => e.id === id);
      return {
        ...s,
        events: s.events.filter(e => e.id !== id),
        googleDeletedIds: event?.googleEventId
          ? [...new Set([...(s.googleDeletedIds ?? []), event.googleEventId])]
          : s.googleDeletedIds,
      };
    }), [apply]);
  const patchCat = useCallback((id: string, p: Partial<SchedCategory>) =>
    apply(s => ({ ...s, cats: s.cats.map(c => (c.id === id ? { ...c, ...p } : c)) })), [apply]);
  const addCat = useCallback(() =>
    apply(s => ({ ...s, cats: [...s.cats, { id: newId(), label: '새 카테고리', color: '#8a8f98' }] })), [apply]);
  const removeCat = useCallback((id: string) =>
    apply(s => ({ ...s, cats: s.cats.filter(c => c.id !== id) })), [apply]);
  const setCats = useCallback((cats: SchedCategory[]) => apply(s => ({ ...s, cats })), [apply]);
  /** 특정 날짜 안에서 순서 바꾸기 (v2.0) — 달력 칸에는 위에서 3개만 보이므로 순서가 곧 우선순위다.
   *  그 날짜에 걸리는 일정들이 차지하던 자리에 새 순서를 그대로 끼워 넣는다. */
  const reorderOn = useCallback((ids: string[]) => apply(s => {
    const pos = s.events.map((e, i) => (ids.includes(e.id) ? i : -1)).filter(i => i >= 0);
    const byId = new Map(s.events.map(e => [e.id, e]));
    const next = [...s.events];
    ids.forEach((id, k) => { const e = byId.get(id); if (e && pos[k] !== undefined) next[pos[k]] = e; });
    return { ...s, events: next };
  }), [apply]);
  const setAllowMember = useCallback((v: boolean) => apply(s => ({ ...s, allowMember: v })), [apply]);
  const replaceState = useCallback((next: SchedState) => apply(() => next), [apply]);
  return {
    st, loaded, addEvent, importEvents, updateEvent, removeEvent,
    patchCat, addCat, removeCat, setCats, setAllowMember, reorderOn, replaceState,
  };
}

/** 일정 표시 색 — 개별 색 우선, 없으면 카테고리 색 */
export const eventColor = (e: SchedEvent, cats: SchedCategory[]) =>
  e.color ?? cats.find(c => c.id === e.catId)?.color ?? '#8a8f98';

/** 해당 날짜(YYYY-MM-DD)에 걸리는 일정인지 — 기간·매년 반복 지원 */
export function eventOnDate(e: SchedEvent, date: string): boolean {
  const end = e.end && e.end >= e.start ? e.end : e.start;
  if (e.repeat === 'yearly') {
    // 월-일만 비교 (기간 반복은 시작 월-일~끝 월-일)
    const md = date.slice(5);
    return e.start.slice(5) <= md && md <= end.slice(5);
  }
  return e.start <= date && date <= end;
}
