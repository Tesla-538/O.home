'use client';
// 알림 (4.13) — 사이트 내 뱃지(헤더 종 + 메뉴 점). 디스코드 봇 DM은 Supabase/봇 서버 연동 시.
// 같은 탭 안에서 발생 지점(각 페이지)과 표시 지점(TopBar)이 다르므로 커스텀 이벤트로 동기화.
import { newId } from './postStore';

export type NotifType = 'rp' | 'comment' | 'guest';
export interface Notif {
  id: string;
  type: NotifType;
  toUserId: string;          // 수신 회원
  title: string;
  body?: string;
  href: string;              // 클릭 시 이동
  date: string;
  read: boolean;
}

const KEY = 'ohome.notif.v1';
const SET_KEY = 'ohome.notifset.v1'; // 회원별 알림 항목 on/off — { [userId]: { rp, comment, guest } }
export const NOTIF_EVENT = 'ohome-notif';

export const NOTIF_TYPE_LABEL: Record<NotifType, string> = {
  rp: '장면보관함 새 메시지', comment: '내 글 댓글', guest: '방명록 (관리자)',
};

export function readNotifs(): Notif[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

function write(list: Notif[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch { /* 무시 */ }
  window.dispatchEvent(new Event(NOTIF_EVENT));
}

export interface NotifSettings { rp: boolean; comment: boolean; guest: boolean }
const DEFAULT_SET: NotifSettings = { rp: true, comment: true, guest: true };

export function notifSettings(userId: string): NotifSettings {
  try {
    const all = JSON.parse(localStorage.getItem(SET_KEY) ?? '{}');
    return { ...DEFAULT_SET, ...(all[userId] ?? {}) };
  } catch { return DEFAULT_SET; }
}

export function setNotifSetting(userId: string, key: NotifType, value: boolean) {
  try {
    const all = JSON.parse(localStorage.getItem(SET_KEY) ?? '{}');
    all[userId] = { ...DEFAULT_SET, ...(all[userId] ?? {}), [key]: value };
    localStorage.setItem(SET_KEY, JSON.stringify(all));
  } catch { /* 무시 */ }
  window.dispatchEvent(new Event(NOTIF_EVENT));
}

/** 알림 생성 — 수신자가 해당 항목을 꺼뒀으면 만들지 않음.
 *  dedupeKey: 같은 키의 안 읽은 알림이 있으면 새로 쌓지 않고 갱신 (역극 방 단위 묶음 등) */
export function pushNotif(n: {
  type: NotifType; toUserId: string; title: string; body?: string; href: string; dedupeKey?: string;
}) {
  if (!notifSettings(n.toUserId)[n.type]) return;
  const list = readNotifs();
  if (n.dedupeKey) {
    const i = list.findIndex(x => !x.read && x.toUserId === n.toUserId
      && x.type === n.type && x.href === n.href && x.title === n.title);
    if (i >= 0) {
      const [ex] = list.splice(i, 1);
      write([{ ...ex, body: n.body, date: new Date().toISOString() }, ...list]);
      return;
    }
  }
  write([{
    id: newId(), type: n.type, toUserId: n.toUserId, title: n.title, body: n.body,
    href: n.href, date: new Date().toISOString(), read: false,
  }, ...list]);
}

export function markRead(id: string) {
  write(readNotifs().map(n => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead(userId: string) {
  write(readNotifs().map(n => (n.toUserId === userId ? { ...n, read: true } : n)));
}

export function removeNotif(id: string) {
  write(readNotifs().filter(n => n.id !== id));
}
