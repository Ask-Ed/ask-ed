import type { CourseDocument, DocumentHighlight } from '@/lib/engine/schema';

export interface HighlightRange {
  startOffset: number;
  endOffset: number;
  text: string;
  sectionId: string;
  paragraphIndex: number;
  contentBlockIndex: number;
}

export function createHighlightId(): string {
  return `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getSelectionRange(): HighlightRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  
  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  
  if (!text) return null;

  // Find the section, paragraph, and content block
  const startContainer = range.startContainer;
  const startElement = startContainer.nodeType === Node.TEXT_NODE 
    ? startContainer.parentElement 
    : startContainer as Element;
  
  // Find section ID
  let sectionId = '';
  let sectionElement: Element | null = null;
  let current = startElement;
  while (current && current !== document.body) {
    if (current.id && current.tagName === 'SECTION') {
      sectionId = current.id;
      sectionElement = current;
      break;
    }
    current = current.parentElement;
  }
  
  if (!sectionId || !sectionElement) return null;

  // Find paragraph index by counting previous paragraph divs in the section
  let paragraphIndex = 0;
  let paragraphElement: Element | null = null;
  current = startElement;
  
  // Find the paragraph container (div with leading-relaxed class)
  while (current && current !== sectionElement) {
    if (current.classList?.contains('leading-relaxed') && current.classList?.contains('mb-6')) {
      paragraphElement = current;
      break;
    }
    current = current.parentElement;
  }
  
  if (paragraphElement) {
    // Count previous paragraphs in this section
    let prevSibling = paragraphElement.previousElementSibling;
    while (prevSibling) {
      if (prevSibling.classList?.contains('leading-relaxed') && prevSibling.classList?.contains('mb-6')) {
        paragraphIndex++;
      }
      prevSibling = prevSibling.previousElementSibling;
    }
  }

  // For content block index, we'll use 0 for now since most text is in the first content block
  // This could be enhanced by finding the specific text block within the paragraph
  const contentBlockIndex = 0;
  
  // Calculate text offset relative to the paragraph's text content
  let textOffset = 0;
  if (paragraphElement && startContainer.nodeType === Node.TEXT_NODE) {
    const walker = document.createTreeWalker(
      paragraphElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node === startContainer) {
        textOffset += range.startOffset;
        break;
      }
      textOffset += node.textContent?.length || 0;
    }
  }
  
  return {
    startOffset: textOffset,
    endOffset: textOffset + text.length,
    text,
    sectionId,
    paragraphIndex,
    contentBlockIndex
  };
}

// Note: These functions are now deprecated as highlights are stored separately
// They are kept for backward compatibility during migration

export function addHighlightToDocument(
  document: CourseDocument,
  highlight: DocumentHighlight
): CourseDocument {
  console.warn('addHighlightToDocument is deprecated. Use addHighlight mutation instead.');
  return document;
}

export function removeHighlightFromDocument(
  document: CourseDocument,
  highlightId: string
): CourseDocument {
  console.warn('removeHighlightFromDocument is deprecated. Use removeHighlight mutation instead.');
  return document;
}

export function getHighlightsForSection(
  document: CourseDocument,
  sectionId: string
): DocumentHighlight[] {
  console.warn('getHighlightsForSection is deprecated. Use getSectionHighlights query instead.');
  return [];
}