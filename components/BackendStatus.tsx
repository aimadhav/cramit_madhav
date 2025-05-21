import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { trpc } from '@/lib/trpc';
import colors from '@/constants/colors';

export default function BackendStatus() {
  const [isExpanded, setIsExpanded] = useState(false);
  const greeting = trpc.example.hi.useQuery({ name: "Flashcard User" });

  return (
    <TouchableOpacity 
      style={[styles.container, greeting.isError && styles.errorContainer]}
      onPress={() => setIsExpanded(!isExpanded)}
      activeOpacity={0.7}
    >
      <View style={styles.statusRow}>
        <View style={[
          styles.statusIndicator, 
          greeting.isLoading ? styles.loadingIndicator : 
          greeting.isError ? styles.errorIndicator : 
          styles.successIndicator
        ]} />
        
        <Text style={styles.statusText}>
          {greeting.isLoading ? 'Connecting to backend...' : 
           greeting.isError ? 'Backend connection error' : 
           'Backend connected'}
        </Text>
        
        {greeting.isLoading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
      </View>
      
      {isExpanded && greeting.isError && (
        <View style={styles.errorDetails}>
          <Text style={styles.errorText}>
            {greeting.error?.message || 'Failed to connect to backend service'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => greeting.refetch()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isExpanded && greeting.isSuccess && (
        <View style={styles.successDetails}>
          <Text style={styles.successText}>
            {greeting.data.greeting}
          </Text>
          <Text style={styles.timestampText}>
            Last updated: {new Date(greeting.data.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray[50],
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  errorContainer: {
    borderColor: colors.error,
    backgroundColor: '#FEF2F2',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  loadingIndicator: {
    backgroundColor: colors.warning,
  },
  successIndicator: {
    backgroundColor: colors.success,
  },
  errorIndicator: {
    backgroundColor: colors.error,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textDark,
    flex: 1,
  },
  loader: {
    marginLeft: 8,
  },
  errorDetails: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: colors.error,
    padding: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  successDetails: {
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.gray[100],
    borderRadius: 4,
  },
  successText: {
    fontSize: 12,
    color: colors.textDark,
  },
  timestampText: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 4,
  },
});