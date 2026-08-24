'use client';
// TRPG 도토리 (4.15) — 시나리오 위시리스트 · 4열 카드 그리드 · 상태 필터 탭 · 카드에서 상태 전환
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import {
  DotoriItem, DotoriStatus, DOTORI_SEED, DOTORI_STATUS_KEYS, useTrpgSettings, dotoriBadgeStyle,
} from '@/lib/galleryStore';
import { SearchBar } from '@/components/ui/Kit';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { ConfirmModal } from '@/components/ui/Modal';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { useMainStore } from '@/lib/mainStore';
import { useCardSort, mergeOrder } from '@/lib/cardSort';

type Tab = 'all' | DotoriStatus;

export default function DotoriPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [items, setItems, loaded] = useLocalList<DotoriItem>('ohome.dotori.v1', DOTORI_SEED);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [delFor, setDelFor] = useState<DotoriItem | null>(null);
  const [statusFor, setStatusFor] = useState<string | null>(null);   // 상태 전환 팝업이 열린 카드 id
  const [trpgSet] = useTrpgSettings(); // 상태 라벨·뱃지 색 (환경설정 > TRPG)
  const { editOn } = useMainStore();

  // 필터 탭 — 라벨은 환경설정 TRPG 탭에서 수정 (v1.9)
  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: '전체' },
    ...DOTORI_STATUS_KEYS.map(k => ({ key: k as Tab, label: trpgSet.statuses[k].label })),
  ];

  const query = q.trim().toLowerCase();
  const shown = items
    .filter(it => (tab === 'all' ? it.status !== 'done' : it.status === tab)) // 완은 전체에서 숨김 (4.15)
    .filter(it => !query
      || it.name.toLowerCase().includes(query)
      || it.writer.toLowerCase().includes(query)
      || it.tags.some(t => t.toLowerCase().includes(query)));

  const countOf = (t: Tab) =>
    items.filter(it => (t === 'all' ? it.status !== 'done' : it.status === t)).length;

  const setStatus = (id: string, s: DotoriStatus) =>
    setItems(items.map(x => (x.id === id ? { ...x, status: s } : x)));

  // 편집모드 카드 드래그 정렬 (v1.9) — 훅이므로 early return보다 먼저
  const sort = useCardSort(shown, next => setItems(mergeOrder(items, next)), editOn && isAdmin);

  if (!loaded) return <section className="page" />;

  return (
    <section className="page" onClick={() => setStatusFor(null)}>
      <div className="page-head">
        <PageTitle>WORLD ARCHIVE</PageTitle>
        <EditableDesc k="dotori-desc" def="이야기의 무대와 핵심 설정을 세계별로 모아두는 곳" />
      </div>

      {/* 상태 필터 탭 + 검색·ADD — 필터 줄 오른쪽 정렬 (v1.9 사용자 요청) */}
      <div className="toolrow" style={{ marginBottom: 16 }}>
        <div className="tag-row">
          {TABS.map(t => (
            <div key={t.key} className={`tag ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label} <small>{countOf(t.key)}</small>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar placeholder="세계관·장르·키워드 검색" onSearch={setQ} />
          {isAdmin && <button className="btn btn-dark" onClick={() => router.push('/dotori/new')}>＋ ADD</button>}
        </div>
      </div>

      <div className="dt-grid">
        {shown.map((it, i) => (
          <div key={it.id} className="panel dt-card" {...sort(i)}
            style={{ cursor: isAdmin ? 'pointer' : undefined, ...(sort(i) as { style?: React.CSSProperties }).style }}
            onClick={() => { if (isAdmin && !editOn) router.push(`/dotori/${it.id}/edit`); }}>
            <div className="th">
              <CroppedBlobImg fileRef={it.imgId} crop={it.thumbCrop} ph={it.ph} />
              {/* 뱃지 — 공수표·일정 확정만, 이미지 우상단 (4.15) */}
              {(it.status === 'pledge' || it.status === 'confirmed') && (
                <span className="dt-badge" style={dotoriBadgeStyle(trpgSet.statuses[it.status])}>
                  {trpgSet.statuses[it.status].label}
                </span>
              )}
              {isAdmin && (
                <div className="hv-actions dt-actions" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setStatusFor(s => (s === it.id ? null : it.id))}>STATUS</button>
                  <button className="del" onClick={() => setDelFor(it)}>DELETE</button>
                </div>
              )}
              {/* 상태 전환 팝업 — [상태] 클릭 시에만 (기본 UI에는 미노출) */}
              {statusFor === it.id && (
                <div className="dt-status-pop" onClick={e => e.stopPropagation()}>
                  {DOTORI_STATUS_KEYS.map(s => (
                    <button key={s} className={it.status === s ? 'on' : ''}
                      onClick={() => { setStatus(it.id, s); setStatusFor(null); }}>
                      {trpgSet.statuses[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="bd">
              {/* 이름 클릭 = 참고 링크 (새 탭) · 카드 클릭 = 편집 (관리자) */}
              <b className={`nm ${it.link ? 'has-link' : ''}`}
                onClick={e => { if (it.link) { e.stopPropagation(); window.open(it.link, '_blank'); } }}
                data-tip={it.link ? '참고 링크 열기 (새 탭)' : undefined}>
                {it.name}
              </b>
              <small className="meta">
                {[it.writer, it.rule, it.people].filter(Boolean).join(' · ')}
              </small>
              {it.tags.length > 0 && (
                <div className="kw-row" style={{ marginTop: 7 }}>
                  {it.tags.map(t => <span key={t} className="pill">{t}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: 13, color: 'var(--faint)' }}>
            {query ? '검색 결과가 없습니다' : '이 상태의 세계관이 없습니다'}
          </p>
        </div>
      )}

      <ConfirmModal open={delFor !== null} title="세계관을 삭제하시겠습니까?"
        body={`"${delFor?.name}" — 삭제하면 복구할 수 없습니다.`}
        onClose={() => setDelFor(null)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setItems(items.filter(x => x.id !== delFor!.id)); setDelFor(null); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelFor(null) },
        ]} />
    </section>
  );
}
