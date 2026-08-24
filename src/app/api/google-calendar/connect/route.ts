import { NextRequest, NextResponse } from 'next/server';
import { googleConfig, oauthUrl } from '@/lib/googleCalendarServer';
import { requireAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!googleConfig().ready) return NextResponse.json({ error: 'Google Calendar 서버 설정이 아직 필요합니다.' }, { status: 503 });
    const state = crypto.randomUUID();
    const redirectUri = `${request.nextUrl.origin}/api/google-calendar/callback`;
    const response = NextResponse.json({ url: oauthUrl(redirectUri, state) });
    const options = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
    response.cookies.set('ohome_gcal_state', state, options);
    response.cookies.set('ohome_gcal_uid', user.id, options);
    return response;
  } catch {
    return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  }
}
