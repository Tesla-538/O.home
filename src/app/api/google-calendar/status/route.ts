import { requireAdmin, serviceSupabase } from '@/lib/serverSupabase';
import { googleConfig } from '@/lib/googleCalendarServer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireAdmin(request);
    const { data } = await serviceSupabase().from('calendar_connections')
      .select('calendar_name,last_synced_at,channel_expiration').eq('user_id', user.id).maybeSingle();
    return Response.json({
      configured: googleConfig().ready,
      connected: !!data,
      calendarName: data?.calendar_name ?? null,
      lastSyncedAt: data?.last_synced_at ?? null,
      channelExpiration: data?.channel_expiration ?? null,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return Response.json({ error: message }, { status: message === 'UNAUTHORIZED' ? 401 : 403 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAdmin(request);
    const { error } = await serviceSupabase().from('calendar_connections').delete().eq('user_id', user.id);
    if (error) throw error;
    return Response.json({ connected: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '연결 해제 실패' }, { status: 400 });
  }
}
