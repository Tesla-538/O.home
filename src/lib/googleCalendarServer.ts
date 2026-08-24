import { serviceSupabase } from './serverSupabase';

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
const SCHED_KEY = 'ohome.sched.v1';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  catId: string;
  color?: string;
  memo?: string;
  visibility: 'public' | 'member' | 'private';
  repeat: 'none' | 'yearly';
  kind?: 'event' | 'todo';
  done?: boolean;
  updatedAt?: string;
  googleEventId?: string;
  googleUpdatedAt?: string;
}

export interface CalendarState {
  events: CalendarEvent[];
  cats: { id: string; label: string; color: string }[];
  allowMember: boolean;
  googleDeletedIds?: string[];
  todoMigrated?: boolean;
}

interface Connection {
  user_id: string;
  refresh_token_enc: string;
  calendar_id: string;
  calendar_name?: string | null;
  channel_id?: string | null;
  resource_id?: string | null;
  channel_expiration?: string | null;
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  recurrence?: string[];
  extendedProperties?: { private?: Record<string, string> };
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const unb64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64url'));

async function cryptoKey(): Promise<CryptoKey> {
  const raw = process.env.GOOGLE_CALENDAR_TOKEN_KEY;
  if (!raw) throw new Error('Google Calendar 토큰 암호화 키가 없습니다.');
  const bytes = unb64(raw);
  if (bytes.byteLength !== 32) throw new Error('Google Calendar 토큰 암호화 키 형식이 잘못되었습니다.');
  return crypto.subtle.importKey('raw', bytes as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), new TextEncoder().encode(token));
  return `${b64(iv)}.${b64(new Uint8Array(out))}`;
}

async function decryptToken(value: string): Promise<string> {
  const [iv, data] = value.split('.');
  if (!iv || !data) throw new Error('저장된 Google 토큰 형식이 잘못되었습니다.');
  const out = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) as BufferSource },
    await cryptoKey(),
    unb64(data) as BufferSource,
  );
  return new TextDecoder().decode(out);
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '';
  return { clientId, clientSecret, ready: !!clientId && !!clientSecret };
}

export function oauthUrl(redirectUri: string, state: string): string {
  const { clientId } = googleConfig();
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = googleConfig();
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const body = await res.json() as { refresh_token?: string; access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(body.error_description ?? 'Google OAuth 토큰 교환에 실패했습니다.');
  return body;
}

export async function calendarName(accessToken: string): Promise<string> {
  // calendar.calendarlist.readonly 범위로 읽을 수 있는 엔드포인트를 사용한다.
  // /calendars/primary는 더 넓은 calendar.readonly 권한을 요구한다.
  const data = await googleFetch<{ summary?: string }>(accessToken, '/users/me/calendarList/primary');
  return data.summary?.trim() || 'Google Calendar';
}

async function accessToken(conn: Connection): Promise<string> {
  const { clientId, clientSecret } = googleConfig();
  const refresh = await decryptToken(conn.refresh_token_enc);
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const body = await res.json() as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(body.error_description ?? 'Google 액세스 토큰 갱신에 실패했습니다.');
  return body.access_token;
}

async function googleFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Google Calendar API 오류 (${res.status}): ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : await res.json() as T;
}

const plusDay = (date: string, amount: number) => {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
};

function toGoogle(e: CalendarEvent) {
  const endInclusive = e.end && e.end >= e.start ? e.end : e.start;
  return {
    summary: e.kind === 'todo' ? `${e.done ? '☑' : '☐'} ${e.title}` : e.title,
    description: e.memo ?? '',
    start: { date: e.start },
    end: { date: plusDay(endInclusive, 1) },
    recurrence: e.repeat === 'yearly' ? ['RRULE:FREQ=YEARLY'] : undefined,
    extendedProperties: { private: {
      ohomeId: e.id, ohomeVisibility: e.visibility, ohomeCatId: e.catId,
      ohomeKind: e.kind ?? 'event', ohomeDone: e.done ? 'true' : 'false',
    } },
  };
}

function fromGoogle(g: GoogleEvent, fallbackCat: string): CalendarEvent | null {
  const start = g.start?.date ?? g.start?.dateTime?.slice(0, 10);
  if (!g.id || !start || g.status === 'cancelled') return null;
  const rawEnd = g.end?.date ?? g.end?.dateTime?.slice(0, 10);
  const end = g.end?.date && rawEnd ? plusDay(rawEnd, -1) : rawEnd;
  const p = g.extendedProperties?.private ?? {};
  const kind = p.ohomeKind === 'todo' ? 'todo' : 'event';
  const rawTitle = g.summary?.trim() || '(제목 없음)';
  return {
    id: p.ohomeId || `gcal-${g.id}`,
    title: kind === 'todo' ? rawTitle.replace(/^[☐☑]\s*/, '') : rawTitle, start,
    end: end && end !== start ? end : undefined,
    catId: p.ohomeCatId || fallbackCat,
    memo: g.description?.trim() || undefined,
    visibility: (['public', 'member', 'private'].includes(p.ohomeVisibility) ? p.ohomeVisibility : 'private') as CalendarEvent['visibility'],
    repeat: g.recurrence?.some(x => /FREQ=YEARLY/.test(x)) ? 'yearly' : 'none',
    kind, done: kind === 'todo' ? p.ohomeDone === 'true' || /^☑/.test(rawTitle) : undefined,
    googleEventId: g.id,
    googleUpdatedAt: g.updated,
    updatedAt: g.updated,
  };
}

async function listGoogleEvents(token: string, calendarId: string): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let page = '';
  do {
    const q = new URLSearchParams({ maxResults: '2500', showDeleted: 'true', singleEvents: 'false' });
    if (page) q.set('pageToken', page);
    const data = await googleFetch<{ items?: GoogleEvent[]; nextPageToken?: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    out.push(...(data.items ?? []));
    page = data.nextPageToken ?? '';
  } while (page);
  return out;
}

async function connection(userId: string): Promise<Connection> {
  const { data, error } = await serviceSupabase().from('calendar_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) throw new Error('Google Calendar가 연결되지 않았습니다.');
  return data as Connection;
}

export async function readCalendarState(): Promise<CalendarState> {
  const { data } = await serviceSupabase().from('site_settings').select('value').eq('key', SCHED_KEY).maybeSingle();
  return (data?.value ?? { events: [], cats: [], allowMember: false }) as CalendarState;
}

async function saveCalendarState(state: CalendarState) {
  const { error } = await serviceSupabase().from('site_settings').upsert({ key: SCHED_KEY, value: state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function syncGoogleCalendar(userId: string, supplied?: CalendarState): Promise<CalendarState> {
  const conn = await connection(userId);
  const token = await accessToken(conn);
  const state = supplied ?? await readCalendarState();
  const cats = state.cats ?? [];
  const fallbackCat = cats[0]?.id ?? '';
  const local = [...(state.events ?? [])];

  for (const id of state.googleDeletedIds ?? []) {
    await googleFetch<void>(token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
  }

  const remote = await listGoogleEvents(token, conn.calendar_id);
  const byGoogle = new Map(remote.filter(g => g.id).map(g => [g.id, g]));
  const seen = new Set<string>();
  const merged: CalendarEvent[] = [];

  for (const event of local) {
    let g = event.googleEventId ? byGoogle.get(event.googleEventId) : remote.find(x => x.extendedProperties?.private?.ohomeId === event.id);
    if (g?.status === 'cancelled') continue;
    if (!g) {
      g = await googleFetch<GoogleEvent>(token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events`, { method: 'POST', body: JSON.stringify(toGoogle(event)) });
      merged.push({ ...event, googleEventId: g.id, googleUpdatedAt: g.updated, updatedAt: g.updated });
      seen.add(g.id);
      continue;
    }
    seen.add(g.id);
    const localTime = Date.parse(event.updatedAt ?? '') || 0;
    const googleTime = Date.parse(g.updated ?? '') || 0;
    if (localTime > googleTime + 1000) {
      const updated = await googleFetch<GoogleEvent>(token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(g.id)}`, { method: 'PATCH', body: JSON.stringify(toGoogle(event)) });
      merged.push({ ...event, googleEventId: updated.id, googleUpdatedAt: updated.updated, updatedAt: updated.updated });
    } else {
      const imported = fromGoogle(g, fallbackCat);
      if (imported) merged.push({ ...event, ...imported, id: event.id, catId: imported.catId || event.catId });
    }
  }

  for (const g of remote) {
    if (!g.id || seen.has(g.id) || g.status === 'cancelled') continue;
    const imported = fromGoogle(g, fallbackCat);
    if (imported) merged.push(imported);
  }

  const next: CalendarState = { ...state, events: merged, googleDeletedIds: [] };
  await saveCalendarState(next);
  await serviceSupabase().from('calendar_connections').update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
  return next;
}

export async function watchGoogleCalendar(userId: string, baseUrl: string) {
  const conn = await connection(userId);
  const token = await accessToken(conn);
  if (conn.channel_id && conn.resource_id) {
    await googleFetch<void>(token, '/channels/stop', {
      method: 'POST', body: JSON.stringify({ id: conn.channel_id, resourceId: conn.resource_id }),
    }).catch(() => undefined);
  }
  const channelId = crypto.randomUUID();
  const webhookToken = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN;
  if (!webhookToken) throw new Error('Google Calendar 웹훅 토큰이 없습니다.');
  const data = await googleFetch<{ id: string; resourceId: string; expiration?: string }>(token,
    `/calendars/${encodeURIComponent(conn.calendar_id)}/events/watch`, {
      method: 'POST', body: JSON.stringify({ id: channelId, type: 'web_hook', address: `${baseUrl}/api/google-calendar/webhook`, token: webhookToken, params: { ttl: '604800' } }),
    });
  await serviceSupabase().from('calendar_connections').update({
    channel_id: data.id, resource_id: data.resourceId,
    channel_expiration: data.expiration ? new Date(Number(data.expiration)).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return data;
}

export async function renewAllWatches(baseUrl: string) {
  const { data } = await serviceSupabase().from('calendar_connections').select('user_id, channel_expiration');
  for (const row of data ?? []) {
    const left = Date.parse(row.channel_expiration ?? '') - Date.now();
    if (!Number.isFinite(left) || left < 2 * 86400000) await watchGoogleCalendar(row.user_id, baseUrl);
  }
}
