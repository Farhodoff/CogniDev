/**
 * Sanitizes user input query for SQLite FTS5 MATCH expressions.
 * Strips special characters (* " ^ : AND OR NOT NEAR) that trigger syntax errors.
 */
export function sanitizeFtsQuery(query: string): string {
  if (!query) return '';
  const cleaned = query
    .replace(/["*^:()]/g, ' ')
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, ' ')
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';
  // Append prefix search wildcard to each token
  return tokens.map(t => `"${t}"*`).join(' ');
}
