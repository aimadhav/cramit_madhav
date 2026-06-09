import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/AppText';
import { Stack } from 'expo-router';
import { DatabaseService } from '@/services/database-service';
import { useUserStore } from '@/store/user-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Table, Bookmark, FileText, Calendar, RefreshCcw } from 'lucide-react-native';

export default function DebugCardsScreen() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const userId = useUserStore(state => state.user?.id) || 'local';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await DatabaseService.getDebugCardData(userId);
      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatFront = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return parsed[0]?.value || content;
    } catch {
      return content;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Card Data Inspector', headerTitleStyle: { fontFamily: 'Outfit_700Bold' } }} />
      
      <View style={styles.header}>
        <Text style={styles.countText}>Showing {data.length} total cards for UID: {userId.substring(0, 8)}...</Text>
        <TouchableOpacity onPress={fetchData} style={styles.refreshBtn}>
          <RefreshCcw size={16} color="#5e6ad2" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#5e6ad2" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Table Header */}
            <View style={styles.row}>
              <View style={[styles.cell, styles.headerCell, { width: 150 }]}><Text style={styles.headerText}>CARD FRONT</Text></View>
              <View style={[styles.cell, styles.headerCell, { width: 60 }]}><Bookmark size={14} color="#94969a" /></View>
              <View style={[styles.cell, styles.headerCell, { width: 100 }]}><Text style={styles.headerText}>NOTE</Text></View>
              <View style={[styles.cell, styles.headerCell, { width: 60 }]}><Text style={styles.headerText}>REPS</Text></View>
              <View style={[styles.cell, styles.headerCell, { width: 80 }]}><Text style={styles.headerText}>STAB.</Text></View>
              <View style={[styles.cell, styles.headerCell, { width: 120 }]}><Text style={styles.headerText}>DUE DATE</Text></View>
            </View>

            {/* Table Body */}
            <ScrollView style={{ flex: 1 }}>
              {data.map((item, index) => (
                <View key={index} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <View style={[styles.cell, { width: 150 }]}>
                    <Text style={styles.cellText} numberOfLines={1}>{formatFront(item.front)}</Text>
                  </View>
                  <View style={[styles.cell, { width: 60, alignItems: 'center' }]}>
                    <Text style={styles.cellText}>{item.isBookmarked ? '⭐' : '—'}</Text>
                  </View>
                  <View style={[styles.cell, { width: 100 }]}>
                    <Text style={[styles.cellText, !item.notes && { color: '#333' }]} numberOfLines={1}>
                      {item.notes || 'None'}
                    </Text>
                  </View>
                  <View style={[styles.cell, { width: 60, alignItems: 'center' }]}>
                    <Text style={styles.cellText}>{item.repetitions || 0}</Text>
                  </View>
                  <View style={[styles.cell, { width: 80, alignItems: 'center' }]}>
                    <Text style={styles.cellText}>{item.stability?.toFixed(2) || '0.00'}</Text>
                  </View>
                  <View style={[styles.cell, { width: 120 }]}>
                    <Text style={styles.cellText}>
                      {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'New'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1B1F',
  },
  countText: {
    color: '#94969a',
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  refreshBtn: {
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1B1F',
  },
  rowAlt: {
    backgroundColor: '#0A0A0A',
  },
  cell: {
    padding: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1A1B1F',
  },
  headerCell: {
    backgroundColor: '#15171B',
  },
  headerText: {
    color: '#5F6166',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  cellText: {
    color: '#ECECEC',
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
});
