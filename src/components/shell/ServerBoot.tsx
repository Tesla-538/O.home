'use client';
// 서버 연결 부팅 (v2.0) — 앱이 그려지기 전에 런타임 설정(ohome.config.json → localStorage → env)을
// 한 번 읽어 Supabase 클라이언트를 확정한다. 확정 전에는 자식을 그리지 않아
// "로컬 모드로 한 번 그렸다가 서버 모드로 다시 그리는" 깜빡임을 막는다.
import React, { useEffect, useState } from 'react';
import { initSupabase } from '@/lib/supabase';
import { primeSettings } from '@/lib/settingStore';

type IntroPhase = 'checking' | 'hidden' | 'holding' | 'leaving';
const INTRO_SESSION_KEY = 'ohome.home-intro.v2';

function HomeIntro({ ready, leaving }: { ready: boolean; leaving: boolean }) {
  return (
    <div className={`boot-wait${ready ? ' is-ready' : ''}${leaving ? ' is-leaving' : ''}`}
      role="status" aria-live="polite" aria-label={ready ? '홈페이지 준비 완료' : '홈페이지 불러오는 중'}>
      <div className="boot-aura" aria-hidden />
      <div className="boot-glass">
        <div className="boot-kicker"><span>01</span><span>PERSONAL ARCHIVE</span></div>
        <div className="boot-brand" aria-hidden>O.HOME</div>
        <p>YOUR ILLUSTRATED ARCHIVE</p>
        <div className="boot-progress" role="progressbar" aria-label="홈페이지 준비"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={ready ? 100 : 18}>
          <i />
        </div>
        <div className="boot-status">
          <span>{ready ? 'ARCHIVE READY' : 'LOADING ARCHIVE'}</span>
          <span>{ready ? '100' : '···'}</span>
        </div>
      </div>
    </div>
  );
}

export function ServerBoot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState<IntroPhase>('checking');
  // 대기가 길어질 때만 표시 — 빠르게 끝나는 경우 스피너가 깜빡이는 게 더 거슬린다
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let alive = true;
    let showIntro = false;
    try {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const preview = process.env.NODE_ENV === 'development'
        && new URLSearchParams(window.location.search).has('introPreview');
      showIntro = window.location.pathname === '/' && !reduced
        && (preview || sessionStorage.getItem(INTRO_SESSION_KEY) !== '1');
      if (showIntro) sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch { /* 저장소가 막히면 일반 부팅으로 계속 */ }
    setIntro(showIntro ? 'holding' : 'hidden');
    const t = setTimeout(() => { if (alive) setSlow(true); }, 400);
    // 백엔드 확정 → 사이트 설정(테마·메뉴·폰트…)을 한 번에 받아 캐시 → 그 다음에 화면을 그린다.
    // 각 스토어가 렌더 중 동기적으로 설정을 읽기 때문에 순서가 중요하다.
    initSupabase()
      .then(() => primeSettings())
      .finally(() => { if (alive) { clearTimeout(t); setReady(true); } });
    return () => { alive = false; clearTimeout(t); };
  }, []);

  // 데이터가 준비되면 잠시 완성 상태를 보여 준 뒤 유리판이 녹듯 빠지고 홈을 선명하게 드러낸다.
  useEffect(() => {
    if (!ready || intro !== 'holding') return;
    const t = window.setTimeout(() => setIntro('leaving'), 820);
    return () => window.clearTimeout(t);
  }, [ready, intro]);
  useEffect(() => {
    if (intro !== 'leaving') return;
    const t = window.setTimeout(() => setIntro('hidden'), 880);
    return () => window.clearTimeout(t);
  }, [intro]);

  // 인트로 중에는 뒤의 일러스트를 은은하게 보여 주고, 퇴장과 함께 홈 셸을 선명하게 만든다.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ohome-intro-active', intro === 'holding' || intro === 'leaving');
    root.classList.toggle('ohome-intro-revealing', intro === 'leaving');
    return () => {
      root.classList.remove('ohome-intro-active', 'ohome-intro-revealing');
    };
  }, [intro]);

  if (intro === 'checking') return null;
  // 홈 인트로를 쓰지 않는 화면은 기존처럼 느린 연결에서만 작은 대기 표시를 보인다.
  if (!ready && intro === 'hidden') return slow ? <div className="boot-compact"><i /></div> : null;
  if (!ready) return <HomeIntro ready={false} leaving={false} />;
  return <>{children}{intro !== 'hidden' && <HomeIntro ready leaving={intro === 'leaving'} />}</>;
}
