'use client';
// TRPG 캐릭터 등록 (v1.9 — 페이지형)
import { useAuth } from '@/lib/auth';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { TCharForm } from '@/components/trpg/TCharForm';

export default function TCharNewPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>CHARACTER CODEX</PageTitle><p>관리자 전용 페이지</p></div>
      </section>
    );
  }
  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>CHARACTER CODEX</PageTitle>
        <EditableDesc k="tchars-new-desc" def="캐릭터 등록 — 표정별 이미지와 1:1 썸네일 위치" />
      </div>
      <TCharForm />
    </section>
  );
}
