import { renewAllWatches } from '@/lib/googleCalendarServer';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const origin = new URL(request.url).origin;
    await renewAllWatches(origin);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '갱신 실패' }, { status: 500 });
  }
}
