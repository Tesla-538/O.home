import type { SchedEvent } from './schedStore';

const pad = (n: number) => String(n).padStart(2, '0');

function compactDate(date: string): string {
  return date.replaceAll('-', '');
}

function isoDate(date: string): string {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function escapeIcs(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\[nN]/g, '\n')
    .replace(/\\([,;\\])/g, '$1');
}

/** O.HOME의 날짜형 일정을 Google/Samsung Calendar가 읽는 iCalendar 파일로 만든다. */
export function eventsToIcs(events: SchedEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const rows = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//O.HOME//Scheduler//KO',
    'X-WR-CALNAME:O.HOME',
  ];

  for (const event of events) {
    const inclusiveEnd = event.end && event.end >= event.start ? event.end : event.start;
    rows.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(event.id)}@ohome`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(event.start)}`,
      `DTEND;VALUE=DATE:${compactDate(shiftDate(inclusiveEnd, 1))}`,
      `SUMMARY:${escapeIcs(event.title)}`,
    );
    if (event.memo) rows.push(`DESCRIPTION:${escapeIcs(event.memo)}`);
    if (event.repeat === 'yearly') rows.push('RRULE:FREQ=YEARLY');
    rows.push('END:VEVENT');
  }

  rows.push('END:VCALENDAR');
  return `${rows.join('\r\n')}\r\n`;
}

export interface ImportedCalendarEvent {
  title: string;
  start: string;
  end?: string;
  memo?: string;
  repeat: 'none' | 'yearly';
}

/** Google/Samsung 등에서 내보낸 ICS의 종일·시간 일정을 O.HOME 날짜 일정으로 읽는다. */
export function parseIcs(text: string): ImportedCalendarEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  const out: ImportedCalendarEvent[] = [];

  for (const block of blocks) {
    const props = new Map<string, { rawKey: string; value: string }>();
    for (const line of block.split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const rawKey = line.slice(0, colon);
      props.set(rawKey.split(';')[0].toUpperCase(), { rawKey, value: line.slice(colon + 1) });
    }
    const summary = props.get('SUMMARY')?.value;
    const dtStart = props.get('DTSTART');
    if (!summary || !dtStart) continue;
    const startRaw = dtStart.value.match(/\d{8}/)?.[0];
    if (!startRaw) continue;

    const start = isoDate(startRaw);
    const dtEnd = props.get('DTEND');
    const endRaw = dtEnd?.value.match(/\d{8}/)?.[0];
    let end: string | undefined;
    if (endRaw) {
      const parsedEnd = isoDate(endRaw);
      // VALUE=DATE의 DTEND는 끝난 다음 날(배타적)이다.
      end = /VALUE=DATE/i.test(dtEnd?.rawKey ?? '') ? shiftDate(parsedEnd, -1) : parsedEnd;
      if (end <= start) end = undefined;
    }

    out.push({
      title: unescapeIcs(summary).trim(),
      start,
      end,
      memo: props.get('DESCRIPTION')?.value ? unescapeIcs(props.get('DESCRIPTION')!.value).trim() : undefined,
      repeat: /FREQ=YEARLY/i.test(props.get('RRULE')?.value ?? '') ? 'yearly' : 'none',
    });
  }
  return out;
}

/** Google Calendar의 새 일정 작성 화면. O.HOME 일정은 종일 일정으로 넘긴다. */
export function googleCalendarUrl(event: Pick<SchedEvent, 'title' | 'start' | 'end' | 'memo'>): string {
  const inclusiveEnd = event.end && event.end >= event.start ? event.end : event.start;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${compactDate(event.start)}/${compactDate(shiftDate(inclusiveEnd, 1))}`,
  });
  if (event.memo) q.set('details', event.memo);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
