import React from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Flame, Play, Atom, FlaskConical, FunctionSquare, Brain, Clock, CreditCard as Cards } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { MOCK_USER_STATS } from "@/constants/mockData";

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}><Text style={{ color: '#5e6ad2' }}>✦</Text> Cramit.</Text>
            <Text style={styles.welcomeSub}>Ready to revise, {MOCK_USER_STATS.name}?</Text>
          </View>
          <TouchableOpacity style={styles.streakPill} activeOpacity={0.7}>
            <Flame size={16} color="#d2995e" fill="#d2995e" />
            <Text style={styles.streakText}>{MOCK_USER_STATS.streak} Days</Text>
          </TouchableOpacity>
        </View>

        {/* Recommended Now */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOMMENDED NOW</Text>
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => router.push("/study/rec_1")}
          >
            <View style={styles.recommendedCard}>
              <View style={styles.recommendedHeader}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>CRITICAL RETENTION</Text>
                </View>
                <View style={styles.priorityLabel}>
                  <Brain size={12} color="#5f6166" />
                  <Text style={styles.priorityLabelText}>High Priority</Text>
                </View>
              </View>

              <View style={styles.recommendedMain}>
                <View>
                  <Text style={styles.recommendedTitle}>Physics</Text>
                  <Text style={styles.recommendedSubtitle}>Electrostatics & Current Electricity</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>REVIEWS</Text>
                  <View style={styles.statValueContainer}>
                    <Cards size={14} color="#5e6ad2" fill="#5e6ad2" />
                    <Text style={styles.statValue}>15</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>EST. TIME</Text>
                  <View style={styles.statValueContainer}>
                    <Clock size={14} color="#5e6ad2" fill="#5e6ad2" />
                    <Text style={styles.statValue}>~8m</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.startButton}>
                <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.startButtonText}>Start Revision</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Subject Queues */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OTHER SUBJECT QUEUES</Text>
          <View style={styles.grid}>
            {/* Chemistry */}
            <View style={styles.gridItem}>
              <View style={[styles.gridIcon, { backgroundColor: '#1A1F1C', borderColor: '#232925' }]}>
                <FlaskConical size={18} color="#4CD964" />
              </View>
              <Text style={styles.gridTitle}>Chemistry</Text>
              <View style={styles.gridStats}>
                <Text style={styles.gridDue}>22 Due</Text>
                <Text style={styles.gridTime}>~12m</Text>
              </View>
              <TouchableOpacity style={styles.gridButton}>
                <Text style={styles.gridButtonText}>Revise</Text>
              </TouchableOpacity>
            </View>

            {/* Maths */}
            <View style={styles.gridItem}>
              <View style={[styles.gridIcon, { backgroundColor: '#1F1A1B', borderColor: '#2E2324' }]}>
                <FunctionSquare size={18} color="#FF5F57" />
              </View>
              <Text style={styles.gridTitle}>Maths</Text>
              <View style={styles.gridStats}>
                <Text style={styles.gridWaitlist}>Waitlist</Text>
                <Text style={styles.gridDone}>Done</Text>
              </View>
              <TouchableOpacity style={[styles.gridButton, { opacity: 0.5 }]} disabled>
                <Text style={styles.gridButtonText}>Caught Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Today's Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TODAY'S ACTIVITY</Text>
          <View style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View>
                <Text style={styles.activityValue}>42/50</Text>
                <Text style={styles.activityGoalLabel}>DAILY GOAL</Text>
              </View>
              <View style={styles.chart}>
                <View style={[styles.chartBar, { height: '40%' }]} />
                <View style={[styles.chartBar, { height: '60%' }]} />
                <View style={[styles.chartBar, { height: '30%', backgroundColor: '#5e6ad2', opacity: 0.4 }]} />
                <View style={[styles.chartBar, { height: '80%', backgroundColor: '#5e6ad2', opacity: 0.6 }]} />
                <View style={[styles.chartBar, { height: '100%', backgroundColor: '#5e6ad2' }]} />
                <View style={[styles.chartBar, { height: '50%', backgroundColor: '#5e6ad2', opacity: 0.5 }]} />
                <View style={[styles.chartBar, { height: '20%', borderBottomWidth: 1, borderBottomColor: '#5e6ad2' }]} />
              </View>
            </View>

            <View style={styles.activityFooter}>
              <View>
                <Text style={styles.footerLabel}>DUE NOW</Text>
                <Text style={[styles.footerValue, { color: '#d2995e' }]}>37 Cards</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.footerLabel}>BACKLOG</Text>
                <Text style={[styles.footerValue, { color: '#d25e5e' }]}>5 Topics</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c0e',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
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
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: '#94969a',
    letterSpacing: 1,
    marginBottom: 12,
  },
  recommendedCard: {
    backgroundColor: '#15171b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  priorityBadge: {
    backgroundColor: '#2D2B4A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3E3C66',
  },
  priorityBadgeText: {
    color: '#8E96FF',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  priorityLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityLabelText: {
    color: '#5f6166',
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
  },
  recommendedMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  recommendedTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 2,
  },
  recommendedSubtitle: {
    color: '#94969a',
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  statItem: {
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    color: '#5f6166',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: '#FFFFFF',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2a2c32',
  },
  startButton: {
    backgroundColor: '#5e6ad2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#5e6ad2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    gap: 15,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#15171b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  gridIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridTitle: {
    color: '#ececec',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 12,
  },
  gridStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridDue: {
    color: '#94969a',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  gridTime: {
    color: '#5f6166',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  gridWaitlist: {
    color: '#5f6166',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  gridDone: {
    color: '#3fb950',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  gridButton: {
    backgroundColor: '#2a2c32',
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridButtonText: {
    color: '#94969a',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  activityCard: {
    backgroundColor: '#15171b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activityValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
  },
  activityGoalLabel: {
    color: '#5f6166',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 40,
  },
  chartBar: {
    width: 8,
    backgroundColor: '#2a2c32',
    borderRadius: 2,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2c32',
  },
  footerLabel: {
    color: '#5f6166',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  }
});