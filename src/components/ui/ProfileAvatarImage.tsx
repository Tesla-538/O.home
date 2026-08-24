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
        // 헤더에서는 큰 프로필(84px)과 같은 렌더링 면적을 만든 뒤 28px로 정확히 축소한다.
        // 작은 원에 1px 테두리를 직접 적용해서 사진 비율이 달라지는 문제를 피한다.
        width: compact ? '300%' : '100%',
        height: compact ? '300%' : '100%',
        objectFit: 'cover',
        objectPosition: '50% 50%',
        transform: compact ? 'scale(0.3333333333)' : undefined,
        transformOrigin: '0 0',
      }}
    />
  );
}
