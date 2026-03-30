// Shared keyboard-aware wrapper for screens with text inputs + bottom buttons
// Task C: Prompt 07 v2

import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface KeyboardAwareScreenProps {
  children: ReactNode;
  keyboardVerticalOffset?: number;
  contentContainerStyle?: object;
}

export function KeyboardAwareScreen({
  children,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 90 : 0,
  contentContainerStyle,
}: KeyboardAwareScreenProps) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
});
