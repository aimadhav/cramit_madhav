import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { Plus, Layout, Users, ChevronRight } from 'lucide-react-native';

interface ClassesSectionProps {
  joinedRooms: any[];
  onJoinPress: () => void;
  onRoomPress: (room: any) => void;
}

export const ClassesSection: React.FC<ClassesSectionProps> = ({
  joinedRooms,
  onJoinPress,
  onRoomPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.cardSectionLabel}>YOUR CLASSES</Text>
        <TouchableOpacity 
          style={styles.joinButtonSmall}
          onPress={onJoinPress}
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
              onPress={() => onRoomPress(room)}
            >
              <View style={styles.roomIconBox}>
                {room.role === 'teacher' ? <Layout size={18} color="#5e6ad2" /> : <Users size={18} color="#5e6ad2" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomInfo}>
                  Role: {room.role === 'teacher' ? 'Teacher' : 'Student'} • {room.memberCount} Members
                </Text>
              </View>
              {room.role === 'teacher' && <ChevronRight size={16} color="#94969a" />}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.emptyRoomCard}
          onPress={onJoinPress}
        >
          <Users size={24} color="#5F6166" style={{ marginBottom: 8 }} />
          <Text style={styles.emptyRoomText}>Not in any classes yet</Text>
          <Text style={styles.emptyRoomSubtext}>Tap to join with a code</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1.5,
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
});
