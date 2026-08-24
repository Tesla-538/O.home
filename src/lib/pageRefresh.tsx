'use client';
// 같은 메뉴 재클릭 = 그 페이지를 처음 상태로 다시 그리기 (v1.9 사용자 확정)
// 브라우저 새로고침이 아니라 페이지 subtree만 remount — BGM·상단바 등 셸은 그대로 유지된다.
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const EVT = 'ohome-page-refresh';

/** 지금 페이지를 초기 상태로 다시 렌더 (스크롤도 위로) */
export function refreshPage() {
  window.dispatchEvent(new Event(EVT));
}

type RouterLike = { push: (href: string) => void };
let navTimer: ReturnType<typeof setTimeout> | null = null;

/** 현재 페이지를 고정된 시각 복사본으로 남겨 새 페이지와 겹쳐 교차 전환한다. */
function makeRouteGhost() {
  document.querySelectorAll('.route-ghost').forEach(el => el.remove());
  const main = document.getElementById('appMain');
  const frame = main?.querySelector('.route-frame');
  if (!main || !frame) return null;
  const rect = main.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'route-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
  });
  const copy = frame.cloneNode(true) as HTMLElement;
  copy.className = 'route-ghost-copy';
  copy.style.marginTop = `${-main.scrollTop}px`;
  copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  // 외부 플레이어를 복제하면 새 스트림을 요청할 수 있어 시각 복사본에서는 제외한다.
  copy.querySelectorAll('iframe,video,audio').forEach(el => el.remove());
  ghost.appendChild(copy);
  document.body.appendChild(ghost);
  return ghost;
}

/** 기존 화면과 새 화면을 겹쳐 전환한다. 이동 시작 전 빈 대기 구간을 만들지 않는다. */
export function navigatePage(router: RouterLike, href: string) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { router.push(href); return; }
  if (navTimer) return;
  const ghost = makeRouteGhost();
  // 먼저 기다리거나 화면을 지우지 않고 즉시 다음 경로 렌더를 시작한다.
  router.push(href);
  navTimer = setTimeout(() => {
    navTimer = null;
    ghost?.remove();
  }, 760);
}

/** children에 key를 걸어 remount — layout에서 <main> 안을 감싼다 */
export function PageFrame({ children }: { children: React.ReactNode }) {
  const [n, setN] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    const bump = () => {
      setN(v => v + 1);
      // 다시 들어온 느낌 — 스크롤 위로
      requestAnimationFrame(() => {
        document.getElementById('appMain')?.scrollTo({ top: 0 });
        window.scrollTo({ top: 0 });
      });
    };
    window.addEventListener(EVT, bump);
    return () => window.removeEventListener(EVT, bump);
  }, []);
  // pathname을 key에 포함해 경로가 바뀔 때 실제 DOM 래퍼를 새로 만든다.
  // 브라우저의 View Transition 지원이나 effect 타이밍에 기대지 않는 확실한 진입 애니메이션이다.
  return <div className="route-frame" key={`${pathname}:${n}`}>{children}</div>;
}
