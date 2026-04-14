// Sprint 22: 988 Suicide & Crisis Lifeline — always-visible support banner
// SAFETY: This banner is ALWAYS rendered. Never gate behind mood score or any threshold.

import { StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TEAL = '#008B8B';

export function CrisisSupport988() {
  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <Ionicons name="heart" size={18} color="#FFFFFF" />
        <Text style={styles.headerText}>If you're in crisis or need support</Text>
      </View>

      <Text style={styles.lifelineName}>988 Suicide & Crisis Lifeline</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => Linking.openURL('tel:988')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Call 988"
        >
          <Ionicons name="call-outline" size={16} color="#008B8B" />
          <Text style={styles.actionText}>Call 988</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => Linking.openURL('sms:988')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Text 988"
        >
          <Ionicons name="chatbubble-outline" size={16} color="#008B8B" />
          <Text style={styles.actionText}>Text 988</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => Linking.openURL('https://988lifeline.org/chat/')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Chat at 988lifeline.org"
        >
          <Ionicons name="globe-outline" size={16} color="#008B8B" />
          <Text style={styles.actionText}>Chat</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.availabilityText}>Available 24/7 — Free & Confidential</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: TEAL,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  lifelineName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionText: {
    color: TEAL,
    fontSize: 13,
    fontWeight: '700',
  },
  availabilityText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    textAlign: 'center',
  },
});
