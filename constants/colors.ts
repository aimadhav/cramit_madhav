// Cramit Revamp - Permanent Dark Mode Palette
export const darkColors = {
  primary: '#8B5CF6', // Vibrant Indigo/Purple (Tailwind violet-500)
  primaryLight: '#A78BFA', 
  primaryDark: '#7C3AED',
  secondary: '#10B981', // Emerald (for success/progress)
  secondaryLight: '#34D399',
  secondaryDark: '#059669',
  background: '#000000', // Deep Black
  surface: '#121212', // Slightly elevated surface
  card: '#1E1E1E', // Dark Gray Cards
  cardElevated: '#2D2D2D', // Elevated cards
  accent: '#8B5CF6',
  text: '#FFFFFF', // Pure White
  textLight: '#9CA3AF', // Muted Gray (Tailwind gray-400)
  textDark: '#F3F4F6', 
  border: '#2D2D2D', // Subtle dark border
  success: '#10B981', 
  warning: '#F59E0B', 
  error: '#EF4444', 
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  }
};

export const lightColors = darkColors; // Force permanent dark mode

// Default export for backward compatibility during the refactor
export const colors = darkColors;
export default colors;
