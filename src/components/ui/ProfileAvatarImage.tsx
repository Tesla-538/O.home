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
        objectPosition: '50% 50%',
        // 28px 헤더 썸네일은 원형 테두리와 축소 보간 때문에 얼굴이 약 1px 아래로 보인다.
        // 살짝 확대하며 위로 당겨 빈 틈 없이 큰 프로필과 시각적 중심을 맞춘다.
        transform: compact ? 'translateY(-1px) scale(1.08)' : undefined,
        transformOrigin: '50% 50%',
      }}
    />
  );
}
