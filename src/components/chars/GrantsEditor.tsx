'use client';
// 회원-캐릭터 권한 편집 (3차, v1.9) — 상대 캐릭터에 회원별 권한 부여:
// 역극 플레이(그 캐릭터로 발화 가능) / 편집까지(캐릭터 편집 포함).
// v1.9 개편: 회원 전체 나열 대신 닉네임·아이디 검색으로 추가하고, 권한이 있는 회원만 목록에 표시.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CharGrant } from '@/lib/charStore';
import { useMembers } from '@/lib/members';
import { KInput } from '@/components/ui/Kit';
import { useConfirmDelete } from '@/components/ui/Modal';

// 드롭다운 예상 높이 — 위/아래 자동 판정용 (maxHeight 180 + 패딩)
const POP_H = 192;

export function GrantsEditor({ value, onChange }: {
  value: CharGrant[];
  onChange: (next: CharGrant[]) => void;
}) {
  const pool = useMembers().filter(p => p.id !== 'admin'); // 관리자는 항상 전권
  const del = useConfirmDelete();   // 권한 해제도 되돌릴 수 없는 동작이라 경고를 거친다
  const [q, setQ] = useState('');
  // 드롭다운은 body 포털(fixed) — 카드 overflow에 잘리지 않고, 아래 공간이 없으면 위로 (v1.9 수정)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const openAt = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const top = window.innerHeight - r.bottom < POP_H + 10
      ? Math.max(8, r.top - POP_H - 4)   // 아래 공간 부족 — 위로
      : r.bottom + 4;
    setPos({ left: r.left, top, width: r.width });
  };
  const open = pos !== null;
  const setOpen = (v: boolean) => (v ? openAt() : setPos(null));
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  const granted = value
    .map(g => ({ ...g, member: pool.find(p => p.id === g.userId) }))
    .filter(g => g.member);
  const matches = pool.filter(p =>
    !value.some(g => g.userId === p.id)
    && (p.nickname.toLowerCase().includes(q.trim().toLowerCase())
      || p.id.toLowerCase().includes(q.trim().toLowerCase())));

  const setLevel = (userId: string, level: 'play' | 'edit') =>
    onChange([...value.filter(g => g.userId !== userId), { userId, level }]);
  const remove = (userId: string) => onChange(value.filter(g => g.userId !== userId));

  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {/* 회원 검색 — 닉네임 또는 아이디 (선택 시 「역극 플레이」로 추가) */}
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <KInput placeholder="닉네임·아이디 검색" value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {open && matches.length > 0 && typeof document !== 'undefined' && createPortal(
          <div style={{
            position: 'fixed', left: pos!.left, top: pos!.top, width: pos!.width, zIndex: 120,
            background: 'var(--panel-solid)', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: 'var(--sh-dd)', padding: 4, maxHeight: 180, overflow: 'auto',
          }}>
            {matches.map(p => (
              <button key={p.id} type="button"
                style={{
                  display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                  padding: '7px 10px', borderRadius: 7, fontSize: 12.5, color: 'var(--ink)',
                }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setLevel(p.id, 'play'); setQ(''); setOpen(false); }}>
                <span>{p.nickname}</span>
                <small style={{ color: 'var(--faint)' }}>{p.id}</small>
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>

      {/* 권한 부여된 회원만 표시 */}
      {granted.map(g => (
        <div key={g.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5 }}>
            {g.member!.nickname} <small style={{ color: 'var(--faint)' }}>{g.userId}</small>
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="mini-seg">
              <button className={g.level === 'play' ? 'on' : ''} onClick={() => setLevel(g.userId, 'play')}>장면 참여</button>
              <button className={g.level === 'edit' ? 'on' : ''} onClick={() => setLevel(g.userId, 'edit')}>편집까지</button>
            </div>
            <span className="fx" style={{ cursor: 'var(--cur-pointer,pointer)' }} data-tip="권한 해제"
              onClick={() => del.ask(`「${g.member!.nickname}」의 권한을 해제하시겠습니까?`,
                () => remove(g.userId),
                '이 회원은 더 이상 이 캐릭터로 장면에 참여하거나 편집할 수 없습니다.')}>✕</span>
          </div>
        </div>
      ))}
      {granted.length === 0 && (
        <p className="hint" style={{ margin: 0 }}>권한을 준 회원이 없습니다 — 위에서 검색해 추가</p>
      )}
      {del.element}
    </div>
  );
}
