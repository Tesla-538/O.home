import { NextRequest, NextResponse } from 'next/server';
import { googleConfig, oauthUrl } from '@/lib/googleCalendarServer';
import { requireAdmin } from '@/lib/serverSupabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!googleConfig().ready) return NextResponse.redirect(new URL('/cal?google=not-configured', request.url));
    const state = crypto.randomUUID();
    const redirectUri = `${request.nextUrl.origin}/api/google-calendar/callback`;
    const response = NextResponse.redirect(oauthUrl(redirectUri, state));
    const options = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
    response.cookies.set('ohome_gcal_state', state, options);
    response.cookies.set('ohome_gcal_uid', user.id, options);
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?next=/cal', request.url));
  }
}
