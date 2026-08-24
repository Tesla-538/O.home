'use client';

import React from 'react';

/** 모든 프로필 썸네일이 크기와 무관하게 같은 중심·비율로 보이게 한다. */
export function ProfileAvatarImage({ src, compact = false }: { src: string; compact?: boolean }) {
  const image = (
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
      }}
    />
  );

  if (compact) {
    return (
      <span style={{
        position: 'absolute', left: 0, top: 0,
        display: 'block', width: 84, height: 84,
        border: '1px solid var(--line)', borderRadius: '50%', overflow: 'hidden',
        transform: 'scale(0.3333333333)', transformOrigin: '0 0',
      }}>
        {image}
      </span>
    );
  }

  return image;
}
