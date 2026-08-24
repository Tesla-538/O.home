'use client';
// 도토리 등록 (4.15) — 페이지형 등록
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { DotoriItem, DOTORI_SEED } from '@/lib/galleryStore';
import { DotoriForm } from '@/components/trpg/DotoriForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

export default function DotoriNewPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [items, setItems] = useLocalList<DotoriItem>('ohome.dotori.v1', DOTORI_SEED);

  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>WORLD ARCHIVE</PageTitle><p>관리자 전용 페이지</p></div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head"><PageTitle>ADD WORLD</PageTitle><EditableDesc k="dotori-new-desc" def="새 세계관의 기본 정보를 등록합니다" /></div>
      <DotoriForm initial={null}
        onCancel={() => router.push('/dotori')}
        onSave={v => {
          const it: DotoriItem = {
            id: newId(), ...v, link: v.link, ph: 'cool', date: new Date().toISOString(),
          };
          setItems([it, ...items]);
          toast('세계관이 등록되었습니다');
          router.push('/dotori');
        }} />
    </section>
  );
}
