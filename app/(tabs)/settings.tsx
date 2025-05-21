import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Switch, ScrollView, Alert } from "react-native";
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
  Server
} from "lucide-react-native";

import colors from "@/constants/colors";
import { useUserStore } from "@/store/user-store";
import BackendStatus from "@/components/BackendStatus";

export default function SettingsScreen() {
  const router = useRouter();
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);
  const updateUser = useUserStore(state => state.updateUser);
  
  const [darkMode, setDarkMode] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);
  
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: () => {
            logout();
            router.replace("/");
          },
          style: "destructive"
        }
      ]
    );
  };
  
  const handleDeleteAccount = () => {
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
    setDarkMode(!darkMode);
    // In a real app, this would update the theme
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
        
        {/* Backend Status */}
        <BackendStatus />
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileIconContainer}>
            <User size={32} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push("/profile/edit")}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
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
              value={darkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
              thumbColor={darkMode ? colors.primary : colors.gray[100]}
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
        </View>
        
        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push("/subscription")}
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
        
        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push("/help")}
          >
            <View style={styles.settingIconContainer}>
              <HelpCircle size={20} color={colors.textDark} />
            </View>
            <Text style={styles.settingText}>Help & Support</Text>
            <ChevronRight size={20} color={colors.gray[400]} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push("/privacy")}
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
            onPress={handleLogout}
          >
            <View style={[styles.settingIconContainer, styles.logoutIcon]}>
              <LogOut size={20} color={colors.error} />
            </View>
            <Text style={[styles.settingText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleDeleteAccount}
          >
            <View style={[styles.settingIconContainer, styles.deleteIcon]}>
              <Trash2 size={20} color={colors.error} />
            </View>
            <Text style={[styles.settingText, styles.deleteText]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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