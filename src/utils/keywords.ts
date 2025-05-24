export function findMatchingKeywords(
  text: string,
  keywords: string[]
): string[] {
  if (!text || !keywords || keywords.length === 0) {
    return [];
  }

  const normalizedText = text.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const keyword of keywords) {
    if (isWholeWordMatch(normalizedText, keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  return matchedKeywords;
}

function isWholeWordMatch(text: string, keyword: string): boolean {
  if (!keyword.includes(" ")) {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
    return pattern.test(text);
  }

  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
  return pattern.test(text);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightKeywords(text: string, keywords: string[]): string {
  if (!keywords || keywords.length === 0) {
    return text;
  }

  let highlightedText = text;

  for (const keyword of keywords) {
    const pattern = new RegExp(`\\b(${escapeRegExp(keyword)})\\b`, "gi");
    highlightedText = highlightedText.replace(pattern, "**$1**");
  }

  return highlightedText;
}

export function validateKeywords(keywords: string[]): string[] {
  const errors: string[] = [];

  for (const keyword of keywords) {
    const trimmed = keyword.trim();

    if (!trimmed) {
      errors.push("Empty keyword detected");
      continue;
    }

    if (trimmed.length < 2) {
      errors.push(`Keyword "${trimmed}" is too short (minimum 2 characters)`);
    }

    if (/[.*+?^${}()|[\]\\]/.test(trimmed)) {
      console.warn(
        `Warning: Keyword "${trimmed}" contains special regex characters`
      );
    }
  }

  return errors;
}
