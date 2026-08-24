'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { KInput } from '@/components/ui/Kit';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { completePasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError('');
    if (password !== confirm) { setError('비밀번호 확인이 일치하지 않습니다.'); return; }
    setSaving(true);
    const result = await completePasswordReset(password);
    setSaving(false);
    if (!result.ok) { setError(result.error ?? '비밀번호를 변경하지 못했습니다.'); return; }
    router.replace('/login?reset=done');
  };

  return (
    <section className="page">
      <div className="panel" style={{ padding: 28, maxWidth: 480, margin: '40px auto 0' }}>
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '.18em', textAlign: 'center',
          margin: '4px 0 6px', color: 'var(--ink)',
        }}>NEW PASSWORD</h1>
        <p className="d" style={{ textAlign: 'center', marginBottom: 18 }}>
          이메일의 재설정 링크로 들어온 뒤 새 비밀번호를 지정합니다
        </p>
        <div style={{ display: 'grid', gap: 9 }}>
          <KInput placeholder="새 비밀번호 (6자 이상)" type="password" value={password}
            onChange={e => setPassword(e.target.value)} />
          <KInput placeholder="새 비밀번호 확인" type="password" value={confirm}
            onChange={e => setConfirm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void save(); }} />
          {error && <p style={{ fontSize: 11.5, color: 'var(--accent)' }}>{error}</p>}
          <button className="btn btn-dark" style={{ justifyContent: 'center', padding: 10 }}
            disabled={saving} onClick={() => void save()}>{saving ? '변경 중…' : '비밀번호 변경'}</button>
        </div>
      </div>
    </section>
  );
}
