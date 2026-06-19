import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { Flame } from 'lucide-react-native';

interface HomeHeaderProps {
  userName: string | null;
  userFocus: string;
  streakDays: number;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ userName, userFocus, streakDays }) => {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.logoText}><Text style={{ color: '#5e6ad2' }}>✦</Text> Cramit.</Text>
        <Text style={styles.welcomeSub}>Ready to revise, {userName || 'Scholar'}?</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={styles.streakPill}>
          <Flame size={16} color="#d2995e" fill="#d2995e" />
          <Text style={styles.streakText}>{streakDays} Days</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 25,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ececec',
  },
  welcomeSub: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  focusBadge: {
    backgroundColor: '#5e6ad220',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  focusBadgeText: {
    color: '#5e6ad2',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15171b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  streakText: {
    color: '#ececec',
    fontFamily: 'Outfit_600SemiBold',
    marginLeft: 6,
    fontSize: 13,
  }
});
