import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function serverUser(): Promise<User | null> {
  const jar = await cookies();
  const sb = createServerClient(url(), anon(), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: list => list.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export function serviceSupabase(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url() || !key) throw new Error('Supabase 서버 키가 설정되지 않았습니다.');
  return createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireAdmin(request?: Request): Promise<User> {
  const bearer = request?.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const authClient = createClient(url(), anon(), {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(bearer ? { global: { headers: { Authorization: `Bearer ${bearer}` } } } : {}),
  });
  const user = bearer ? (await authClient.auth.getUser(bearer)).data.user : await serverUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { data, error } = await authClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) throw new Error(`PROFILE_LOOKUP_FAILED:${error.code}`);
  if (data?.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}
