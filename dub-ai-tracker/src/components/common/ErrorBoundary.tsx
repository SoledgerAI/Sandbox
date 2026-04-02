import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Colors } from '../../constants/colors';
// DEBUG: REMOVE BEFORE PRODUCTION — import debug log
import { getDebugLog } from '../DebugOverlay';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  // DEBUG: REMOVE BEFORE PRODUCTION
  errorStack: string;
  componentStack: string;
  debugLog: string[];
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    // DEBUG: REMOVE BEFORE PRODUCTION — added stack/log fields
    this.state = { hasError: false, errorMessage: '', errorStack: '', componentStack: '', debugLog: [] };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // DEBUG: REMOVE BEFORE PRODUCTION — capture stack + debug log
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
      errorStack: error.stack || '',
      debugLog: getDebugLog(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // DEBUG: REMOVE BEFORE PRODUCTION — capture component stack
    this.setState({ componentStack: errorInfo.componentStack || '' });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '', errorStack: '', componentStack: '', debugLog: [] });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        // DEBUG: REMOVE BEFORE PRODUCTION — full-screen red error display
        <View style={styles.crashContainer}>
          <ScrollView contentContainerStyle={styles.crashScroll}>
            <Text style={styles.crashTitle}>CRASH CAUGHT</Text>
            <Text style={styles.crashLabel}>Error:</Text>
            <Text style={styles.crashMessage}>{this.state.errorMessage}</Text>
            <Text style={styles.crashLabel}>Stack:</Text>
            <Text style={styles.crashStack}>{this.state.errorStack}</Text>
            {this.state.componentStack ? (
              <>
                <Text style={styles.crashLabel}>Component Stack:</Text>
                <Text style={styles.crashStack}>{this.state.componentStack}</Text>
              </>
            ) : null}
            <Text style={styles.crashLabel}>Debug Log:</Text>
            {this.state.debugLog.map((entry, i) => (
              <Text key={i} style={styles.crashStack}>{entry}</Text>
            ))}
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  // DEBUG: REMOVE BEFORE PRODUCTION — crash display styles
  crashContainer: {
    flex: 1,
    backgroundColor: '#CC0000',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  crashScroll: {
    padding: 16,
    paddingBottom: 60,
  },
  crashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  crashLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFF00',
    marginTop: 12,
    marginBottom: 4,
  },
  crashMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  crashStack: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: Colors.secondaryText,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 24,
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CC0000',
  },
});
