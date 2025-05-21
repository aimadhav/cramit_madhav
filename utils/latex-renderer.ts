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
  // Simple detection for dollar signs which typically wrap LaTeX
  return /\$\$(.*?)\$\$|\$(.*?)\$/.test(text);
}

// Extract LaTeX expressions from text
export function extractLatex(text: string): { text: string, isLatex: boolean }[] {
  if (!containsLatex(text)) {
    return [{ text, isLatex: false }];
  }
  
  const parts: { text: string, isLatex: boolean }[] = [];
  let lastIndex = 0;
  
  // Find all LaTeX expressions (both $$ and $ delimiters)
  const regex = /(\$\$(.*?)\$\$|\$(.*?)\$)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the LaTeX
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isLatex: false
      });
    }
    
    // Add the LaTeX expression
    parts.push({
      text: match[2] || match[3] || match[1], // Extract the LaTeX content
      isLatex: true
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      isLatex: false
    });
  }
  
  return parts;
}