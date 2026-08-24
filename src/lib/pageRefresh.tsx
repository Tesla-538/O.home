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

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => unknown;
};

/** 상단 메뉴 이동용 짧은 exit → enter 전환. 모션 감소 설정에서는 지연 없이 이동한다. */
export function navigatePage(router: RouterLike, href: string) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { router.push(href); return; }
  const doc = document as TransitionDocument;
  if (doc.startViewTransition) {
    const from = window.location.href;
    void doc.startViewTransition(async () => {
      router.push(href);
      // Next가 새 DOM을 커밋할 때까지 이전 화면 스냅샷을 유지한다.
      await new Promise<void>(resolve => {
        const started = performance.now();
        const check = () => {
          if (window.location.href !== from || performance.now() - started > 1500) {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    });
    return;
  }
  if (navTimer) return;
  document.documentElement.classList.add('route-leaving');
  navTimer = setTimeout(() => {
    navTimer = null;
    router.push(href);
    // pathname이 같고 query만 달라지는 이동도 화면이 숨은 채 남지 않게 한다.
    setTimeout(() => document.documentElement.classList.remove('route-leaving'), 260);
  }, 120);
}

/** children에 key를 걸어 remount — layout에서 <main> 안을 감싼다 */
export function PageFrame({ children }: { children: React.ReactNode }) {
  const [n, setN] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.classList.remove('route-leaving');
  }, [pathname]);
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
  return <React.Fragment key={n}>{children}</React.Fragment>;
}
