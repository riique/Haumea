/**
 * Memory Parser - Extract and process <memory> tags from AI responses
 * 
 * This utility extracts memory tags from AI responses, removes them from
 * the visible content, and returns structured memory objects.
 */

import { Memory } from '@/types/chat';

export interface ParsedMemoryResult {
  cleanContent: string; // Content without memory tags
  memories: Omit<Memory, 'id' | 'createdAt'>[]; // Extracted memories (without id/timestamp)
}

/**
 * Extract all <memory>...</memory> tags from content
 * Returns cleaned content and array of extracted memories
 * 
 * This function is robust and handles tags even inside markdown code blocks
 */
export function extractMemoryTags(content: string): ParsedMemoryResult {
  const memories: Omit<Memory, 'id' | 'createdAt'>[] = [];
  
  // Regex to match <memory>content</memory> tags (non-greedy)
  // Uses [\s\S] to match across newlines
  const memoryRegex = /<memory>([\s\S]*?)<\/memory>/gi;
  
  let cleanContent = content;
  let match;
  
  // Extract all memories from content (even if inside code blocks)
  while ((match = memoryRegex.exec(content)) !== null) {
    const memoryContent = match[1].trim();
    
    if (memoryContent) {
      memories.push({
        content: memoryContent,
        color: getRandomMemoryColor(),
      });
    }
  }
  
  // Remove all memory tags from content
  cleanContent = content.replace(memoryRegex, '').trim();
  
  // Clean up multiple consecutive newlines that might be left
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n');
  
  // Clean up empty code blocks that might be left after removing tags
  // Pattern: ``` followed by optional whitespace and another ```
  cleanContent = cleanContent.replace(/```\s*```/g, '').trim();
  
  // Clean up single backticks with only whitespace
  cleanContent = cleanContent.replace(/`\s*`/g, '').trim();
  
  return {
    cleanContent,
    memories,
  };
}

/**
 * Get a random color for memory tag
 */
function getRandomMemoryColor(): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Check if content contains any memory tags
 */
export function hasMemoryTags(content: string): boolean {
  return /<memory>[\s\S]*?<\/memory>/i.test(content);
}

/**
 * Convert parsed memories to full Memory objects
 */
export function createMemoryObjects(
  parsedMemories: Omit<Memory, 'id' | 'createdAt'>[]
): Memory[] {
  return parsedMemories.map((mem) => ({
    ...mem,
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  }));
}
