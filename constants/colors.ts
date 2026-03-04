// Google Material Design Inspired Color Schemes
export const lightColors = {
  primary: '#0B57D0', // Google Workspace Blue
  primaryLight: '#D3E3FD', 
  primaryDark: '#0842A0',
  secondary: '#1E8E3E', // Google Drive Green
  secondaryLight: '#C4EED0',
  secondaryDark: '#137333',
  background: '#F0F4F9', // Signature Google Workspace Surface Background
  card: '#FFFFFF', // Pure White Cards
  text: '#1F1F1F', // Google On-Surface Text
  textLight: '#444746', // Google On-Surface Variant
  textDark: '#000000',
  border: '#E0E2E0', // Google Outline Variant
  success: '#34A853', // Google Green
  warning: '#FBBC04', // Google Yellow
  error: '#EA4335', // Google Red
  gray: {
    50: '#F8F9FA',
    100: '#F1F3F4',
    200: '#E8EAED',
    300: '#DADCE0',
    400: '#BDC1C6',
    500: '#9AA0A6',
    600: '#80868B',
    700: '#5F6368',
    800: '#3C4043',
    900: '#202124',
  }
};

export const darkColors = {
  primary: '#00E676', // Neon Emerald Green for dark mode
  primaryLight: '#69F0AE',
  primaryDark: '#00C853',
  secondary: '#8AB4F8', // Google Dark Mode Blue
  secondaryLight: '#AECBFA',
  secondaryDark: '#669DF6',
  background: '#202124', // Google Dark Background
  card: '#303134', // Google Dark Cards
  text: '#E8EAED', // Google Dark Mode Main Text
  textLight: '#9AA0A6', // Google Dark Mode Secondary Text
  textDark: '#FFFFFF', 
  border: '#5F6368', // Google Dark Border
  success: '#81C995', 
  warning: '#FDE293', 
  error: '#F28B82', 
  gray: {
    50: '#202124',
    100: '#303134',
    200: '#3C4043',
    300: '#5F6368',
    400: '#80868B',
    500: '#9AA0A6',
    600: '#BDC1C6',
    700: '#DADCE0',
    800: '#E8EAED',
    900: '#F8F9FA',
  }
};

// Default export for backward compatibility during the refactor
export const colors = lightColors;
export default colors;