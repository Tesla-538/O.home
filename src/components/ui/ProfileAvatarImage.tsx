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
        // 작은 헤더 썸네일은 얼굴 중심을 위쪽에 두어 큰 프로필과 같은 인상으로 보정한다.
        // 이동량만큼 확대해 아래쪽에 빈 틈이 생기지 않게 한다.
        transform: compact ? 'translateY(-4px) scale(1.32)' : undefined,
        transformOrigin: '50% 50%',
      }}
    />
  );
}
