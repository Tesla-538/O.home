import { serviceSupabase } from '@/lib/serverSupabase';
import type { CalendarEvent, CalendarState } from '@/lib/googleCalendarServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHED_KEY = 'ohome.sched.v1';
type ViewerRole = 'guest' | 'member' | 'admin';

function occursOn(event: CalendarEvent, date: string): boolean {
  const end = event.end && event.end >= event.start ? event.end : event.start;
  if (event.repeat !== 'yearly') return event.start <= date && date <= end;
  const md = date.slice(5);
  const startMd = event.start.slice(5);
  const endMd = end.slice(5);
  return startMd <= endMd
    ? startMd <= md && md <= endMd
    : md >= startMd || md <= endMd;
}

function sharedEvent(event: CalendarEvent): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    catId: event.catId,
    color: event.color,
    memo: event.memo,
    visibility: event.visibility,
    repeat: event.repeat,
    kind: event.kind,
    done: event.done,
    keepRecord: event.keepRecord,
  };
}

async function viewerRole(request: Request): Promise<ViewerRole> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return 'guest';
  const sb = serviceSupabase();
  const { data: auth } = await sb.auth.getUser(bearer);
  if (!auth.user) return 'guest';
  const { data } = await sb.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  return data?.role === 'admin' ? 'admin' : 'member';
}

function canSee(event: CalendarEvent, role: ViewerRole): boolean {
  if (role === 'admin') return true;
  if (event.visibility === 'public') return true;
  return role === 'member' && event.visibility === 'member';
}

/** 공개범위에 맞는 일정만 전달한다. 비관리자에게는 과거 기록과 Google 내부 식별자를 내리지 않는다. */
export async function GET(request: Request) {
  try {
    const role = await viewerRole(request);
    const { data, error } = await serviceSupabase()
      .from('site_settings').select('value').eq('key', SCHED_KEY).maybeSingle();
    if (error) throw error;
    const state = (data?.value ?? { events: [], cats: [], allowMember: false }) as CalendarState;
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const events = (state.events ?? []).flatMap(event => {
      if (event.done && !event.keepRecord) return [];
      if (!canSee(event, role)) return [];
      if (role === 'admin') return [event];
      const end = event.end && event.end >= event.start ? event.end : event.start;
      const currentOrFuture = occursOn(event, today) || event.repeat === 'yearly' || end >= today;
      return currentOrFuture ? [sharedEvent(event)] : [];
    });
    return Response.json({
      state: { events, cats: state.cats ?? [], allowMember: false, todoMigrated: true },
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('[ohome] public schedule projection failed', error);
    return Response.json({
      state: { events: [], cats: [], allowMember: false, todoMigrated: true },
    },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
