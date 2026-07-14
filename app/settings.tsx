import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ChevronLeft, ExternalLink, HelpCircle, LogOut, ShieldCheck, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { AccountService } from '@/services/account-service';
import { AuthService } from '@/services/auth-service';
import { OFFLINE_MODE_TOKEN, useUserStore } from '@/store/user-store';

const legal = (Constants.expoConfig?.extra?.legal ?? {}) as {
  privacyUrl?: string;
  accountDeletionUrl?: string;
  supportUrl?: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const sessionToken = useUserStore((state) => state.sessionToken);
  const [deleting, setDeleting] = useState(false);
  const isCloudAccount = Boolean(user?.id && sessionToken && sessionToken !== OFFLINE_MODE_TOKEN);

  const openUrl = async (url?: string) => {
    if (!url || !(await Linking.canOpenURL(url))) {
      Alert.alert('Link unavailable', 'Please try again later.');
      return;
    }
    await Linking.openURL(url);
  };

  const confirmDelete = () => {
    if (!user?.id || !isCloudAccount) return;
    Alert.alert(
      'Delete your Cramit account?',
      'Your synced progress, reviews, notes and class memberships will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Final confirmation',
            'Delete this account and all associated data permanently?',
            [
              { text: 'Keep account', style: 'cancel' },
              {
                text: 'Delete permanently',
                style: 'destructive',
                onPress: async () => {
                  try {
                    setDeleting(true);
                    await AccountService.deleteCurrentAccount(user.id);
                    router.replace('/login');
                  } catch (error: any) {
                    Alert.alert('Deletion unavailable', error?.message || 'Please use the deletion request page or contact support.');
                  } finally {
                    setDeleting(false);
                  }
                },
              },
            ],
          ),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Back" style={styles.iconButton} onPress={() => router.back()}>
            <ChevronLeft size={21} color="#EDEEF2" />
          </TouchableOpacity>
          <Text style={styles.title}>Account & privacy</Text>
          <View style={styles.iconSpacer} />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || user?.email || 'C').charAt(0).toUpperCase()}</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{user?.name || (isCloudAccount ? 'Cramit student' : 'Guest')}</Text>
            <Text style={styles.profileEmail}>{isCloudAccount ? user?.email : 'Progress is stored only on this device'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PRIVACY & SUPPORT</Text>
        <View style={styles.card}>
          <Row icon={<ShieldCheck size={19} color="#8E98FF" />} title="Privacy policy" onPress={() => void openUrl(legal.privacyUrl)} />
          <View style={styles.divider} />
          <Row icon={<Trash2 size={19} color="#C58B87" />} title="Account deletion information" onPress={() => void openUrl(legal.accountDeletionUrl)} />
          <View style={styles.divider} />
          <Row icon={<HelpCircle size={19} color="#D5A562" />} title="Help and support" onPress={() => void openUrl(legal.supportUrl)} />
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={async () => { await AuthService.signOut(); router.replace('/login'); }}>
          <LogOut size={18} color="#D6D8DE" />
          <Text style={styles.signOutText}>{isCloudAccount ? 'Sign out' : 'Exit guest mode'}</Text>
        </TouchableOpacity>

        {isCloudAccount && (
          <TouchableOpacity style={styles.deleteButton} disabled={deleting} onPress={confirmDelete}>
            {deleting ? <ActivityIndicator color="#DF7773" /> : <Trash2 size={18} color="#DF7773" />}
            <Text style={styles.deleteText}>{deleting ? 'Deleting account…' : 'Delete account permanently'}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.version}>Cramit {Constants.expoConfig?.version ?? '1.0.0'} · build {Constants.expoConfig?.android?.versionCode ?? '—'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, title, onPress }: { icon: React.ReactNode; title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowText}>{title}</Text>
      <ExternalLink size={15} color="#666A75" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0C0E' },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#15171B', borderWidth: 1, borderColor: '#2A2C32', alignItems: 'center', justifyContent: 'center' },
  iconSpacer: { width: 38 },
  title: { color: '#F1F1F3', fontSize: 18, fontFamily: 'Outfit_700Bold' },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 17, borderRadius: 19, backgroundColor: '#15171B', borderWidth: 1, borderColor: '#2A2C32', marginTop: 12 },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#5e6ad2', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Outfit_700Bold' },
  profileCopy: { flex: 1 },
  profileName: { color: '#F1F1F3', fontSize: 16, fontFamily: 'Outfit_700Bold' },
  profileEmail: { color: '#858891', fontSize: 11, marginTop: 2 },
  sectionLabel: { color: '#666A75', fontSize: 9, letterSpacing: 1.1, fontFamily: 'Outfit_700Bold', marginTop: 26, marginBottom: 9 },
  card: { borderRadius: 18, backgroundColor: '#15171B', borderWidth: 1, borderColor: '#2A2C32', overflow: 'hidden' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  rowIcon: { width: 34 },
  rowText: { flex: 1, color: '#DCDDDF', fontSize: 14, fontFamily: 'Outfit_600SemiBold' },
  divider: { height: 1, backgroundColor: '#25272D', marginLeft: 49 },
  signOutButton: { height: 52, borderRadius: 15, backgroundColor: '#181A1F', borderWidth: 1, borderColor: '#2A2C32', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 26 },
  signOutText: { color: '#D6D8DE', fontSize: 14, fontFamily: 'Outfit_700Bold' },
  deleteButton: { minHeight: 52, borderRadius: 15, backgroundColor: '#2A1718', borderWidth: 1, borderColor: '#532728', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12 },
  deleteText: { color: '#DF7773', fontSize: 13, fontFamily: 'Outfit_700Bold' },
  version: { color: '#555861', fontSize: 10, textAlign: 'center', marginTop: 24 },
});
