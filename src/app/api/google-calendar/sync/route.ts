import type { CalendarState } from '@/lib/googleCalendarServer';
import { syncGoogleCalendar } from '@/lib/googleCalendarServer';
import { requireAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body = await request.json().catch(() => ({})) as { state?: CalendarState };
    const state = await syncGoogleCalendar(user.id, body.state);
    return Response.json({ state, syncedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : '동기화 실패';
    return Response.json({ error: message }, { status: message === 'UNAUTHORIZED' ? 401 : 400 });
  }
}
