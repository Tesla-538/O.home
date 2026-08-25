import { serviceSupabase } from '@/lib/serverSupabase';
import type { CalendarEvent, CalendarState } from '@/lib/googleCalendarServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHED_KEY = 'ohome.sched.v1';

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

function visitorEvent(event: CalendarEvent): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    catId: event.catId,
    color: event.color,
    // 오늘의 비공개 일정은 제목·날짜만 보이고 상세 메모는 공개하지 않는다.
    memo: event.visibility === 'public' ? event.memo : undefined,
    visibility: 'public',
    repeat: event.repeat,
    kind: event.kind,
    done: event.done,
    keepRecord: event.keepRecord,
  };
}

/** 방문자는 오늘 일정 전체와 오늘 이후 공개 일정만 읽는다. 과거·상세 비공개 정보는 내려보내지 않는다. */
export async function GET() {
  try {
    const { data, error } = await serviceSupabase()
      .from('site_settings').select('value').eq('key', SCHED_KEY).maybeSingle();
    if (error) throw error;
    const state = (data?.value ?? { events: [], cats: [], allowMember: false }) as CalendarState;
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const events = (state.events ?? []).flatMap(event => {
      if (event.done && !event.keepRecord) return [];
      const todayEvent = occursOn(event, today);
      const end = event.end && event.end >= event.start ? event.end : event.start;
      const visiblePublicEvent = event.visibility === 'public'
        && (event.repeat === 'yearly' || end >= today);
      return todayEvent || visiblePublicEvent ? [visitorEvent(event)] : [];
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
