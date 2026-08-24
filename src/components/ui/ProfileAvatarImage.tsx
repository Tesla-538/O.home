'use client';

import React from 'react';

/** 모든 프로필 썸네일이 크기와 무관하게 같은 중심·비율로 보이게 한다. */
export function ProfileAvatarImage({ src, compact = false }: { src: string; compact?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // 확대 없이 원본 비율을 유지하고, 작은 헤더 썸네일만 자르는 기준을 아래로 내려
        // 사진 내용이 원 안에서 더 위쪽에 보이게 한다.
        objectPosition: compact ? '50% calc(70% + 3px)' : '50% 50%',
      }}
    />
  );
}
