import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tesla558 O.HOME',
    short_name: 'O.HOME',
    description: 'Tesla558의 개인 홈과 플래너',
    start_url: '/',
    display: 'standalone',
    background_color: '#151414',
    theme_color: '#151414',
    lang: 'ko',
    icons: [
      { src: '/ohome-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/ohome-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
