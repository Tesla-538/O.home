import { requireAdmin } from '@/lib/serverSupabase';
import { unleashedWiki, UNLEASHED_CATEGORIES, type UnleashedCategory, type UnleashedRecord } from '@/lib/unleashedWiki';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicRecord(record: UnleashedRecord, detail = false) {
  const base = {
    id: record.id,
    category: record.category,
    title: record.title,
    sourceUrl: record.sourceUrl,
    listSourceUrl: record.listSourceUrl,
    listHeaders: record.listHeaders,
    listValues: record.listValues,
  };
  return detail ? { ...base, detail: record.detail } : base;
}

async function assertAdmin(request: Request) {
  // 로컬 mock 계정은 외부 인증 토큰이 없다. 개발 서버에서만 명시 헤더로 UI 검증을 허용한다.
  if (process.env.NODE_ENV !== 'production' && request.headers.get('x-ohome-local-admin') === '1') return;
  await requireAdmin(request);
}

function authStatus(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') return 401;
  if (message === 'FORBIDDEN') return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const record = unleashedWiki.records.find(item => item.id === id);
      if (!record) return Response.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
      return Response.json({ record: publicRecord(record, true) }, {
        headers: { 'cache-control': 'private, no-store' },
      });
    }

    const requestedCategory = url.searchParams.get('category');
    const category = UNLEASHED_CATEGORIES.includes(requestedCategory as UnleashedCategory)
      ? requestedCategory as UnleashedCategory
      : '녹스';
    const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('ko-KR');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(60, Math.max(12, Number(url.searchParams.get('limit')) || 36));
    const filtered = unleashedWiki.records.filter(record => record.category === category
      && (!query || record.searchText.includes(query)));
    const pages = Math.max(1, Math.ceil(filtered.length / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;

    return Response.json({
      source: unleashedWiki.source,
      failures: unleashedWiki.failures,
      categoryCounts: unleashedWiki.categoryCounts,
      categories: UNLEASHED_CATEGORIES,
      category,
      query,
      page: safePage,
      pages,
      total: filtered.length,
      records: filtered.slice(start, start + limit).map(record => publicRecord(record)),
    }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    const status = authStatus(error);
    return Response.json({ error: status === 403 ? '관리자 계정만 열람할 수 있습니다.'
      : status === 401 ? '로그인이 필요합니다.' : '위키 데이터를 불러오지 못했습니다.' }, {
      status,
      headers: { 'cache-control': 'private, no-store' },
    });
  }
}

