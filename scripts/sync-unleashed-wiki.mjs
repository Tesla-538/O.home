import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const BASE = 'http://uldb.iustice.net/wiki/';
const OUTPUT = resolve(process.cwd(), 'src/data/unleashed-wiki.json');
const CONCURRENCY = 6;
const COLLECTED_AT = new Date().toISOString();

const LISTS = [
  { page: 'NoxList.aspx', category: '녹스' },
  { page: 'BuffList.aspx', category: '효과' },
  { page: 'QuestList.aspx', category: '퀘스트' },
  { page: 'RaidList.aspx', category: '레이드' },
  { page: 'SkinList.aspx', category: '스킨' },
];

const DETAIL_CATEGORY = {
  NoxDetail: '녹스',
  BuffDetail: '효과',
  QuestListDetail: '퀘스트',
  RaidListDetail: '레이드',
  ItemDetail: '아이템',
};

const LIST_HEADERS = {
  'NoxList.aspx': ['지역', 'Face', '이름', '희귀도', 'Cost', '전투', '퀘스트 클리어', '레이드', '조합 (Nyang)', '조합 (Sphere)', '기타'],
  'BuffList.aspx': ['icon', '이름', '종류', '기본 속성', '특수 옵션', '군중 제어기', '지속효과', '설명'],
  'QuestList.aspx': ['제목', '종류', '등장조건', 'Map', '맵 정보', '클리어보상', '전투 드랍 녹스', '등장 레이드 및 Drop 녹스'],
  'RaidList.aspx': ['Raid title', '지역', '소모 AP', 'Drop Nox', '발견방법', '퀘스트 발판', '아이템 사용'],
  'SkinList.aspx': ['Face', '이름', '스킨 명칭', '가격', '판매', '비고'],
};

function decodeHtml(value) {
  const named = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  };
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => named[name.toLowerCase()] ?? all);
}

function visibleText(html) {
  return decodeHtml(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/table>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \f\r\t\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cellTexts(rowHtml) {
  return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
    .map(match => visibleText(match[1]))
    .map(value => value.replace(/\n+/g, ' / ').trim());
}

function canonicalDetailHref(rawHref) {
  const clean = decodeHtml(rawHref).replace(/^\.\//, '');
  const match = clean.match(/^(NoxDetail|BuffDetail|QuestListDetail|RaidListDetail|ItemDetail)\.aspx\?([^#]+)/i);
  if (!match) return null;
  const endpoint = match[1];
  const params = new URLSearchParams(match[2]);
  const key = endpoint.toLowerCase() === 'noxdetail' ? 'cd_nox'
      : endpoint.toLowerCase() === 'buffdetail' ? 'cd_buff'
      : endpoint.toLowerCase() === 'questlistdetail' ? 'quest'
        : endpoint.toLowerCase() === 'raidlistdetail' ? 'ms' : 'cd_item';
  const value = params.get(key);
  return value ? `${endpoint}.aspx?${key}=${encodeURIComponent(value)}` : null;
}

function endpointOf(href) {
  return href.match(/^([A-Za-z]+)\.aspx/)?.[1] ?? '';
}

function titleFromRow(rowHtml, href) {
  const anchors = [...rowHtml.matchAll(/<a\b[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi)];
  const hit = anchors.find(anchor => canonicalDetailHref(anchor[1]) === href);
  return hit ? visibleText(hit[2]).replace(/\s+/g, ' ').trim() : '';
}

function detailFragment(html) {
  const markers = [
    /<table\b[^>]*id\s*=\s*['"]table_data_buff['"]/i,
    /<table\b[^>]*id\s*=\s*['"]table_data['"]/i,
    /<table\b[^>]*id\s*=\s*['"]table_head['"]/i,
  ];
  let start = -1;
  for (const marker of markers) {
    const match = marker.exec(html);
    if (match && (start < 0 || match.index < start)) start = match.index;
  }
  if (start < 0) return '';
  const reply = html.search(/<table\b[^>]*id\s*=\s*['"]iustice_reply/i);
  const end = reply > start ? reply : html.length;
  return html.slice(start, end);
}

function detailBlocks(html) {
  const text = visibleText(detailFragment(html));
  return text.split(/\n{2,}/)
    .map(block => block.split('\n').map(line => line.trim()).filter(Boolean).join('\n'))
    .filter(block => block && !/로그인 하셔야 합니다|자동등록방지|등록된 덧글/.test(block));
}

async function fetchText(url, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'O.HOME private wiki sync (contact: source URL retained)' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise(resolveDelay => setTimeout(resolveDelay, attempt * 750));
    return fetchText(url, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

async function mapConcurrent(values, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, values.length) }, run));
  return results;
}

const listPages = [];
for (const list of LISTS) {
  const sourceUrl = new URL(list.page, BASE).toString();
  const html = await fetchText(sourceUrl);
  listPages.push({ ...list, sourceUrl, html });
  console.log(`list ${list.category}: ${Buffer.byteLength(html).toLocaleString()} bytes`);
}

const discovered = new Map();
const skins = [];

for (const list of listPages) {
  const rows = [...list.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[0]);
  for (const [rowIndex, row] of rows.entries()) {
    const cells = cellTexts(row);
    const hrefs = [...row.matchAll(/href\s*=\s*['"]([^'"]+)['"]/gi)]
      .map(match => canonicalDetailHref(match[1]))
      .filter(Boolean);

    for (const href of hrefs) {
      const endpoint = endpointOf(href);
      const category = DETAIL_CATEGORY[endpoint];
      if (!category) continue;
      const title = titleFromRow(row, href);
      const existing = discovered.get(href);
      if (!existing) {
        discovered.set(href, {
          id: href,
          category,
          title,
          sourceUrl: new URL(href, BASE).toString(),
          listSourceUrl: list.sourceUrl,
          listHeaders: LIST_HEADERS[list.page] ?? [],
          listValues: cells,
        });
      } else if (!existing.title && title) {
        existing.title = title;
      }
    }

    if (list.page === 'SkinList.aspx' && hrefs.length && cells.length >= 3) {
      const title = cells[2];
      if (title && title !== '스킨 명칭') {
        skins.push({
          id: `skin:${rowIndex}:${hrefs[0]}`,
          category: '스킨',
          title,
          sourceUrl: list.sourceUrl,
          listSourceUrl: list.sourceUrl,
          listHeaders: LIST_HEADERS[list.page],
          listValues: cells,
          detail: [],
        });
      }
    }
  }

  // Quest/Raid 목록은 한 행 안에 중첩 table이 있어 단순 <tr> 경계만으로는 일부 링크가
  // 바깥 행에 가려진다. 페이지 전체의 앵커를 한 번 더 대조해 상세 URL 누락을 막는다.
  for (const anchor of list.html.matchAll(/<a\b[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = canonicalDetailHref(anchor[1]);
    if (!href) continue;
    const endpoint = endpointOf(href);
    const category = DETAIL_CATEGORY[endpoint];
    if (!category) continue;
    const title = visibleText(anchor[2]).replace(/\s+/g, ' ').trim();
    const existing = discovered.get(href);
    if (!existing) {
      discovered.set(href, {
        id: href,
        category,
        title,
        sourceUrl: new URL(href, BASE).toString(),
        listSourceUrl: list.sourceUrl,
        listHeaders: LIST_HEADERS[list.page] ?? [],
        listValues: [],
      });
    } else if (!existing.title && title) {
      existing.title = title;
    }
  }
}

const entries = [...discovered.values()];
console.log(`details discovered: ${entries.length.toLocaleString()}`);

let done = 0;
const detailed = await mapConcurrent(entries, async entry => {
  try {
    const html = await fetchText(entry.sourceUrl);
    const detail = detailBlocks(html);
    done += 1;
    if (done % 100 === 0 || done === entries.length) {
      console.log(`details ${done.toLocaleString()}/${entries.length.toLocaleString()}`);
    }
    return { ...entry, detail };
  } catch (error) {
    console.error(`failed ${entry.sourceUrl}: ${error instanceof Error ? error.message : error}`);
    return { ...entry, detail: [], fetchError: true };
  }
});

const records = [...detailed, ...skins]
  .map(record => ({
    ...record,
    searchText: [record.title, record.category, ...record.listValues, ...record.detail].join('\n').toLocaleLowerCase('ko-KR'),
  }))
  .sort((a, b) => a.category.localeCompare(b.category, 'ko-KR') || a.title.localeCompare(b.title, 'ko-KR'));

const categoryCounts = Object.fromEntries(
  [...new Set(records.map(record => record.category))]
    .map(category => [category, records.filter(record => record.category === category).length]),
);
const failures = records.filter(record => record.fetchError).length;
const output = {
  source: {
    name: 'Unleashed DataBase (KR)',
    baseUrl: BASE,
    collectedAt: COLLECTED_AT,
    imagePolicy: 'excluded',
    robotsExcluded: ['NoxRank.aspx'],
    listPages: LISTS.map(list => new URL(list.page, BASE).toString()),
  },
  categoryCounts,
  failures,
  records,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(output)}\n`, 'utf8');
console.log(`wrote ${OUTPUT}`);
console.log(`records: ${records.length.toLocaleString()}, failures: ${failures}, bytes: ${(Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(2)} MiB`);
