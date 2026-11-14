import { marked } from 'marked';

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|tr|blockquote|pre|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function markdownToHtml(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  return typeof rendered === 'string' ? rendered : '';
}

export function htmlToMarkdown(html: string): string {
  let out = html;

  out = out.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_m, code: string) => {
    const decoded = decodeEntities(code.replace(/<[^>]+>/g, ''));
    return `\n\`\`\`\n${decoded.trim()}\n\`\`\`\n`;
  });

  out = out.replace(
    /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
    (_m, text: string) => `\n# ${stripTags(text)}\n`,
  );
  out = out.replace(
    /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
    (_m, text: string) => `\n## ${stripTags(text)}\n`,
  );
  out = out.replace(
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    (_m, text: string) => `\n### ${stripTags(text)}\n`,
  );
  out = out.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, text: string) => {
    const lines = stripTags(text)
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    return `\n${lines}\n`;
  });

  out = out.replace(
    /<li[^>]*data-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/gi,
    (_m, checked: string, body: string) => {
      const mark = checked === 'true' ? 'x' : ' ';
      return `- [${mark}] ${stripTags(body)}\n`;
    },
  );
  out = out.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, body: string) => `- ${stripTags(body)}\n`);

  out = out.replace(
    /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _tag: string, body: string) => `**${stripTags(body)}**`,
  );
  out = out.replace(
    /<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _tag: string, body: string) => `*${stripTags(body)}*`,
  );
  out = out.replace(
    /<code[^>]*>([\s\S]*?)<\/code>/gi,
    (_m, body: string) => `\`${stripTags(body)}\``,
  );
  out = out.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, text: string) => `[${stripTags(text)}](${href})`,
  );

  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, text: string) => `${stripTags(text)}\n\n`);
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/<[^>]+>/g, '');
  out = decodeEntities(out);

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function generateRtfFromText(title: string, plainText: string): string {
  const escapeRtf = (str: string) =>
    str
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\n/g, '\\par\n');

  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\\fs28\\b ${escapeRtf(title)}\\b0\\fs22\\par\\par\n${escapeRtf(plainText)}}`;
}

export function parseRtfToPlainText(rtf: string): string {
  return rtf
    .replace(/\\par\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\{\\[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]+>/g, '').trim());
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}
