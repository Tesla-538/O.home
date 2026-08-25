'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

type Category = '녹스' | '효과' | '퀘스트' | '레이드' | '아이템' | '스킨';

interface WikiRecordSummary {
  id: string;
  category: Category;
  title: string;
  sourceUrl: string;
  listSourceUrl: string;
  listHeaders: string[];
  listValues: string[];
}

interface WikiRecord extends WikiRecordSummary { detail: string[] }

interface WikiListResponse {
  source: { name: string; baseUrl: string; collectedAt: string; imagePolicy: string };
  categoryCounts: Record<Category, number>;
  categories: Category[];
  category: Category;
  page: number;
  pages: number;
  total: number;
  records: WikiRecordSummary[];
  error?: string;
}

const CATEGORY_ICON: Record<Category, string> = {
  녹스: '◇', 효과: '✦', 퀘스트: '⚑', 레이드: '⚔', 아이템: '□', 스킨: '○',
};

export default function UnleashedMiniWikiPage() {
  const router = useRouter();
  const { user, isAdmin, mock, accessToken } = useAuth();
  const [category, setCategory] = useState<Category>('녹스');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WikiListResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<WikiRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = async () => {
    const headers: Record<string, string> = {};
    const token = await accessToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (mock && isAdmin) headers['x-ohome-local-admin'] = '1';
    return headers;
  };

  useEffect(() => { setPage(1); }, [category, deferredQuery]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const headers = await authHeaders();
        const params = new URLSearchParams({ category, q: deferredQuery, page: String(page), limit: '36' });
        const response = await fetch(`/api/mini-wiki/unleashed?${params}`, { headers, signal: controller.signal, cache: 'no-store' });
        const next = await response.json() as WikiListResponse;
        if (!response.ok) throw new Error(next.error || '위키 데이터를 불러오지 못했습니다.');
        setData(next);
        setSelectedId(current => next.records.some(record => record.id === current) ? current : (next.records[0]?.id ?? null));
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') setError((loadError as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
    // accessToken is stable in the auth provider; mock/isAdmin changes remount the request with the right gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, mock, category, deferredQuery, page, accessToken]);

  useEffect(() => {
    if (!isAdmin || !selectedId) { setSelected(null); return; }
    const controller = new AbortController();
    setDetailLoading(true);
    void (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch(`/api/mini-wiki/unleashed?id=${encodeURIComponent(selectedId)}`, {
          headers, signal: controller.signal, cache: 'no-store',
        });
        const body = await response.json() as { record?: WikiRecord; error?: string };
        if (!response.ok || !body.record) throw new Error(body.error || '상세 정보를 불러오지 못했습니다.');
        setSelected(body.record);
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') setError((loadError as Error).message);
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, mock, selectedId, accessToken]);

  const summaryValues = useMemo(() => selected?.listValues.filter(value => value && value !== selected.title) ?? [], [selected]);

  if (!user || !isAdmin) {
    return (
      <section className="page uw-page uw-locked-page">
        <div className="panel uw-locked">
          <span className="uw-lock-icon" aria-hidden>⌾</span>
          <small>MINI WIKI</small>
          <h1>관리자 전용 아카이브</h1>
          <p>언리쉬드 미니위키는 이 홈의 관리자 계정으로 로그인했을 때만 표시됩니다.</p>
          {!user && <button className="btn btn-dark" onClick={() => router.push('/login')}>관리자 로그인</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="page uw-page">
      <div className="uw-shell panel">
        <header className="uw-head">
          <div>
            <div className="uw-eyebrow"><span>MINI WIKI</span><b>⌾ 관리자 전용</b></div>
            <h1>언리쉬드</h1>
            <p>ULDB 공개 데이터를 이미지 없이 정리한 개인 검색 아카이브</p>
          </div>
          {data && (
            <div className="uw-source-meta">
              <span>{data.source.name}</span>
              <span>{new Date(data.source.collectedAt).toLocaleDateString('ko-KR')} 동기화</span>
            </div>
          )}
        </header>

        <label className="uw-search">
          <span aria-hidden>⌕</span>
          <input value={query} onChange={event => setQuery(event.target.value)}
            placeholder="녹스, 스킬, 효과, 퀘스트를 검색하세요" aria-label="언리쉬드 위키 검색" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기">×</button>}
        </label>

        <div className="uw-category-tabs" role="tablist" aria-label="언리쉬드 분류">
          {(data?.categories ?? (Object.keys(CATEGORY_ICON) as Category[])).map(item => (
            <button key={item} type="button" role="tab" aria-selected={category === item}
              className={category === item ? 'on' : ''} onClick={() => setCategory(item)}>
              <span>{CATEGORY_ICON[item]}</span>{item}
              {data?.categoryCounts[item] !== undefined && <small>{data.categoryCounts[item].toLocaleString()}</small>}
            </button>
          ))}
        </div>

        {error && <div className="uw-error" role="alert">{error}</div>}

        <div className="uw-body">
          <aside className="uw-side panel" aria-label="미니위키 카테고리">
            <div className="uw-side-title"><small>카테고리</small><b>언리쉬드</b></div>
            {(data?.categories ?? (Object.keys(CATEGORY_ICON) as Category[])).map(item => (
              <button key={item} className={category === item ? 'on' : ''} onClick={() => setCategory(item)}>
                <span>{CATEGORY_ICON[item]}</span><b>{item}</b>
                <small>{data?.categoryCounts[item]?.toLocaleString() ?? '—'}</small>
              </button>
            ))}
          </aside>

          <div className="uw-list panel">
            <div className="uw-panel-head">
              <div><small>{category}</small><b>{deferredQuery ? `“${deferredQuery}” 검색 결과` : `${category} 목록`}</b></div>
              <span>{data?.total.toLocaleString() ?? 0}개</span>
            </div>
            <div className={`uw-list-scroll${loading ? ' loading' : ''}`}>
              {!loading && data?.records.length === 0 && <div className="uw-empty">일치하는 항목이 없습니다.</div>}
              {data?.records.map(record => {
                const meta = record.listValues.filter(value => value && value !== record.title).slice(0, 3);
                return (
                  <button key={record.id} className={selectedId === record.id ? 'on' : ''}
                    onClick={() => setSelectedId(record.id)}>
                    <div><b>{record.title}</b><small>{meta.join(' · ')}</small></div>
                    <span>›</span>
                  </button>
                );
              })}
            </div>
            {data && data.pages > 1 && (
              <div className="uw-pager">
                <button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>‹</button>
                <span>{data.page} / {data.pages}</span>
                <button disabled={page >= data.pages} onClick={() => setPage(value => Math.min(data.pages, value + 1))}>›</button>
              </div>
            )}
          </div>

          <article className="uw-detail panel">
            {detailLoading && !selected ? <div className="uw-empty">상세 정보를 불러오는 중…</div> : selected ? (
              <>
                <div className="uw-detail-head">
                  <div><small>{selected.category}</small><h2>{selected.title}</h2></div>
                  <a href={selected.sourceUrl} target="_blank" rel="noreferrer">원문 보기 ↗</a>
                </div>

                {summaryValues.length > 0 && (
                  <section className="uw-facts">
                    <h3>목록 정보</h3>
                    <div>
                      {summaryValues.map((value, index) => {
                        const originalIndex = selected.listValues.indexOf(value);
                        const label = selected.listHeaders[originalIndex];
                        return <p key={`${value}-${index}`}>{label && <small>{label}</small>}<span>{value}</span></p>;
                      })}
                    </div>
                  </section>
                )}

                <section className="uw-original">
                  <h3>상세 정보</h3>
                  {selected.detail.length > 0
                    ? selected.detail.map((block, index) => <pre key={index}>{block}</pre>)
                    : <p className="uw-empty">원본 목록에 별도 상세 내용이 없습니다.</p>}
                </section>

                <footer className="uw-detail-foot">
                  <span>출처</span>
                  <a href={selected.listSourceUrl} target="_blank" rel="noreferrer">Unleashed DataBase (KR) ↗</a>
                  <small>이미지는 수집하지 않았습니다.</small>
                </footer>
              </>
            ) : <div className="uw-empty">왼쪽 목록에서 항목을 선택하세요.</div>}
          </article>
        </div>
      </div>
    </section>
  );
}

