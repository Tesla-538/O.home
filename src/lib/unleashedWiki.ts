import 'server-only';
import rawWiki from '@/data/unleashed-wiki.json';

export const UNLEASHED_CATEGORIES = ['녹스', '효과', '퀘스트', '레이드', '아이템', '스킨'] as const;
export type UnleashedCategory = typeof UNLEASHED_CATEGORIES[number];

export interface UnleashedRecord {
  id: string;
  category: UnleashedCategory;
  title: string;
  sourceUrl: string;
  listSourceUrl: string;
  listHeaders: string[];
  listValues: string[];
  detail: string[];
  structured?: {
    kind: 'nox' | 'effect' | 'quest' | 'raid' | 'item' | 'skin';
    profile?: {
      name: string;
      rarity: string;
      world: string;
      cost: string;
      maxLevel: string;
      town: string;
      gender: string;
      roles: { name: string; active: boolean }[];
      artist: string;
      tags: string[];
      stats: { label: string; value: string }[];
    };
    skills?: { type: string; name: string; description: string; effectSourceUrl: string | null }[];
    acquisition?: {
      kind: string;
      title: string;
      headers: string[];
      rows: { cells: string[]; sourceUrl: string | null }[];
    }[];
    summary?: { label: string; value: string; tone?: string }[];
    description?: string;
    flags?: { label: string; active: boolean }[];
    sections?: { kind: string; title: string; headers: string[]; rows: string[][] }[];
  };
  searchText: string;
  fetchError?: boolean;
}

export interface UnleashedWikiData {
  source: {
    name: string;
    baseUrl: string;
    collectedAt: string;
    imagePolicy: string;
    robotsExcluded: string[];
    listPages: string[];
  };
  categoryCounts: Record<UnleashedCategory, number>;
  failures: number;
  records: UnleashedRecord[];
}

export const unleashedWiki = rawWiki as unknown as UnleashedWikiData;
