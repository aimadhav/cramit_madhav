import { Platform } from 'react-native';

// This is a placeholder for LaTeX rendering
// In a real implementation, you would use a library like react-native-mathjax or a WebView solution
export function renderLatex(latex: string): string {
  // For web, we could use MathJax directly
  if (Platform.OS === 'web') {
    return `\\(${latex}\\)`;
  }
  
  // For native, we'd need to use a different approach
  // This is just a placeholder
  return latex;
}

// Helper to detect LaTeX in text
export function containsLatex(text: string): boolean {
  if (!text) return false;
  // Simple detection for dollar signs which typically wrap LaTeX
  if (/(\$\$(.*?)\$\$|\$(.*?)\$)/.test(text)) return true;
  
  // Fallback heuristic: Detect raw, un-bracketed math sequences commonly inputted manually
  if (/\\int|\\frac|\\sum|\\sqrt|\\lim|\\alpha|\\beta|\\gamma|\\theta|\\mu|\\pi|\\infty/i.test(text)) return true;
  
  return false;
}

// Extract LaTeX expressions from text
export function extractLatex(text: string): { content: string, type: 'string' | 'latex' }[] {
  if (!containsLatex(text)) {
    return [{ content: text, type: 'string' }];
  }
  
  const parts: { content: string, type: 'string' | 'latex' }[] = [];
  let lastIndex = 0;
  
  // Find all LaTeX expressions (both $$ and $ delimiters)
  const regex = /(\$\$(.*?)\$\$|\$(.*?)\$)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the LaTeX
    if (match.index > lastIndex) {
      parts.push({
        content: text.substring(lastIndex, match.index),
        type: 'string'
      });
    }
    
    // Add the LaTeX expression
    parts.push({
      content: match[2] || match[3] || match[1], // Extract the LaTeX content
      type: 'latex'
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // If we detected LaTeX keywords through the heuristic but found zero explicit $ delimiters
  // we cast the entire node to LaTeX so the equation renders universally
  if (parts.length === 0) {
    return [{ content: text, type: 'latex' }];
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push({
      content: text.substring(lastIndex),
      type: 'string'
    });
  }
  
  return parts;
}