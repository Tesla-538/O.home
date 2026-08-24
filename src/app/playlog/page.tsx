'use client';
// 에피소드 아카이브 — 일러스트 중심 카드 목록
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { useMainStore } from '@/lib/mainStore';
import { useCardSort, mergeOrder } from '@/lib/cardSort';
import { SearchBar } from '@/components/ui/Kit';
import { ConfirmModal } from '@/components/ui/Modal';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { BlobImg } from '@/lib/blobStore';

export default function PlaylogPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [records, setRecords, loaded] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  const [q, setQ] = useState('');
  const [delFor, setDelFor] = useState<PlayRecord | null>(null);
  const { editOn } = useMainStore();
  const sorted = editOn ? records : [...records].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const query = q.trim().toLowerCase();
  const shown = sorted.filter(record => !query
    || record.scenario.toLowerCase().includes(query)
    || (record.summary ?? '').toLowerCase().includes(query)
    || (record.scenes ?? []).some(scene => scene.caption.toLowerCase().includes(query)));
  const cardSort = useCardSort(records, next => setRecords(mergeOrder(records, next)), editOn && isAdmin && !query);

  if (!loaded) return <section className="page" />;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>EPISODES</PageTitle>
        <EditableDesc k="playlog-desc" def="장면 일러스트와 설명으로 남기는 이야기 아카이브" />
        <div className="head-actions">
          <SearchBar placeholder="에피소드·장면 설명 검색" onSearch={setQ} />
          {isAdmin && <button className="btn btn-dark" onClick={() => router.push('/playlog/new')}>＋ ADD EPISODE</button>}
        </div>
      </div>

      {shown.length ? (
        <div className="episode-card-grid">
          {shown.map(record => {
            const originalIndex = records.findIndex(x => x.id === record.id);
            const cover = record.scenes?.find(scene => scene.imgId);
            return (
              <article className="panel episode-card" key={record.id}
                {...(editOn && !query ? cardSort(originalIndex) : {})}
                onClick={() => router.push(`/playlog/${record.id}`)}>
                <div className="episode-card-art">
                  {cover ? <BlobImg fileRef={cover.imgId} alt={record.scenario} /> : <div className="episode-card-empty">NO ILLUSTRATION</div>}
                  <span>{record.scenes?.length ?? 0} SCENES</span>
                </div>
                <div className="episode-card-copy">
                  {record.date && <time>{record.date.replace(/-/g, '.')}</time>}
                  <h3>{record.scenario}</h3>
                  <p>{record.summary || record.scenes?.find(scene => scene.caption)?.caption || '장면을 열어 이야기를 확인하세요.'}</p>
                </div>
                {isAdmin && (
                  <div className="episode-card-manage" onClick={e => e.stopPropagation()}>
                    <button onClick={() => router.push(`/playlog/${record.id}/edit`)}>편집</button>
                    <button onClick={() => setDelFor(record)}>삭제</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel episode-list-empty">{query ? '검색 결과가 없습니다' : '등록된 에피소드가 없습니다'}</div>
      )}

      <ConfirmModal open={delFor !== null} title="에피소드를 삭제하시겠습니까?"
        body={`"${delFor?.scenario}" — 삭제하면 복구할 수 없습니다.`}
        onClose={() => setDelFor(null)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setRecords(records.filter(x => x.id !== delFor!.id)); setDelFor(null); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelFor(null) },
        ]} />
    </section>
  );
}
