import { NextRequest, NextResponse } from 'next/server';
import {
  calendarName, encryptToken, exchangeCode, syncGoogleCalendar, watchGoogleCalendar,
} from '@/lib/googleCalendarServer';
import { requireAdmin, serviceSupabase } from '@/lib/serverSupabase';

export const runtime = 'nodejs';

const finish = (request: NextRequest, code: string) => {
  const response = NextResponse.redirect(new URL(`/cal?google=${code}`, request.url));
  response.cookies.delete('ohome_gcal_state');
  response.cookies.delete('ohome_gcal_uid');
  return response;
};

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const expected = request.cookies.get('ohome_gcal_state')?.value;
    const expectedUser = request.cookies.get('ohome_gcal_uid')?.value;
    if (!code || !state || !expected || state !== expected) return finish(request, 'invalid-state');

    const user = await requireAdmin();
    if (!expectedUser || expectedUser !== user.id) return finish(request, 'invalid-user');

    const redirectUri = `${request.nextUrl.origin}/api/google-calendar/callback`;
    const token = await exchangeCode(code, redirectUri);
    const sb = serviceSupabase();
    const { data: old } = await sb.from('calendar_connections')
      .select('refresh_token_enc').eq('user_id', user.id).maybeSingle();
    const refreshTokenEnc = token.refresh_token
      ? await encryptToken(token.refresh_token)
      : old?.refresh_token_enc;
    if (!refreshTokenEnc) throw new Error('Google 갱신 토큰을 받지 못했습니다.');

    const name = await calendarName(token.access_token!);
    const now = new Date().toISOString();
    const { error } = await sb.from('calendar_connections').upsert({
      user_id: user.id,
      provider: 'google',
      refresh_token_enc: refreshTokenEnc,
      calendar_id: 'primary',
      calendar_name: name,
      updated_at: now,
    });
    if (error) throw error;

    await syncGoogleCalendar(user.id);
    await watchGoogleCalendar(user.id, request.nextUrl.origin);
    return finish(request, 'connected');
  } catch (error) {
    console.error('[ohome] Google Calendar callback failed', error);
    return finish(request, 'error');
  }
}
