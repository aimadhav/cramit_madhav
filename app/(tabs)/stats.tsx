import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Text } from '@/components/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flame, Atom, FlaskConical, FunctionSquare, ChevronRight, BarChart3, Target, BookOpen, LogOut, Users, Plus, Layout, Smartphone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import { useUserStore } from '@/store/user-store';
import { useFlashcardStore } from '@/store/flashcard-store';
import { supabase } from '@/lib/supabase';
import { MOCK_USER_STATS } from '@/constants/mockData';

const { width } = Dimensions.get('window');

// Helper to render heatmap
const HeatmapGrid = ({ heatmapData }: { heatmapData: number[] }) => {
  const columns = 14; 
  const rows = 7;
  
  return (
    <View style={stylesHeatmap.container}>
      <View style={stylesHeatmap.grid}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <View key={`col-${colIndex}`} style={stylesHeatmap.column}>
            {Array.from({ length: rows }).map((_, rowIndex) => {
              const dataIndex = colIndex * rows + rowIndex;
              const intensity = heatmapData[dataIndex] || 0;
              
              let backgroundColor = '#1A1A1A'; 
              if (intensity === 1) backgroundColor = 'rgba(94, 106, 210, 0.2)';
              if (intensity === 2) backgroundColor = 'rgba(94, 106, 210, 0.4)';
              if (intensity === 3) backgroundColor = 'rgba(94, 106, 210, 0.7)';
              if (intensity === 4) backgroundColor = '#5e6ad2';

              return (
                <View 
                  key={`cell-${colIndex}-${rowIndex}`} 
                  style={[stylesHeatmap.cell, { backgroundColor }]} 
                />
              );
            })}
          </View>
        ))}
      </View>
      
      <View style={stylesHeatmap.legendRow}>
        <Text style={stylesHeatmap.legendText}>LESS</Text>
        <View style={stylesHeatmap.legendColors}>
          <View style={[stylesHeatmap.cell, { backgroundColor: '#1A1A1A' }]} />
          <View style={[stylesHeatmap.cell, { backgroundColor: 'rgba(94, 106, 210, 0.2)' }]} />
          <View style={[stylesHeatmap.cell, { backgroundColor: 'rgba(94, 106, 210, 0.4)' }]} />
          <View style={[stylesHeatmap.cell, { backgroundColor: 'rgba(94, 106, 210, 0.7)' }]} />
          <View style={[stylesHeatmap.cell, { backgroundColor: '#5e6ad2' }]} />
        </View>
        <Text style={stylesHeatmap.legendText}>MORE</Text>
      </View>
    </View>
  );
};

export default function StatsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useUserStore();
  const { decks, getStreak, getDeckCompletionRate } = useFlashcardStore();

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  // Real Local Stats State
  const [localStats, setLocalStats] = useState({ totalReviews: 0, uniqueCards: 0 });
  const [joinedRooms, setJoinedRooms] = useState<any[]>([]);

  useEffect(() => {
    const fetchLocalStats = async () => {
      const { db, expoDb } = require('@/db');
      const { reviews, userFlashcardStatus } = require('@/db/schema');
      const { count, eq } = require('drizzle-orm');
      
      try {
        // Quick check if tables exist to prevent early crash
   

        const revCount = await db.select({ value: count() }).from(reviews).where(eq(reviews.userId, user?.id || 'local'));
        const cardCount = await db.select({ value: count() }).from(userFlashcardStatus).where(eq(userFlashcardStatus.userId, user?.id || 'local'));
        
        setLocalStats({
          totalReviews: revCount[0]?.value || 0,
          uniqueCards: cardCount[0]?.value || 0
        });
      } catch (e) {
        console.error('Stats calc failed:', e);
      }
    };
    fetchLocalStats();
  }, [user?.id]);

  const handleJoinRoom = async () => {
    if (joinCode.length !== 6) {
      Alert.alert('Error', 'Join code must be 6 characters.');
      return;
    }
    
    try {
      // Direct Supabase call for joining room logic
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode)
        .single();
      
      if (error || !data) throw new Error('Invalid room code');

      const { db } = require('@/db');
      const { rooms } = require('@/db/schema');
      
      // Save room locally
      await db.insert(rooms).values({
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description,
        createdBy: data.created_by,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).onConflictDoUpdate({
        target: rooms.id,
        set: { name: data.name, updatedAt: Date.now() }
      });

      Alert.alert('Success', `Joined ${data.name}!`);
      setIsJoinModalVisible(false);
      setJoinCode('');
      // Trigger re-fetch
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const stats = useMemo(() => {
    const streak = getStreak();
    const totalStudied = localStats.totalReviews;
    const totalKnown = localStats.uniqueCards;
    
    const subjects = [
      { name: 'Physics', icon: Atom, color: '#5e6ad2' },
      { name: 'Chemistry', icon: FlaskConical, color: '#3fb950' },
      { name: 'Mathematics', icon: FunctionSquare, color: '#d25e5e' },
      { name: 'Biology', icon: BookOpen, color: '#f59e0b' }
    ];

    const masteryData = subjects.map(s => {
      const subjectDecks = decks.filter(d => d.subject === s.name);
      let totalMastery = 0;
      let totalDecksWithCards = 0;
      
      subjectDecks.forEach(d => {
        if (d.cardCount > 0) {
          totalMastery += getDeckCompletionRate(d.id);
          totalDecksWithCards++;
        }
      });
      
      const avgMastery = totalDecksWithCards > 0 ? totalMastery / totalDecksWithCards : 0;
      return { ...s, mastery: Math.round(avgMastery) };
    });

    return {
      streak,
      totalStudied,
      totalKnown,
      masteryData,
      heatmap: MOCK_USER_STATS.heatmap, // Keep mock heatmap for now until we track daily counts in store
    };
  }, [decks, user, getStreak, getDeckCompletionRate, localStats]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoText}><Text style={{ color: '#5e6ad2' }}>✦</Text> Cramit.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={styles.streakPill}>
              <Flame size={16} color="#d2995e" fill="#d2995e" />
              <Text style={styles.streakText}>{stats.streak}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.streakPill, { backgroundColor: '#2a1a1a', borderColor: '#4a2a2a' }]} 
              activeOpacity={0.7}
              onPress={() => {
                logout();
                router.replace('/login');
              }}
            >
              <LogOut size={16} color="#ff5f57" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.headerTitle}>Learning Stats</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerSubtitle}>Visualize your growth over time</Text>
          </View>
        </View>

        {/* Classes Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardSectionLabel}>YOUR CLASSES</Text>
          <TouchableOpacity 
            style={styles.joinButtonSmall}
            onPress={() => setIsJoinModalVisible(true)}
          >
            <Plus size={14} color="#5e6ad2" />
            <Text style={styles.joinButtonTextSmall}>Join Class</Text>
          </TouchableOpacity>
        </View>

        {joinedRooms && joinedRooms.length > 0 ? (
          <View style={styles.roomsGrid}>
            {joinedRooms.map((room) => (
              <TouchableOpacity 
                key={room.id} 
                style={styles.roomCard}
                onPress={() => room.role === 'teacher' && router.push(`/teacher-portal/${room.id}` as any)}
              >
                <View style={styles.roomIconBox}>
                  {room.role === 'teacher' ? <Layout size={18} color="#5e6ad2" /> : <Users size={18} color="#5e6ad2" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomInfo}>Role: {room.role === 'teacher' ? 'Teacher' : 'Student'} • {room.memberCount} Members</Text>
                </View>
                {room.role === 'teacher' && <ChevronRight size={16} color="#94969a" />}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.emptyRoomCard}
            onPress={() => setIsJoinModalVisible(true)}
          >
            <Users size={24} color="#5F6166" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyRoomText}>Not in any classes yet</Text>
            <Text style={styles.emptyRoomSubtext}>Tap to join with a code</Text>
          </TouchableOpacity>
        )}

        {/* Activity Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <BarChart3 size={20} color="#5e6ad2" />
            <Text style={styles.summaryValue}>{stats.totalStudied.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>TOTAL REVIEWS</Text>
          </View>
          <View style={styles.summaryCard}>
            <Target size={20} color="#3fb950" />
            <Text style={styles.summaryValue}>{stats.totalKnown.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>UNIQUE CARDS</Text>
          </View>
        </View>

        {/* Heatmap Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionLabel}>ACTIVITY HEATMAP</Text>
            <TouchableOpacity><Text style={styles.detailText}>Last 3 Months</Text></TouchableOpacity>
          </View>
          <HeatmapGrid heatmapData={stats.heatmap} />
        </View>

        {/* Streak Section */}
        <TouchableOpacity style={styles.streakCard} activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(210, 153, 94, 0.15)', 'rgba(210, 153, 94, 0.05)']}
            style={styles.streakGradient}
          >
            <View style={styles.streakContent}>
              <View style={styles.streakIconContainer}>
                <Flame size={28} color="#d2995e" fill="#d2995e" />
              </View>
              <View>
                <Text style={styles.streakLabel}>CURRENT STREAK</Text>
                <Text style={styles.streakValue}>{stats.streak} Days</Text>
                <Text style={styles.streakSubtext}>Consistency is the key to mastery!</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#94969a" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Subject Mastery Section */}
        <View style={styles.masteryHeaderRow}>
          <Text style={styles.cardSectionLabel}>SUBJECT MASTERY</Text>
          <View style={styles.masteryLine} />
        </View>

        {stats.masteryData.map((s, index) => (
          <View key={index} style={styles.masteryItem}>
            <View style={styles.masterySubjectRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.subjectIcon, { backgroundColor: `${s.color}15` }]}>
                  <s.icon size={20} color={s.color} />
                </View>
                <View>
                  <Text style={styles.subjectTitle}>{s.name}</Text>
                  <Text style={styles.subjectSub}>SRS LEVEL PROGRESS</Text>
                </View>
              </View>
              <Text style={[styles.subjectPercent, { color: s.color }]}>{s.mastery}%</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${s.mastery}%`, backgroundColor: s.color }]} />
            </View>
          </View>
        ))}

        {/* Account Section */}
        <View style={styles.accountSection}>
          <Text style={styles.cardSectionLabel}>DEVELOPER TOOLS</Text>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => router.push("/debug-sqlite")}
          >
            <Smartphone size={20} color="#5e6ad2" />
            <Text style={[styles.logoutButtonText, { color: '#5e6ad2' }]}>Open SQLite Debugger</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.logoutButton, { marginTop: -5 }]}
            onPress={() => router.push("/debug-cards")}
          >
            <BookOpen size={20} color="#3fb950" />
            <Text style={[styles.logoutButtonText, { color: '#3fb950' }]}>Card Data Inspector</Text>
          </TouchableOpacity>

          <Text style={styles.cardSectionLabel}>ACCOUNT</Text>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => {
              logout();
              router.replace('/login');
            }}
          >
            <LogOut size={20} color="#ff5f57" />
            <Text style={styles.logoutButtonText}>Sign Out of {user?.email || 'Account'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Join Class Modal */}
      <Modal
        visible={isJoinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join a Class</Text>
            <Text style={styles.modalSub}>Enter the 6-character code provided by your teacher.</Text>
            
            <TextInput
              style={styles.joinInput}
              placeholder="CODE"
              placeholderTextColor="#5F6166"
              autoCapitalize="characters"
              maxLength={6}
              value={joinCode}
              onChangeText={setJoinCode}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setIsJoinModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.joinBtn}
                onPress={handleJoinRoom}
              >
                <Text style={styles.joinBtnText}>Join Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0C0E',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 25,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ececec',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15171B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  streakText: {
    color: '#ECECEC',
    fontFamily: 'Outfit_700Bold',
    marginLeft: 6,
    fontSize: 14,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  titleSection: {
    marginBottom: 25,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  joinButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(94, 106, 210, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(94, 106, 210, 0.2)',
  },
  joinButtonTextSmall: {
    color: '#5e6ad2',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  roomsGrid: {
    gap: 12,
    marginBottom: 30,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15171B',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  roomIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(94, 106, 210, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  roomName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 2,
  },
  roomInfo: {
    color: '#94969a',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  emptyRoomCard: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#15171B',
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#2A2C32',
    marginBottom: 30,
  },
  emptyRoomText: {
    color: '#ECECEC',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  emptyRoomSubtext: {
    color: '#5F6166',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#15171B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
    marginBottom: 20,
    lineHeight: 18,
  },
  joinInput: {
    backgroundColor: '#0B0C0E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#2A2C32',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  cancelBtnText: {
    color: '#94969a',
    fontFamily: 'Outfit_700Bold',
  },
  joinBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#5e6ad2',
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
  summaryGrid: {

    flexDirection: 'row',
    gap: 15,
    marginBottom: 25,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#15171B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2C32',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
    marginTop: 8,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 8,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#15171B',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1.5,
  },
  detailText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#5e6ad2',
  },
  streakCard: {
    borderRadius: 24,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(210, 153, 94, 0.3)',
    overflow: 'hidden',
  },
  streakGradient: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(210, 153, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  streakLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#d2995e',
    letterSpacing: 1,
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 26,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
    marginBottom: 2,
  },
  streakSubtext: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  masteryLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2C32',
    marginLeft: 15,
  },
  masteryItem: {
    backgroundColor: '#15171B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  masterySubjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subjectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  subjectTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
  },
  subjectSub: {
    fontSize: 11,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  subjectPercent: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  accountSection: {
    marginTop: 30,
    gap: 15,
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

const stylesHeatmap = StyleSheet.create({
  container: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  column: {
    gap: 6,
  },
  cell: {
    width: 13,
    height: 13,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  legendText: {
    fontSize: 10,
    color: '#94969a',
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  legendColors: {
    flexDirection: 'row',
    gap: 5,
  }
});
