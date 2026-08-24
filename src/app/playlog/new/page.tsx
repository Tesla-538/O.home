'use client';
// 플레이기록 추가 (4.16) — 페이지형 등록
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { PlaylogForm } from '@/components/trpg/PlaylogForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

export default function PlaylogNewPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);

  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>EPISODES</PageTitle><p>관리자 전용 페이지</p></div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head"><PageTitle>ADD EPISODE</PageTitle><EditableDesc k="playlog-new-desc" def="장면 일러스트를 첨부하고 짧은 설명을 남깁니다" /></div>
      <PlaylogForm initial={null} records={records}
        onCancel={() => router.push('/playlog')}
        onSave={v => {
          setRecords([...records, { id: newId(), ...v }]);
          toast('기록이 추가되었습니다');
          router.push('/playlog');
        }} />
    </section>
  );
}
