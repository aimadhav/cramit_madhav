import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';

interface HeatmapGridProps {
  heatmapData: number[];
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({ heatmapData }) => {
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
