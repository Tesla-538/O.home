'use client';

import { useEffect } from 'react';

/** Android의 "홈 화면에 추가" 설치 조건을 채우는 무캐시 서비스 워커 등록. */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => { /* 웹 사용은 계속 가능 */ });
    }
  }, []);
  return null;
}
