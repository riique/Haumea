/**
 * Maps user-selected font names to CSS font-family values
 */
export const fontFamilyMap: Record<string, string> = {
  'Inter': 'var(--font-inter), system-ui, -apple-system, sans-serif',
  'Space Grotesk': 'var(--font-space-grotesk), system-ui, -apple-system, sans-serif',
  'Roboto': 'var(--font-roboto), system-ui, -apple-system, sans-serif',
  'Open Sans': 'var(--font-open-sans), system-ui, -apple-system, sans-serif',
  'Lato': 'var(--font-lato), system-ui, -apple-system, sans-serif',
  'Merriweather': 'var(--font-merriweather), Georgia, serif',
  'Georgia': 'Georgia, "Times New Roman", Times, serif',
  'JetBrains Mono': 'var(--font-jetbrains-mono), "Courier New", monospace',
  'Fira Code': 'var(--font-fira-code), "Courier New", monospace',
  'Source Code Pro': 'var(--font-source-code-pro), "Courier New", monospace',
};

/**
 * Gets the CSS font-family value for a given font name
 * @param fontName - The user-selected font name
 * @returns The CSS font-family value
 */
export function getFontFamily(fontName: string): string {
  return fontFamilyMap[fontName] || fontFamilyMap['Inter'];
}
