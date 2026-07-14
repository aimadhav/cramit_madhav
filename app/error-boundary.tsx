import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/AppText';
import { reportError } from '@/lib/monitoring';

interface Props {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError(error, { componentStack: errorInfo.componentStack ?? undefined });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>Your study data is safe. Try opening the screen again.</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={this.reset}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0B0F',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9A9DA7',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: { marginTop: 18, borderRadius: 13, backgroundColor: '#5e6ad2', paddingHorizontal: 22, paddingVertical: 12 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Outfit_700Bold' },
}); 

export default ErrorBoundary;
