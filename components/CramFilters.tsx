import React from 'react';
import { StyleSheet, View, TouchableOpacity, } from 'react-native';
import { Text } from './AppText';
import { FunctionSquare, Lightbulb, Files, AlertCircle ,Bookmark} from 'lucide-react-native';
import { MOCK_CONTENT_TYPES } from '@/constants/mockData';

interface CramFiltersProps {
  selectedContentTypes: string[];
  onToggleContentType: (id: string) => void;
}

export const CramFilters: React.FC<CramFiltersProps> = ({
  selectedContentTypes,
  onToggleContentType,
}) => {
  return (
    <View style={styles.configPanel}>
      <Text style={styles.stepLabel}>1. CHOOSE FILTERS (OPTIONAL)</Text>
      <View style={styles.chipsContainer}>
        {MOCK_CONTENT_TYPES.map((type) => {
          const isSelected = selectedContentTypes.includes(type.id);
          return (
            <TouchableOpacity 
              key={type.id}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => onToggleContentType(type.id)}
            >
              {type.label === 'Formulas' && <FunctionSquare size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
              {type.label === 'Concepts' && <Lightbulb size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
              {type.label === 'Bookmarks' && <Bookmark size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
              {type.label === 'Mistakes' && <AlertCircle size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{type.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  configPanel: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2C32',
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#5F6166',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#15171B',
    borderWidth: 1,
    borderColor: '#2A2C32',
    gap: 8,
  },
  chipActive: {
    backgroundColor: '#ECECEC',
    borderColor: '#ECECEC',
  },
  chipText: {
    color: '#94969A',
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#0B0C0E',
    fontFamily: 'Outfit_700Bold',
  },
});
