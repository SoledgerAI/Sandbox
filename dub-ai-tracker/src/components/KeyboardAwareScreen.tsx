// S29-A: Global keyboard-avoiding wrapper for screens with TextInput.
// Lifts content above the soft keyboard so inputs near the bottom of the
// screen (e.g. multi-line Notes fields) stay visible while typing.

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface KeyboardAwareScreenProps {
  children: React.ReactNode;
  /** Extra padding added to the bottom of the scroll content. */
  extraBottomPadding?: number;
  /** iOS only: vertical offset above the keyboard (e.g. tab bar height). */
  keyboardVerticalOffset?: number;
  contentContainerStyle?: ViewStyle;
  scrollEnabled?: boolean;
  /** Optional ref to the internal ScrollView (e.g. for scrollToEnd). */
  scrollRef?: React.RefObject<ScrollView | null>;
}

const DEFAULT_EXTRA_BOTTOM_PADDING = 24;

export function KeyboardAwareScreen({
  children,
  extraBottomPadding = DEFAULT_EXTRA_BOTTOM_PADDING,
  keyboardVerticalOffset = 0,
  contentContainerStyle,
  scrollEnabled = true,
  scrollRef,
}: KeyboardAwareScreenProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: extraBottomPadding },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default KeyboardAwareScreen;
