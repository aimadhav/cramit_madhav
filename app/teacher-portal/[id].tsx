import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Share } from 'react-native';
import { Text } from '@/components/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, Flame, CreditCard as Cards, ChevronRight, Share2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function TeacherPortalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [portalData, setPortalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPortalData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        // Fetch room info
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', id)
          .single();
        
        if (roomError) throw roomError;

        // Fetch students in this room
        const { data: memberships, error: memError } = await supabase
          .from('room_memberships')
          .select('user_id, role, users(id, email, name, streak_days, total_cards_studied, last_study_date)')
          .eq('room_id', id);

        if (memError) throw memError;

        const students = memberships
          .filter(m => m.role === 'student')
          .map(m => m.users);

        setPortalData({ room, students });
      } catch (error: any) {
        console.error('Teacher Portal Error:', error.message);
        Alert.alert('Error', 'Failed to load class data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortalData();
  }, [id]);

  const handleShareCode = async () => {
    if (portalData?.room.code) {
      try {
        await Share.share({
          message: `Join my class "${portalData.room.name}" on Cramit! Use code: ${portalData.room.code}`,
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to share the code.');
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5e6ad2" />
      </View>
    );
  }

  if (!portalData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Could not load class data.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{portalData.room.name}</Text>
          <Text style={styles.headerSub}>Teacher Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={handleShareCode}>
          <Share2 size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Class Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.codeContainer}>
            <View>
              <Text style={styles.codeLabel}>JOIN CODE</Text>
              <Text style={styles.codeValue}>{portalData.room.code}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleShareCode}>
              <Text style={styles.copyBtnText}>SHARE</Text>
            </TouchableOpacity>
          </View>
          {portalData.room.description && (
            <Text style={styles.description}>{portalData.room.description}</Text>
          )}
        </View>

        {/* Stats Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CLASS SUMMARY</Text>
        </View>
        
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Users size={20} color="#5e6ad2" />
            <Text style={styles.summaryValue}>{portalData.students.length}</Text>
            <Text style={styles.summaryLabel}>STUDENTS</Text>
          </View>
          <View style={styles.summaryCard}>
            <Flame size={20} color="#d2995e" />
            <Text style={styles.summaryValue}>
              {portalData.students.length > 0 
                ? Math.round(portalData.students.reduce((acc: number, s: any) => acc + (Number(s.streak_days) || 0), 0) / portalData.students.length)
                : 0}
            </Text>
            <Text style={styles.summaryLabel}>AVG. STREAK</Text>
          </View>
        </View>

        {/* Student List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>STUDENT PROGRESS</Text>
        </View>

        {portalData.students.length === 0 ? (
          <View style={styles.emptyStudents}>
            <Users size={40} color="#2A2C32" style={{ marginBottom: 15 }} />
            <Text style={styles.emptyText}>No students have joined yet.</Text>
            <Text style={styles.emptySub}>Share the join code to get started!</Text>
          </View>
        ) : (
          <View style={styles.studentList}>
            {portalData.students.map((student: any) => (
              <View key={student.id} style={styles.studentCard}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.avatarText}>{student.name?.charAt(0) || student.email?.charAt(0)}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name || student.email}</Text>
                  <View style={styles.studentMeta}>
                    <View style={styles.metaItem}>
                      <Flame size={12} color="#d2995e" fill="#d2995e" />
                      <Text style={styles.metaText}>{student.streak_days || 0}d</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Cards size={12} color="#5e6ad2" fill="#5e6ad2" />
                      <Text style={styles.metaText}>{student.total_cards_studied || 0} Cards</Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.lastStudyLabel}>LAST ACTIVE</Text>
                  <Text style={styles.lastStudyDate}>
                    {student.last_study_date ? new Date(student.last_study_date).toLocaleDateString() : 'Never'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C0E',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0C0E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff5f57',
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#15171B',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2C32',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#15171B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 11,
    color: '#5e6ad2',
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#15171B',
    borderRadius: 24,
    padding: 24,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2C32',
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 32,
    fontFamily: 'monospace',
    color: '#FFFFFF',
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  copyBtn: {
    backgroundColor: '#5e6ad2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },
  description: {
    color: '#94969a',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Outfit_500Medium',
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1.5,
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
    fontSize: 22,
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
  studentList: {
    gap: 12,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15171B',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2D2B4A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#8E96FF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 4,
  },
  studentMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#94969a',
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  lastStudyLabel: {
    fontSize: 8,
    fontFamily: 'Outfit_700Bold',
    color: '#5F6166',
    marginBottom: 4,
  },
  lastStudyDate: {
    fontSize: 10,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
  },
  emptyStudents: {
    alignItems: 'center',
    paddingVertical: 50,
    backgroundColor: '#15171B',
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  emptyText: {
    color: '#ECECEC',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  emptySub: {
    color: '#94969a',
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    marginTop: 4,
  }
});
