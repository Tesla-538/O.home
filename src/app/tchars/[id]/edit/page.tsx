'use client';
// TRPG 캐릭터 수정 (v1.9 — 페이지형)
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { TCharForm } from '@/components/trpg/TCharForm';

export default function TCharEditPage() {
  const { id } = useParams<{ id: string }>();
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
        <EditableDesc k="tchars-edit-desc" def="캐릭터 수정" />
      </div>
      <TCharForm editId={id} />
    </section>
  );
}
