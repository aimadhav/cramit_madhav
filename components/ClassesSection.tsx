import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Layout, Plus, Users } from 'lucide-react-native';

import { Text } from './AppText';

export interface JoinedClass {
  id: string;
  name: string;
  role: string;
  memberCount: number;
}

interface ClassesSectionProps {
  joinedRooms: JoinedClass[];
  onJoinPress: () => void;
  onRoomPress: (room: JoinedClass) => void;
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  canJoin?: boolean;
}

export const ClassesSection: React.FC<ClassesSectionProps> = ({
  joinedRooms,
  onJoinPress,
  onRoomPress,
  isLoading = false,
  error = false,
  onRetry,
  canJoin = true,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.cardSectionLabel}>YOUR CLASSES</Text>
        {canJoin && (
          <TouchableOpacity style={styles.joinButtonSmall} onPress={onJoinPress}>
            <Plus size={14} color="#6c7bff" />
            <Text style={styles.joinButtonTextSmall}>Join Class</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && joinedRooms.length === 0 ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#6c7bff" />
          <Text style={styles.statusText}>Loading classes…</Text>
        </View>
      ) : error && joinedRooms.length === 0 ? (
        <TouchableOpacity style={styles.statusRow} onPress={onRetry}>
          <Users size={18} color="#94969a" />
          <View style={styles.statusCopy}>
            <Text style={styles.emptyRoomText}>Classes unavailable</Text>
            <Text style={styles.emptyRoomSubtext}>Tap to retry</Text>
          </View>
        </TouchableOpacity>
      ) : joinedRooms.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomsGrid}>
          {joinedRooms.map((room) => (
            <TouchableOpacity key={room.id} style={styles.roomCard} onPress={() => onRoomPress(room)}>
              <View style={styles.roomIconBox}>
                {room.role === 'teacher'
                  ? <Layout size={18} color="#6c7bff" />
                  : <Users size={18} color="#6c7bff" />}
              </View>
              <View style={styles.roomCopy}>
                <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
                <Text style={styles.roomInfo} numberOfLines={1}>
                  {room.role === 'teacher' ? 'Teacher' : 'Student'} · {room.memberCount} {room.memberCount === 1 ? 'student' : 'students'}
                </Text>
              </View>
              {room.role === 'teacher' && <ChevronRight size={16} color="#94969a" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : !canJoin ? (
        <View style={styles.emptyRoomCard}>
          <Users size={20} color="#5F6166" />
          <View style={styles.statusCopy}>
            <Text style={styles.emptyRoomText}>Classes need an account</Text>
            <Text style={styles.emptyRoomSubtext}>Sign in to join and sync a class</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.emptyRoomCard} onPress={onJoinPress}>
          <Users size={20} color="#5F6166" />
          <View style={styles.statusCopy}>
            <Text style={styles.emptyRoomText}>Not in a class yet</Text>
            <Text style={styles.emptyRoomSubtext}>Join with a six-character code</Text>
          </View>
          <ChevronRight size={16} color="#5F6166" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  cardSectionLabel: { fontSize: 9, fontFamily: 'Outfit_700Bold', color: '#777b84', letterSpacing: 1.3 },
  joinButtonSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6c7bff12', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#6c7bff28' },
  joinButtonTextSmall: { color: '#8e98ff', fontSize: 10, fontFamily: 'Outfit_700Bold' },
  roomsGrid: { gap: 10, paddingRight: 20 },
  roomCard: { width: 238, flexDirection: 'row', alignItems: 'center', backgroundColor: '#15171B', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#2A2C32' },
  roomIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#6c7bff12', justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  roomCopy: { flex: 1, minWidth: 0 },
  roomName: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Outfit_700Bold', marginBottom: 2 },
  roomInfo: { color: '#7f828b', fontSize: 10, fontFamily: 'Outfit_500Medium' },
  emptyRoomCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#15171B', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#2A2C32' },
  emptyRoomText: { color: '#ECECEC', fontSize: 13, fontFamily: 'Outfit_700Bold' },
  emptyRoomSubtext: { color: '#62656d', fontSize: 10, fontFamily: 'Outfit_500Medium', marginTop: 1 },
  statusRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, backgroundColor: '#15171B', borderRadius: 16, borderWidth: 1, borderColor: '#2A2C32' },
  statusCopy: { flex: 1 },
  statusText: { color: '#94969a', fontSize: 12, fontFamily: 'Outfit_500Medium' },
});
