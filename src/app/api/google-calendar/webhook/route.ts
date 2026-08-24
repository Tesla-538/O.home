import { serviceSupabase } from '@/lib/serverSupabase';
import { syncGoogleCalendar } from '@/lib/googleCalendarServer';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceId = request.headers.get('x-goog-resource-id');
  const token = request.headers.get('x-goog-channel-token');
  if (!channelId || !resourceId || !token || token !== process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN) {
    return new Response(null, { status: 403 });
  }

  const { data } = await serviceSupabase().from('calendar_connections')
    .select('user_id,resource_id').eq('channel_id', channelId).maybeSingle();
  if (!data || data.resource_id !== resourceId) return new Response(null, { status: 404 });

  try {
    await syncGoogleCalendar(data.user_id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[ohome] Google Calendar webhook sync failed', error);
    return new Response(null, { status: 500 });
  }
}
