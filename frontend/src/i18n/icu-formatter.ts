export function interpolateString(template: string, values?: Record<string, any>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] !== undefined ? String(values[key]) : match;
  });
}

// A simple regex parser for HTML-like tags inside strings to map to React components
export function parseAst(text: string) {
  const regex = /<(\w+)>(.*?)<\/\1>/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (lastIndex < match.index) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push({
      type: 'tag',
      name: match[1],
      content: match[2]
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
