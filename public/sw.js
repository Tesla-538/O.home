self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// 일부 모바일 브라우저의 설치 조건을 위한 서비스 워커. 오프라인 캐시는 일부러 하지 않아
// 홈 수정 내용이 오래 남는 문제를 피한다.
self.addEventListener('fetch', () => {});
