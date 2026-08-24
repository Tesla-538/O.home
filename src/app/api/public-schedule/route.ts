import { serviceSupabase } from '@/lib/serverSupabase';
import type { CalendarState } from '@/lib/googleCalendarServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHED_KEY = 'ohome.sched.v1';

/** 방문자에게는 과거 기록과 비공개 항목이 애초에 브라우저로 내려가지 않게 한다. */
export async function GET() {
  try {
    const { data, error } = await serviceSupabase()
      .from('site_settings').select('value').eq('key', SCHED_KEY).maybeSingle();
    if (error) throw error;
    const state = (data?.value ?? { events: [], cats: [], allowMember: false }) as CalendarState;
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const events = (state.events ?? []).filter(event => {
      if (event.visibility !== 'public') return false;
      if (event.done && !event.keepRecord) return false;
      if (event.repeat === 'yearly') return true;
      const end = event.end && event.end >= event.start ? event.end : event.start;
      return end >= today;
    });
    return Response.json({
      state: { events, cats: state.cats ?? [], allowMember: false, todoMigrated: true },
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('[ohome] public schedule projection failed', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'PUBLIC_SCHEDULE_FAILED',
      state: { events: [], cats: [], allowMember: false, todoMigrated: true },
    },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
