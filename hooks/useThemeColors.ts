import { useColorScheme } from 'react-native';
import { useUserStore } from '@/store/user-store';
import { lightColors, darkColors } from '@/constants/colors';

export function useThemeColors() {
  const themePreference = useUserStore(state => state.themePreference);
  const systemColorScheme = useColorScheme();

  const isDark = 
    themePreference === 'dark' || 
    (themePreference === 'system' && systemColorScheme === 'dark');

  return isDark ? darkColors : lightColors;
}
