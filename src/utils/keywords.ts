/**
 * Checks if any of the provided keywords match whole words in the given text
 * @param text - The text to search in (case-insensitive)
 * @param keywords - Array of keywords to search for (case-insensitive)
 * @returns Array of matched keywords
 */
export function findMatchingKeywords(text: string, keywords: string[]): string[] {
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

/**
 * Checks if a keyword matches as a whole word in the text
 * @param text - The text to search in (should be lowercase)
 * @param keyword - The keyword to search for (should be lowercase)
 * @returns true if keyword is found as a whole word
 */
function isWholeWordMatch(text: string, keyword: string): boolean {
  // Create a regex pattern that matches the keyword as a whole word
  // \b ensures word boundaries (alphanumeric to non-alphanumeric transitions)
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Escapes special regex characters in a string
 * @param string - The string to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights matched keywords in text for display purposes
 * @param text - The original text
 * @param keywords - Array of keywords that were matched
 * @returns Text with matched keywords wrapped in **bold** markdown
 */
export function highlightKeywords(text: string, keywords: string[]): string {
  if (!keywords || keywords.length === 0) {
    return text;
  }

  let highlightedText = text;
  
  for (const keyword of keywords) {
    const pattern = new RegExp(`\\b(${escapeRegExp(keyword)})\\b`, 'gi');
    highlightedText = highlightedText.replace(pattern, '**$1**');
  }

  return highlightedText;
}

/**
 * Validates that keywords are suitable for whole-word matching
 * @param keywords - Array of keywords to validate
 * @returns Array of validation errors (empty if all valid)
 */
export function validateKeywords(keywords: string[]): string[] {
  const errors: string[] = [];

  for (const keyword of keywords) {
    const trimmed = keyword.trim();
    
    if (!trimmed) {
      errors.push('Empty keyword detected');
      continue;
    }

    if (trimmed.length < 2) {
      errors.push(`Keyword "${trimmed}" is too short (minimum 2 characters)`);
    }

    if (trimmed.includes(' ')) {
      errors.push(`Keyword "${trimmed}" contains spaces (use single words only)`);
    }

    // Check for problematic characters that might interfere with regex
    if (/[.*+?^${}()|[\]\\]/.test(trimmed)) {
      // This is actually OK since we escape it, but warn the user
      console.warn(`Warning: Keyword "${trimmed}" contains special regex characters`);
    }
  }

  return errors;
} 