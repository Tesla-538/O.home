'use client';
// 백엔드 어댑터 (v2.0) — Supabase / Firebase 두 버전을 같은 인터페이스로 쓴다.
//
// 화면 코드는 이 파일의 타입만 알고, 어떤 서비스에 붙었는지는 모른다.
// 새 백엔드를 추가하려면 이 인터페이스만 구현하면 된다.

export type BackendKind = 'supabase' | 'firebase';

/** 설치 화면에서 입력받는 연결 정보 — 모두 공개돼도 되는 값이다(보안은 서버 규칙이 담당) */
export type BackendConfig =
  | { kind: 'supabase'; url: string; anonKey: string }
  | {
      kind: 'firebase';
      apiKey: string; authDomain: string; projectId: string;
      storageBucket: string; appId: string; messagingSenderId?: string;
      /** Firestore 데이터베이스 ID — 비우면 (default). 콘솔에서 다른 이름으로 만들었을 때만 필요 */
      databaseId?: string;
    };

/** 로그인 사용자 */
export interface BackendUser {
  id: string;
  nickname: string;
  role: 'admin' | 'member';
  email?: string;
  avatarUrl?: string;
  avatarColor?: string;
}

/** 연결·규칙 점검 결과 (설치 화면의 [연결 확인]) */
export interface BackendCheck {
  ok: boolean;
  reachable: boolean;   // 프로젝트에 닿음
  schema: boolean;      // 테이블/규칙 준비됨
  hasAdmin: boolean;    // 관리자 계정 있음
  message: string;
}

export interface ListItem { id: string; [k: string]: unknown }

export interface Backend {
  kind: BackendKind;

  /* ---- 연결 점검 ---- */
  check(): Promise<BackendCheck>;

  /* ---- 인증 ---- */
  currentUser(): Promise<BackendUser | null>;
  /** 현재 로그인 세션의 서버 API 전달용 액세스 토큰 */
  accessToken(): Promise<string | null>;
  onAuthChange(cb: (u: BackendUser | null) => void): () => void;
  signIn(id: string, password: string): Promise<{ ok: boolean; error?: string }>;
  signUp(id: string, password: string, nickname: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<{ ok: boolean; error?: string }>;
  updatePassword(password: string): Promise<{ ok: boolean; error?: string }>;
  updateProfile(patch: { nickname?: string; avatarUrl?: string | null; avatarColor?: string | null }): Promise<{ ok: boolean; error?: string }>;
  /** 첫 계정을 이 홈의 관리자로 등록 (관리자가 아직 없을 때만) */
  claimOwner(): Promise<{ ok: boolean; error?: string }>;
  /** 가입 회원 목록 — 역극 참여자 선택·회원 관리 화면용 */
  listMembers(): Promise<{ id: string; nickname: string; role: 'admin' | 'member'; email?: string }[]>;

  /* ---- 목록(콘텐츠) ---- */
  fetchList<T extends ListItem>(coll: string): Promise<T[]>;
  syncList<T extends ListItem>(coll: string, prev: T[], next: T[], uid: string | null): Promise<void>;
  subscribe(coll: string, onChange: () => void): () => void;

  /* ---- 설정(key/value) ---- */
  fetchSetting<T>(key: string): Promise<T | null>;
  saveSetting(key: string, value: unknown): Promise<void>;
  fetchAllSettings(): Promise<Record<string, unknown>>;

  /* ---- 이미지·파일 ---- */
  uploadFile(blob: Blob, ext: string): Promise<string>;   // → 공개 URL
  /** 저장소에 있는 파일 전부 — 어디서도 참조하지 않는 파일을 찾아 지우는 데 쓴다.
   *  글을 지워도 이미지는 저장소에 남기 때문에(참조가 다른 곳에 남아 있을 수 있어 자동 삭제는 위험)
   *  관리자가 환경설정에서 직접 확인하고 정리한다. */
  listFiles(): Promise<{ ref: string; size: number }[]>;
  deleteFile(ref: string): Promise<void>;

  /** 회원 프로필(닉네임·아바타) 삭제 — 홈의 회원 목록에서 사라진다.
   *  **로그인 계정 자체는 지울 수 없다.** Firebase Authentication / Supabase Auth의 계정 삭제는
   *  관리자 키가 있어야 하는데, 공개 홈에 그 키를 두면 누구나 계정을 지울 수 있게 된다.
   *  계정 삭제는 각 서비스 콘솔에서 (설치 가이드에 안내). */
  deleteMember(id: string): Promise<void>;
}

/** 콘텐츠 컬렉션 이름 (localStorage 키 → 컬렉션/테이블) — 두 백엔드가 같은 이름을 쓴다 */
export const COLLECTION_OF: Record<string, string> = {
  'ohome.board.v1': 'posts',
  'ohome.guest.v1': 'guestbook',
  'ohome.chars.v1': 'characters',
  'ohome.rels.v1': 'relations',
  'ohome.backup.v1': 'gallery',
  'ohome.road.v1': 'roadview',
  'ohome.trpg.v1': 'trpg_logs',
  // TRPG 로그 본문 — 목록 문서와 분리 저장 (v2.0). 목록 노출(listHidden)과 열람 권한(visibility)이
  // Firestore에서는 같은 read 규칙을 타므로(질의로 노출된 문서는 단일 조회도 전부 읽힌다),
  // "나만보기여도 목록엔 표시" 조건을 안전하게 만족하려면 본문을 아예 다른 문서에 둬야 한다
  'ohome.trpgbody.v1': 'trpg_log_bodies',
  'ohome.tchars.v1': 'trpg_chars',
  'ohome.dotori.v1': 'dotori',
  'ohome.playlog.v1': 'playlog',
  'ohome.rp.v1': 'rp_rooms',
  'ohome.threads.v1': 'threads',
  'ohome.diary.v1': 'diary',
  'ohome.memo.v1': 'memos',
  'ohome.comm.v1': 'commissions',
  'ohome.commapply.v1': 'applicants',
  'ohome.moods.v1': 'moods',
};

export const CONTENT_COLLECTIONS = Object.values(COLLECTION_OF);

/** 항목 배열 비교 — 두 백엔드가 공유하는 diff (바뀐 것만 저장) */
export function diffList<T extends ListItem>(prev: T[], next: T[]) {
  const prevMap = new Map(prev.map((it, i) => [it.id, { it, i }]));
  const nextIds = new Set(next.map(it => it.id));
  const inserts: { item: T; sort: number }[] = [];
  const updates: { item: T; sort: number }[] = [];
  next.forEach((it, i) => {
    const before = prevMap.get(it.id);
    if (!before) inserts.push({ item: it, sort: i });
    else if (before.i !== i || JSON.stringify(before.it) !== JSON.stringify(it)) updates.push({ item: it, sort: i });
  });
  const deletes = prev.filter(it => !nextIds.has(it.id)).map(it => it.id);
  return { inserts, updates, deletes };
}

/** 항목에서 권한 판단에 쓰는 값 뽑기.
 *
 *  listHidden 필드가 있는 항목(TRPG 로그 목록 문서 등)은 "목록에 뜨는지"가 곧 질의(list) 단계의
 *  공개 여부다 — 실제 열람 권한(item.visibility)과는 별개로 다룬다 (v2.0 사용자 확정: "나만보기여도
 *  목록에는 표시돼야해"). Firestore·Supabase RLS 둘 다 list/get을 같은 규칙으로 묶어 판단하므로,
 *  이 필드가 있는 문서에는 민감한 내용(본문 등)을 절대 함께 두면 안 된다 — 질의로 노출되면
 *  단일 조회 권한도 함께 열리기 때문. (그래서 TRPG 로그는 본문을 별도 문서로 분리해 저장한다.) */
export function metaOf(item: ListItem, uid: string | null) {
  const rawAuthor = typeof item.authorId === 'string' ? item.authorId : '';
  const authorId = rawAuthor || uid || null;
  const hasListHidden = typeof item.listHidden === 'boolean';
  const visibility = hasListHidden
    ? (item.listHidden ? 'private' : 'public')
    : (typeof item.visibility === 'string' ? item.visibility : 'public');
  return { authorId, visibility };
}
