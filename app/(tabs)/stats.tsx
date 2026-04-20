import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Image } from 'react-native';
import { Text } from '@/components/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flame, Atom, FlaskConical, FunctionSquare, ChevronRight, BarChart3, Target } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MOCK_USER_STATS } from '@/constants/mockData';

const { width } = Dimensions.get('window');

// Helper to render heatmap
const HeatmapGrid = ({ colors }: { colors: any }) => {
  const columns = 14; 
  const rows = 7;
  
  return (
    <View style={stylesHeatmap.container}>
      <View style={stylesHeatmap.grid}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <View key={`col-${colIndex}`} style={stylesHeatmap.column}>
            {Array.from({ length: rows }).map((_, rowIndex) => {
              const dataIndex = colIndex * rows + rowIndex;
              const intensity = MOCK_USER_STATS.heatmap[dataIndex] || 0;
              
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
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image 
            source={require("@/assets/images/finallogo.png")} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <View style={styles.streakPill}>
            <Flame size={16} color="#d2995e" fill="#d2995e" />
            <Text style={styles.streakText}>{MOCK_USER_STATS.streak}</Text>
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.headerTitle}>Learning Stats</Text>
          <Text style={styles.headerSubtitle}>Visualize your growth over time</Text>
        </View>

        {/* Activity Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <BarChart3 size={20} color="#5e6ad2" />
            <Text style={styles.summaryValue}>1,240</Text>
            <Text style={styles.summaryLabel}>TOTAL CARDS</Text>
          </View>
          <View style={styles.summaryCard}>
            <Target size={20} color="#3fb950" />
            <Text style={styles.summaryValue}>82%</Text>
            <Text style={styles.summaryLabel}>ACCURACY</Text>
          </View>
        </View>

        {/* Heatmap Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionLabel}>ACTIVITY HEATMAP</Text>
            <TouchableOpacity><Text style={styles.detailText}>Last 3 Months</Text></TouchableOpacity>
          </View>
          <HeatmapGrid colors={colors} />
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
                <Text style={styles.streakValue}>{MOCK_USER_STATS.streak} Days</Text>
                <Text style={styles.streakSubtext}>Top 5% of all learners!</Text>
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

        {/* Physics Mastery */}
        <View style={styles.masteryItem}>
          <View style={styles.masterySubjectRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.subjectIcon, { backgroundColor: 'rgba(94, 106, 210, 0.1)' }]}>
                <Atom size={20} color="#5e6ad2" />
              </View>
              <View>
                <Text style={styles.subjectTitle}>Physics</Text>
                <Text style={styles.subjectSub}>14/24 CHAPTERS</Text>
              </View>
            </View>
            <Text style={[styles.subjectPercent, { color: '#5e6ad2' }]}>64%</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '64%', backgroundColor: '#5e6ad2' }]} />
          </View>
        </View>

        {/* Chemistry Mastery */}
        <View style={styles.masteryItem}>
          <View style={styles.masterySubjectRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.subjectIcon, { backgroundColor: 'rgba(63, 185, 80, 0.1)' }]}>
                <FlaskConical size={20} color="#3fb950" />
              </View>
              <View>
                <Text style={styles.subjectTitle}>Chemistry</Text>
                <Text style={styles.subjectSub}>9/22 CHAPTERS</Text>
              </View>
            </View>
            <Text style={[styles.subjectPercent, { color: '#3fb950' }]}>42%</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '42%', backgroundColor: '#3fb950' }]} />
          </View>
        </View>

        {/* Maths Mastery */}
        <View style={styles.masteryItem}>
          <View style={styles.masterySubjectRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.subjectIcon, { backgroundColor: 'rgba(210, 94, 94, 0.1)' }]}>
                <FunctionSquare size={20} color="#d25e5e" />
              </View>
              <View>
                <Text style={styles.subjectTitle}>Mathematics</Text>
                <Text style={styles.subjectSub}>21/28 CHAPTERS</Text>
              </View>
            </View>
            <Text style={[styles.subjectPercent, { color: '#d25e5e' }]}>78%</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '78%', backgroundColor: '#d25e5e' }]} />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  logo: {
    width: 90,
    height: 28,
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
    marginTop: 2,
    fontFamily: 'Outfit_500Medium',
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