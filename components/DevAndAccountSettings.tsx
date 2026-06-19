import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { Smartphone, BookOpen, LogOut } from 'lucide-react-native';

interface DevAndAccountSettingsProps {
  userEmail: string;
  onOpenSqlDebugger: () => void;
  onOpenCardInspector: () => void;
  onSignOut: () => void;
}

export const DevAndAccountSettings: React.FC<DevAndAccountSettingsProps> = ({
  userEmail,
  onOpenSqlDebugger,
  onOpenCardInspector,
  onSignOut,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.cardSectionLabel}>DEVELOPER TOOLS</Text>
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={onOpenSqlDebugger}
      >
        <Smartphone size={20} color="#5e6ad2" />
        <Text style={[styles.logoutButtonText, { color: '#5e6ad2' }]}>Open SQLite Debugger</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.logoutButton, { marginTop: -5 }]}
        onPress={onOpenCardInspector}
      >
        <BookOpen size={20} color="#3fb950" />
        <Text style={[styles.logoutButtonText, { color: '#3fb950' }]}>Card Data Inspector</Text>
      </TouchableOpacity>

      <Text style={[styles.cardSectionLabel, { marginTop: 15 }]}>ACCOUNT</Text>
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={onSignOut}
      >
        <LogOut size={20} color="#ff5f57" />
        <Text style={styles.logoutButtonText}>Sign Out of {userEmail || 'Account'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 30,
    gap: 15,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1.5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2C32',
    gap: 12,
  },
  logoutButtonText: {
    color: '#ff5f57',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  }
});
