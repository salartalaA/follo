export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

export interface WritingStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  readingMinutes: number;
}

export interface OutlineHeading {
  id: string;
  level: 1 | 2 | 3;
  text: string;
}

export function computeLineDiff(beforeText: string, afterText: string): DiffLine[] {
  const a = beforeText.split('\n');
  const b = afterText.split('\n');
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: 'unchanged', text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'removed', text: a[i] });
      i += 1;
    } else {
      result.push({ type: 'added', text: b[j] });
      j += 1;
    }
  }

  while (i < m) {
    result.push({ type: 'removed', text: a[i] });
    i += 1;
  }
  while (j < n) {
    result.push({ type: 'added', text: b[j] });
    j += 1;
  }

  return result;
}

export function computeWritingStats(text: string): WritingStats {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  const paragraphs = trimmed
    ? trimmed.split(/\n+/).filter((line) => line.trim().length > 0).length
    : 0;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 220));

  return {
    words,
    characters,
    charactersNoSpaces,
    paragraphs,
    readingMinutes,
  };
}

export function extractOutlineFromHtml(html: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const regex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let index = 0;
  for (const match of html.matchAll(regex)) {
    const levelNum = Number(match[1]);
    const rawInner = match[2] ?? '';
    const text = rawInner.replace(/<[^>]+>/g, '').trim();
    if (text && (levelNum === 1 || levelNum === 2 || levelNum === 3)) {
      headings.push({
        id: `heading-${index}`,
        level: levelNum,
        text,
      });
      index += 1;
    }
  }
  return headings;
}
