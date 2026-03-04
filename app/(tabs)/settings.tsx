import React from "react";
import { StyleSheet, View, TouchableOpacity, Switch, ScrollView, Alert } from "react-native";
import { Text } from "@/components/AppText";;
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { 
  User, 
  Bell, 
  Moon, 
  CreditCard, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Shield,
  Trash2,
  Server,
  RotateCcw
} from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore, OFFLINE_MODE_TOKEN } from "@/store/user-store";
import { useFlashcardStore } from "@/store/flashcard-store";
import BackendStatus from "@/components/BackendStatus";

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const user = useUserStore(state => state.user);
  const sessionToken = useUserStore(state => state.sessionToken);
  const logout = useUserStore(state => state.logout);
  const updateUser = useUserStore(state => state.updateUser);
  const resetUserProgress = useUserStore(state => state.resetUserProgress);
  const themePreference = useUserStore(state => state.themePreference);
  const setThemePreference = useUserStore(state => state.setThemePreference);
  const resetAllProgress = useFlashcardStore(state => state.resetAllProgress);
  
  const isOffline = sessionToken === OFFLINE_MODE_TOKEN;

  const isDarkModeOn = themePreference === 'dark';
  const [notifications, setNotifications] = React.useState(true);
  
  const handleLogout = () => {
    Alert.alert(
      isOffline ? "Exit Offline Mode" : "Logout",
      isOffline ? "Are you sure you want to exit offline mode? You'll need internet access to sign back in." : "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: isOffline ? "Exit" : "Logout",
          onPress: () => {
            logout();
            router.replace("/");
          },
          style: "destructive"
        }
      ]
    );
  };
  
  const handleResetProgress = () => {
    Alert.alert(
      "Reset Progress",
      "Are you sure you want to reset all your learning progress? This will:\n\n• Reset all flashcard intervals and repetitions\n• Clear your study stats and streaks\n• Remove all spaced repetition data\n\nThis action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset Progress",
          onPress: () => {
            // Reset flashcard progress (intervals, repetitions, etc.)
            resetAllProgress();
            // Reset user study stats (total cards studied, streaks, etc.)
            resetUserProgress();
            
            Alert.alert(
              "Progress Reset",
              "Your learning progress has been successfully reset. You can start fresh with all your flashcards!",
              [{ text: "OK" }]
            );
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (isOffline) {
      Alert.alert(
        "Feature Unavailable",
        "You cannot delete your account while in offline mode.",
        [{ text: "OK" }]
      );
      return;
    }
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => {
            logout();
            router.replace("/");
          },
          style: "destructive"
        }
      ]
    );
  };
  
  const toggleDarkMode = () => {
    setThemePreference(themePreference === 'dark' ? 'light' : 'dark');
  };
  
  const toggleNotifications = () => {
    setNotifications(!notifications);
    // In a real app, this would update notification settings
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>
        
        {/* Backend Status - Hidden in Offline Mode */}
        {!isOffline && <BackendStatus />}
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileIconContainer}>
            <User size={32} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          {!isOffline && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => router.push("/profile/edit" as any)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingIconContainer}>
              <Moon size={20} color={colors.textDark} />
            </View>
            <Text style={styles.settingText}>Dark Mode</Text>
            <Switch
              value={isDarkModeOn}
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
              thumbColor={isDarkModeOn ? colors.primary : colors.gray[100]}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingIconContainer}>
              <Bell size={20} color={colors.textDark} />
            </View>
            <Text style={styles.settingText}>Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
              thumbColor={notifications ? colors.primary : colors.gray[100]}
            />
          </View>
          
          {!isOffline && (
            <View style={styles.settingItem}>
              <View style={styles.settingIconContainer}>
                <Server size={20} color={colors.textDark} />
              </View>
              <Text style={styles.settingText}>Sync with Server</Text>
              <Switch
                value={true}
                trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
                thumbColor={colors.primary}
              />
            </View>
          )}
        </View>
        
        {/* Subscription Section */}
        {!isOffline && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => router.push("/subscription" as any)}
            >
              <View style={styles.settingIconContainer}>
                <CreditCard size={20} color={colors.textDark} />
              </View>
              <Text style={styles.settingText}>
                {user?.isPremium ? "Manage Subscription" : "Upgrade to Premium"}
              </Text>
              <ChevronRight size={20} color={colors.gray[400]} />
            </TouchableOpacity>
            
            {user?.isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>PRO</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push("/help" as any)}
          >
            <View style={styles.settingIconContainer}>
              <HelpCircle size={20} color={colors.textDark} />
            </View>
            <Text style={styles.settingText}>Help & Support</Text>
            <ChevronRight size={20} color={colors.gray[400]} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push("/privacy" as any)}
          >
            <View style={styles.settingIconContainer}>
              <Shield size={20} color={colors.textDark} />
            </View>
            <Text style={styles.settingText}>Privacy Policy</Text>
            <ChevronRight size={20} color={colors.gray[400]} />
          </TouchableOpacity>
        </View>
        
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleResetProgress}
          >
            <View style={[styles.settingIconContainer, styles.resetIcon]}>
              <RotateCcw size={20} color={colors.warning} />
            </View>
            <Text style={[styles.settingText, styles.resetText]}>Reset Progress</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleLogout}
          >
            <View style={[styles.settingIconContainer, styles.logoutIcon]}>
              <LogOut size={20} color={colors.error} />
            </View>
            <Text style={[styles.settingText, styles.logoutText]}>{isOffline ? "Exit Offline Mode" : "Logout"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleDeleteAccount}
          >
            <View style={[styles.settingIconContainer, styles.deleteIcon]}>
              <Trash2 size={20} color={isOffline ? colors.gray[400] : colors.error} />
            </View>
            <Text style={[styles.settingText, isOffline ? { color: colors.gray[400] } : styles.deleteText]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textDark,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[50],
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  profileIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gray[200],
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textDark,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.gray[200],
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textDark,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[200],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
  },
  resetIcon: {
    backgroundColor: colors.gray[200],
  },
  resetText: {
    color: colors.warning,
  },
  logoutIcon: {
    backgroundColor: colors.gray[200],
  },
  logoutText: {
    color: colors.error,
  },
  deleteIcon: {
    backgroundColor: colors.gray[200],
  },
  deleteText: {
    color: colors.error,
  },
  premiumBadge: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    color: colors.textLight,
  },
});