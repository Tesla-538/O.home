'use client';
// 역극 (4.9) — 실시간 채팅형. 방 개설(자관 기반/자유) · 참여자에게만 존재 노출 ·
// 캐릭터 선택 발화(테마색 말풍선) · 지문(/desc) · 메시지 수정/삭제 · 완결/공개 전환 · HTML 내보내기
// ※ 실시간 송수신·입력 중 표시·참여자 전원 동의는 Supabase Realtime 연동 시 활성화 (현재 localStorage)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { RpRoom, RpMessage, RP_SEED, hexRgb, rpLastDate, rpHasNew } from '@/lib/rpStore';
import { Character, CHAR_SEED, Relation, REL_SEED, charGrant } from '@/lib/charStore';
import { Modal, ConfirmModal, useConfirmDelete } from '@/components/ui/Modal';
import { KInput, KTextarea, KSelect, KCheck } from '@/components/ui/Kit';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { useToast } from '@/components/ui/Toast';

/** 캐릭터 얼굴 칩 (썸네일 or 데모 플레이스홀더) */
function Face({ ch, className }: { ch?: Character; className: string }) {
  return (
    <div className={`${className} ${!ch?.thumbId ? `ph ${ch?.thumbClass ?? ''}` : ''}`}>
      {ch?.thumbId && <CroppedBlobImg fileRef={ch.thumbId} crop={ch.thumbCrop} />}
    </div>
  );
}

const fmtHM = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

import { useMembers } from '@/lib/members';
import { pushNotif } from '@/lib/notifStore';

export default function RpPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const del = useConfirmDelete();
  const [rooms, setRooms, loaded] = useLocalList<RpRoom>('ohome.rp.v1', RP_SEED);
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [selId, setSelId] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<'all' | 'ongoing' | 'done'>('ongoing'); // 우측 상태 필터 — 진행중이 기본
  // 모바일 (v1.9 사용자 확정) — 방 목록은 위에 접힌 바로, 입력창 포커스 중엔 역극 영역만 표시
  const [mListOpen, setMListOpen] = useState(false);
  const [mFocus, setMFocus] = useState(false);

  // 참여자에게만 존재 노출 (확정 — 관리자도 비참여 방은 보지 않음)
  const allMine = useMemo(() => (user
    ? rooms.filter(r => r.memberIds.includes(user.id))
      .sort((a, b) => rpLastDate(b).localeCompare(rpLastDate(a)))
    : []), [rooms, user]);
  const myRooms = useMemo(() => allMine.filter(r => fStatus === 'all' || r.status === fStatus), [allMine, fStatus]);
  const sel = myRooms.find(r => r.id === selId) ?? myRooms[0];
  const cntS = (s: 'all' | 'ongoing' | 'done') =>
    allMine.filter(r => s === 'all' || r.status === s).length;

  // 발화자 선택 — 관리자는 기반 자관 멤버 전부(+자유 개설이면 자캐 전부),
  // 회원은 권한(grants — 역극 플레이/편집)이 부여된 캐릭터만 (3차 회원-캐릭터 연결, v1.9)
  const rel = rels.find(r => r.id === sel?.relId);
  const speakChars = useMemo(() => {
    if (rel) {
      const members = rel.members.map(m => chars.find(c => c.id === m.charId)).filter(Boolean) as Character[];
      return isAdmin ? members : members.filter(c => !!charGrant(c, user?.id));
    }
    return isAdmin ? chars.filter(c => c.own) : chars.filter(c => !!charGrant(c, user?.id));
  }, [rel, chars, isAdmin, user?.id]);

  const [speaker, setSpeaker] = useState<string>('');   // charId | 'player' | 'desc'
  const [pickOpen, setPickOpen] = useState(false);
  useEffect(() => { setSpeaker(speakChars[0]?.id ?? 'player'); setPickOpen(false); }, [sel?.id, speakChars]);

  // 입장 시 읽음 처리 (N 뱃지 해제)
  useEffect(() => {
    if (!sel || !user) return;
    if (rpHasNew(sel, user.id) || !sel.lastRead[user.id]) {
      setRooms(rooms.map(r => r.id === sel.id
        ? { ...r, lastRead: { ...r.lastRead, [user.id]: new Date().toISOString() } } : r));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id, user?.id]);

  // 새 메시지 → 맨 아래로
  const msgsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sel?.id, sel?.messages.length]);

  const [text, setText] = useState('');
  const send = () => {
    if (!sel || !user) return;
    let t = text.trim();
    if (!t) return;
    let kind: RpMessage['kind'] = speaker === 'desc' ? 'desc' : speaker === 'player' ? 'player' : 'char';
    if (t.startsWith('/desc ')) { kind = 'desc'; t = t.slice(6).trim(); } // /desc 명령 (v1.8)
    if (!t) return;
    const m: RpMessage = {
      id: newId(), kind, charId: kind === 'char' ? speaker : undefined,
      // 발화 당시 소유 기록 — 캐릭터가 삭제돼도 재연동 시 어느 리스트에서 고를지 판별 (v1.9)
      charOwn: kind === 'char' ? chars.find(c => c.id === speaker)?.own : undefined,
      authorId: user.id, text: t, date: new Date().toISOString(),
    };
    setRooms(rooms.map(r => r.id === sel.id
      ? { ...r, messages: [...r.messages, m], lastRead: { ...r.lastRead, [user.id]: m.date } } : r));
    setText('');
    // 알림 (4.13) — 나를 제외한 참여자에게, 방 단위로 묶어서 (디스코드 DM은 봇 연동 시)
    sel.memberIds.filter(id => id !== user.id).forEach(id =>
      pushNotif({
        type: 'rp', toUserId: id, href: '/rp', dedupeKey: `rp:${sel.id}`,
        title: `장면 「${sel.title}」 새 메시지`,
        body: t.slice(0, 60),
      }));
  };

  // 메시지 수정(본인) — 모달
  const [editMsg, setEditMsg] = useState<RpMessage | null>(null);
  const [editText, setEditText] = useState('');
  const saveMsg = () => {
    if (!sel || !editMsg) return;
    if (!editText.trim()) { toast('내용을 입력해 주세요'); return; }
    setRooms(rooms.map(r => r.id === sel.id
      ? { ...r, messages: r.messages.map(m => m.id === editMsg.id ? { ...m, text: editText.trim() } : m) } : r));
    setEditMsg(null);
  };
  const removeMsg = (m: RpMessage) => {
    if (!sel) return;
    del.ask('이 메시지를 삭제하시겠습니까?', () =>
      setRooms(rooms.map(r => r.id === sel.id
        ? { ...r, messages: r.messages.filter(x => x.id !== m.id) } : r)));
  };

  // 방 개설 모달
  const [newOpen, setNewOpen] = useState(false);
  const [nTitle, setNTitle] = useState('');
  const [nRel, setNRel] = useState('none');
  const [nMembers, setNMembers] = useState<string[]>([]);
  const pool = useMembers();
  const createRoom = () => {
    if (!user) return;
    if (!nTitle.trim()) { toast('장면 제목을 입력해 주세요'); return; }
    const members = Array.from(new Set([user.id, ...nMembers]));
    const room: RpRoom = {
      id: newId(), title: nTitle.trim(), relId: nRel === 'none' ? undefined : nRel,
      memberIds: members, status: 'ongoing', isPublic: false,
      createdBy: user.id, created: new Date().toISOString(), lastRead: {}, messages: [],
    };
    setRooms([room, ...rooms]);
    setSelId(room.id);
    setNewOpen(false);
    setNTitle(''); setNRel('none'); setNMembers([]);
  };

  const canManage = sel && user && (sel.createdBy === user.id || isAdmin);
  const [endAsk, setEndAsk] = useState(false); // 완결 확인 — 삭제가 아니므로 전용 모달

  // 연결이 해제된(삭제된) 캐릭터 — 발화가 남아 있으면 다른 캐릭터로 재연동 (v1.9)
  // own은 화면 표시 규칙과 동일하게 !!charOwn 정규화 — 기록이 없으면 왼쪽(상대) 취급 (v1.9 버그 수정:
  // 왼쪽에 보이는 삭제 캐릭터의 RELINK 후보로 내 캐릭터 리스트가 뜨던 문제)
  const brokenChars = useMemo(() => {
    if (!sel) return [] as { charId: string; own: boolean }[];
    const map = new Map<string, boolean>();
    for (const m of sel.messages) {
      if (m.kind === 'char' && m.charId && !chars.some(c => c.id === m.charId) && !map.has(m.charId)) {
        map.set(m.charId, !!m.charOwn);
      }
    }
    return [...map.entries()].map(([charId, own]) => ({ charId, own }));
  }, [sel, chars]);
  const [relinkOpen, setRelinkOpen] = useState(false);
  const [relinkSel, setRelinkSel] = useState<Record<string, string>>({});
  // 대체 후보 — 반드시 같은 영역(own)의 캐릭터만 (v1.9 버그 수정, 사용자 발견)
  // 자관 멤버 목록에는 내 캐릭터도 함께 들어 있어서, 상대 영역 후보에 내 캐릭터가 떴고
  // 그걸 고르면 양쪽 대사가 한 캐릭터로 합쳐지던 문제 → 소유 구분으로 먼저 거른다.
  const relinkCands = (own: boolean): Character[] => {
    const sameSide = (c: Character) => !!c.own === own;
    const relList = rel
      ? (rel.members.map(mm => chars.find(c => c.id === mm.charId)).filter(Boolean) as Character[]).filter(sameSide)
      : [];
    return relList.length ? relList : chars.filter(sameSide);
  };
  // 이미 이 방에서 발화 중인 캐릭터 — 고르면 대사가 합쳐지므로 표시해 준다 (v1.9)
  const speakingIds = useMemo(() => new Set(
    (sel?.messages ?? []).filter(m => m.kind === 'char' && m.charId).map(m => m.charId as string)), [sel]);
  const applyRelink = () => {
    if (!sel) return;
    const picked = Object.entries(relinkSel).filter(([, v]) => v);
    if (picked.length === 0) { setRelinkOpen(false); return; }
    setRooms(rooms.map(r => r.id === sel.id ? {
      ...r,
      messages: r.messages.map(m => {
        const nid = m.charId ? relinkSel[m.charId] : undefined;
        if (!nid) return m;
        return { ...m, charId: nid, charOwn: chars.find(c => c.id === nid)?.own };
      }),
    } : r));
    setRelinkOpen(false);
    setRelinkSel({});
    toast('캐릭터를 다시 연결했습니다');
  };
  const patchRoom = (p: Partial<RpRoom>) => {
    if (!sel) return;
    setRooms(rooms.map(r => r.id === sel.id ? { ...r, ...p } : r));
  };
  const removeRoom = () => {
    if (!sel) return;
    del.ask(`장면 「${sel.title}」을 삭제하시겠습니까?`, () => {
      setRooms(rooms.filter(r => r.id !== sel.id));
      setSelId(null);
    }, `대화 ${sel.messages.length}개도 함께 삭제됩니다.`);
  };

  // 완결 로그 HTML 내보내기 (4.9 — TRPG 백업에 붙일 수 있는 형태)
  const exportHtml = () => {
    if (!sel) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
    const rows = sel.messages.map(m => {
      if (m.kind === 'desc') {
        return `<p style="text-align:center;color:#4a505a;line-height:1.8;margin:14px 0">${esc(m.text)}</p>`;
      }
      const ch = chars.find(c => c.id === m.charId);
      const name = m.kind === 'player' ? '플레이어' : (ch?.name ?? '');
      const color = ch?.color ?? '#5d636d';
      return `<div style="margin:10px 0;line-height:1.7"><b style="color:${color};letter-spacing:.05em">${esc(name)}</b> — ${esc(m.text)}</div>`;
    }).join('\n');
    const html = `<div style="font-family:sans-serif;max-width:720px;margin:0 auto">
<h2 style="letter-spacing:.08em">${esc(sel.title)}</h2>
${rows}
</div>`;
    const u = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = u; a.download = `${sel.title}.html`;
    a.click();
    URL.revokeObjectURL(u);
  };

  if (!loaded) return <section className="page" />;

  if (!user) {
    return (
      <section className="page">
        {/* 비로그인 안내 — 관리자가 문구 수정 가능 (v1.9), 헤더 표시 옵션에도 항상 표시 */}
        <div className="page-head"><PageTitle>SCENE ARCHIVE</PageTitle>
          <EditableDesc k="rp-gate-desc" def="장면보관함은 로그인한 참여자에게만 표시됩니다" always /></div>
      </section>
    );
  }

  const relName = (id?: string) => rels.find(r => r.id === id)?.name;
  // 표시는 캐릭터 기준 (프로토타입 — "ALLOW 기반 · ALONE · WOOD") · 회원 계정은 접근 권한용일 뿐 노출 안 함
  const relCharNames = (relId?: string) => {
    const rel = rels.find(r => r.id === relId);
    if (!rel) return [];
    return rel.members
      .map(m => chars.find(c => c.id === m.charId)?.name)
      .filter(Boolean) as string[];
  };
  const roomSub = (r: RpRoom) => {
    const names = relCharNames(r.relId);
    const parts = [
      relName(r.relId) ? `${relName(r.relId)} 기반` : '자유 개설',
      ...(names.length ? names : [`${r.memberIds.length}인`]),
      r.status === 'done' ? (r.isPublic ? '완결 · 공개 전환됨' : '완결') : '진행중',
    ];
    return parts.join(' · ');
  };

  const speakerLabel = speaker === 'desc' ? '지문 (DESC)' : speaker === 'player'
    ? user.nickname : (chars.find(c => c.id === speaker)?.name ?? '');
  const speakerChar = chars.find(c => c.id === speaker);

  return (
    <section className={`page ${mFocus ? 'rp-focus' : ''}`}>
      <div className="page-head">
        <PageTitle>SCENE ARCHIVE</PageTitle>
        <EditableDesc k="rp-desc" def="대사와 지문을 캐릭터별로 쌓아 장면 초안을 만드는 공간" />
      </div>

      <div className={`rp-layout ${mListOpen ? 'mopen' : ''}`}>
        {/* 모바일 전용 접힘 바 — 탭하면 방 목록·상태 필터가 펼쳐짐 (v1.9) */}
        <button type="button" className="rp-mfold" onClick={() => setMListOpen(o => !o)}>
          <b>{sel ? sel.title : '장면 목록'}</b>
          <small>MY SCENES {myRooms.length} {mListOpen ? '▴' : '▾'}</small>
        </button>
        {/* 방 목록 — 내 참여 방만 · 헤더 고정, 리스트만 내부 스크롤 */}
        <div className="panel rp-rooms">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 12px', flexShrink: 0 }}>
            <b style={{ fontSize: 12, letterSpacing: '.1em', color: 'var(--sub)' }}>MY SCENES</b>
            <button className="btn btn-dark" style={{ padding: '0 12px', height: 30, fontSize: 11 }}
              onClick={() => setNewOpen(true)}>＋ NEW SCENE</button>
          </div>
          <div className="rp-rooms-list">
            {myRooms.map(r => (
              <div key={r.id} className={`rp-room ${sel?.id === r.id ? 'on' : ''}`}
                onClick={() => { setSelId(r.id); setMListOpen(false); }}>
                <b>{r.title} {rpHasNew(r, user.id) && sel?.id !== r.id && <span className="new">N</span>}</b>
                <small>{roomSub(r)}</small>
              </div>
            ))}
            {myRooms.length === 0 && (
              <p className="hint" style={{ padding: '10px 6px 0' }}>
                {fStatus === 'all' ? '참여 중인 장면이 없습니다' : '이 상태의 장면이 없습니다'}
              </p>
            )}
          </div>
        </div>

        {/* 채팅 */}
        <div className="panel rp-chat">
          {sel ? (
            <>
              <div className="rp-head">
                <div>
                  <b>{sel.title}</b>
                  <small>
                    {relName(sel.relId) ? `${relName(sel.relId)} 기반 · ` : '자유 개설 · '}
                    {relCharNames(sel.relId).length
                      ? relCharNames(sel.relId).join(' · ')
                      : `${sel.memberIds.length}인`}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="pill">{sel.status === 'done' ? (sel.isPublic ? '완결 · 공개' : '완결') : '진행중'}</span>
                  {/* 삭제된 캐릭터가 남아 있으면 재연동 (v1.9) */}
                  {canManage && brokenChars.length > 0 && (
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5, color: 'var(--accent)' }}
                      onClick={() => setRelinkOpen(true)}>RELINK</button>
                  )}
                  {canManage && sel.status === 'ongoing' && (
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                      onClick={() => setEndAsk(true)}>END</button>
                  )}
                  {canManage && sel.status === 'done' && (
                    <>
                      {/* 완결 취소 — 다시 진행중으로 (공개 상태였다면 비공개로 복귀) */}
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                        onClick={() => patchRoom({ status: 'ongoing', isPublic: false })}>REOPEN</button>
                      {/* 공개 전환 — 참여자 전원 동의 흐름은 Supabase 연동 시 (현재는 개설자/관리자 전환) */}
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                        onClick={() => patchRoom({ isPublic: !sel.isPublic })}>
                        {sel.isPublic ? 'UNPUBLISH' : 'PUBLISH'}
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                        onClick={exportHtml}>EXPORT</button>
                    </>
                  )}
                  {canManage && (
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                      onClick={removeRoom}>DELETE</button>
                  )}
                </div>
              </div>

              <div className="rp-msgs" ref={msgsRef}>
                {sel.messages.map(m => {
                  const mine = m.authorId === user.id;
                  if (m.kind === 'desc') {
                    return (
                      <div key={m.id} className="msg-desc">
                        {m.text}
                        {mine && (
                          <span className="m-act">
                            <button onClick={() => { setEditMsg(m); setEditText(m.text); }}>EDIT</button>
                            <button onClick={() => removeMsg(m)}>DEL</button>
                          </span>
                        )}
                      </div>
                    );
                  }
                  const ch = chars.find(c => c.id === m.charId);
                  const name = m.kind === 'player'
                    ? (pool.find(p => p.id === m.authorId)?.nickname ?? m.authorId)
                    : (ch?.name ?? '');
                  // 영역 고정 (사용자 확정): 내 캐릭터(캐릭터 메뉴에 등록된 자캐, own)는 무조건 오른쪽,
                  // 상대 캐릭터는 무조건 왼쪽 — 누가 발화했는지와 무관. 플레이어 발화만 작성자 기준.
                  // 삭제된 캐릭터는 발화 당시 기록(charOwn)으로 영역 유지.
                  const rightSide = m.kind === 'player' ? mine : (ch ? !!ch.own : !!m.charOwn);
                  return (
                    <div key={m.id} className={`msg ${rightSide ? 'me' : ''}`} style={{ ['--cc' as string]: hexRgb(ch?.color) }}>
                      <Face ch={ch} className="face" />
                      <div>
                        <div className="who">{name}</div>
                        <div className="bub">{m.text}</div>
                        <div style={{ fontSize: 9, color: 'var(--faint)', marginTop: 3 }}>{fmtHM(m.date)}</div>
                      </div>
                      {mine && (
                        <span className="m-act">
                          <button onClick={() => { setEditMsg(m); setEditText(m.text); }}>EDIT</button>
                          <button onClick={() => removeMsg(m)}>DEL</button>
                        </span>
                      )}
                    </div>
                  );
                })}
                {sel.messages.length === 0 && (
                  <p className="hint" style={{ textAlign: 'center', marginTop: 30 }}>첫 메시지를 남겨보세요</p>
                )}
              </div>

              {sel.status === 'ongoing' && (
                <div className="rp-input">
                  {/* 발화자 선택 — 캐릭터 / 플레이어 / 지문 (v1.8) */}
                  <div className="char-pick" onClick={() => setPickOpen(o => !o)}>
                    {speaker === 'desc'
                      ? <div className="f" style={{ display: 'grid', placeItems: 'center', fontSize: 13, color: 'var(--sub)' }}>❝</div>
                      : speaker === 'player'
                        ? <div className="f" style={{ display: 'grid', placeItems: 'center', fontSize: 13, color: 'var(--sub)' }}>◉</div>
                        : <Face ch={speakerChar} className="f" />}
                    <small>{speakerLabel} ▾</small>
                    {pickOpen && (
                      <div className="rp-pick-pop" onClick={e => e.stopPropagation()}>
                        {speakChars.map(c => (
                          <button key={c.id} onClick={() => { setSpeaker(c.id); setPickOpen(false); }}>
                            <Face ch={c} className="f" />{c.name}
                          </button>
                        ))}
                        <button onClick={() => { setSpeaker('player'); setPickOpen(false); }}>
                          <span className="f" style={{ display: 'grid', placeItems: 'center', color: 'var(--sub)' }}>◉</span>
                          {user.nickname}
                        </button>
                        <button onClick={() => { setSpeaker('desc'); setPickOpen(false); }}>
                          <span className="f" style={{ display: 'grid', placeItems: 'center', color: 'var(--sub)' }}>❝</span>
                          지문 (DESC)
                        </button>
                      </div>
                    )}
                  </div>
                  {/* 플레이스홀더 없음 (v1.8) · Enter 전송 / Shift+Enter 줄바꿈 · /desc 명령 지원
                      포커스 중엔 모바일에서 역극 영역만 표시 (v1.9 — blur는 SEND 클릭이 씹히지 않게 지연) */}
                  <KTextarea style={{ minHeight: 44 }} value={text} onChange={e => setText(e.target.value)}
                    onFocus={() => setMFocus(true)}
                    onBlur={() => setTimeout(() => setMFocus(false), 180)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                  <button className="btn btn-dark" onClick={send}>SEND</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', flex: 1 }}>
              <p className="hint">장면을 만들면 여기에 대화와 지문이 표시됩니다</p>
            </div>
          )}
        </div>

        {/* 우측 상태 필터 — 진행중/완결 따로 보기 */}
        <div className="panel tagside" style={{ padding: 16, alignSelf: 'start' }}>
          <h4>상태</h4>
          {/* 진행중이 기본 — 진행중 / 전체 / 완결 순 (사용자 확정) */}
          <div className={`tag ${fStatus === 'ongoing' ? 'on' : ''}`} onClick={() => setFStatus('ongoing')}>
            진행중 <small>{cntS('ongoing')}</small>
          </div>
          <div className={`tag ${fStatus === 'all' ? 'on' : ''}`} onClick={() => setFStatus('all')}>
            전체 <small>{cntS('all')}</small>
          </div>
          <div className={`tag ${fStatus === 'done' ? 'on' : ''}`} onClick={() => setFStatus('done')}>
            완결 <small>{cntS('done')}</small>
          </div>
        </div>
      </div>

      {/* 방 개설 — 제목 + 기반 자관(선택) + 참여 회원 (4.9) */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} small title="새 장면 만들기"
        desc="함께 쓰는 장면은 지정한 참여자에게만 보입니다" dirty
        actions={<>
          <button className="btn btn-ghost" onClick={() => setNewOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={createRoom}>ADD</button>
        </>}>
        <div style={{ display: 'grid', gap: 11 }}>
          <div>
            <label className="k-label" style={{ marginBottom: 5 }}>Title</label>
            <KInput value={nTitle} onChange={e => setNTitle(e.target.value)} />
          </div>
          <div>
            <label className="k-label" style={{ marginBottom: 5 }}>기반 자관 (선택)</label>
            <KSelect value={nRel} onChange={setNRel}
              options={[{ value: 'none', label: '자유 개설 (자관 없음)' }, ...rels.map(r => ({ value: r.id, label: r.name }))]} />
          </div>
          <div>
            <label className="k-label" style={{ marginBottom: 7 }}>참여 회원</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {pool.filter(p => p.id !== user.id).map(p => (
                <KCheck key={p.id} label={p.nickname}
                  checked={nMembers.includes(p.id)}
                  onChange={v => setNMembers(ms => v ? [...ms, p.id] : ms.filter(x => x !== p.id))} />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 메시지 수정 (본인) */}
      <Modal open={editMsg !== null} onClose={() => setEditMsg(null)} small title="메시지 수정" dirty
        actions={<>
          <button className="btn btn-ghost" onClick={() => setEditMsg(null)}>CANCEL</button>
          <button className="btn btn-dark" onClick={saveMsg}>SAVE</button>
        </>}>
        <KTextarea style={{ minHeight: 100 }} value={editText} onChange={e => setEditText(e.target.value)} />
      </Modal>
      {/* 캐릭터 다시 연결 — 삭제된 캐릭터의 발화를 다른 캐릭터로 (v1.9) */}
      <Modal open={relinkOpen} onClose={() => setRelinkOpen(false)} small title="캐릭터 다시 연결"
        desc="연결이 해제된 캐릭터의 발화를 다른 캐릭터로 옮깁니다 — 같은 영역(왼쪽/오른쪽)의 캐릭터만 선택할 수 있습니다" dirty
        actions={<>
          <button className="btn btn-ghost" onClick={() => setRelinkOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={applyRelink}>APPLY</button>
        </>}>
        <div style={{ display: 'grid', gap: 12 }}>
          {brokenChars.map(b => (
            <div key={b.charId}>
              <label className="k-label" style={{ marginBottom: 5 }}>
                삭제된 캐릭터 — {b.own ? '내 캐릭터 영역 (내 캐릭터만 선택 가능)' : '상대 영역 (상대 캐릭터만 선택 가능)'}
              </label>
              <KSelect value={relinkSel[b.charId] ?? ''} onChange={v => setRelinkSel(s => ({ ...s, [b.charId]: v }))}
                options={[
                  { value: '', label: '선택 안 함' },
                  // 이미 발화 중인 캐릭터를 고르면 대사가 합쳐지므로 표시 (v1.9 사용자 피드백)
                  ...relinkCands(b.own).map(c => ({
                    value: c.id,
                    label: speakingIds.has(c.id) ? `${c.name} — 이미 발화 중 (대사가 합쳐집니다)` : c.name,
                  })),
                ]} />
            </div>
          ))}
        </div>
      </Modal>

      {/* 완결 확인 (삭제 아님 — END/CANCEL) */}
      <ConfirmModal open={endAsk} title="장면을 완성 처리하시겠습니까?"
        body="완성 후에는 공개 전환과 원고 내보내기를 사용할 수 있습니다."
        onClose={() => setEndAsk(false)}
        buttons={[
          { label: 'END', kind: 'dark', onClick: () => { patchRoom({ status: 'done' }); setEndAsk(false); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setEndAsk(false) },
        ]} />
      {del.element}
    </section>
  );
}
