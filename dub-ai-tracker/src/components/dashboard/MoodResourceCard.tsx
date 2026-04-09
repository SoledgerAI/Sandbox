// Mood resource card — warm, non-alarming crisis resource surfacing
// Wave 2 P1: Automated mood-trend detection
//
// SAFETY DESIGN DECISIONS:
// - Warm navy card with subtle gold border — NOT red, NOT alarming
// - No mood scores displayed — user should not feel surveilled
// - No clinical language — no "depressed," "suicidal," "mental illness"
// - Card is dismissable for 48 hours — never un-dismissable
// - Veterans Crisis Line shown only when profile indicates recovery goal
// - Resources open native phone/SMS — no in-app browser
// - Card appears at TOP of dashboard for visibility

import { StyleSheet, Text, View, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface MoodResourceCardProps {
  showVeteransLine: boolean;
  onDismiss: () => void;
}

function openPhone(number: string): void {
  Linking.openURL(`tel:${number}`);
}

function openSMS(number: string): void {
  // iOS uses &, Android uses ?
  const separator = Platform.OS === 'ios' ? '&' : '?';
  Linking.openURL(`sms:${number}${separator}body=HELLO`);
}

export function MoodResourceCard({ showVeteransLine, onDismiss }: MoodResourceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="heart-outline" size={20} color={Colors.accentText} />
        <Text style={styles.headerText}>We noticed things have been tough.</Text>
      </View>

      <Text style={styles.message}>
        You're not alone. Reaching out is a sign of strength.
      </Text>

      {/* 988 Suicide & Crisis Lifeline */}
      <TouchableOpacity
        style={styles.resourceBtn}
        onPress={() => openPhone('988')}
        activeOpacity={0.7}
      >
        <Ionicons name="call-outline" size={18} color={Colors.accentText} />
        <View style={styles.resourceInfo}>
          <Text style={styles.resourceTitle}>Talk to Someone</Text>
          <Text style={styles.resourceDetail}>988 Suicide & Crisis Lifeline</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
      </TouchableOpacity>

      {/* Crisis Text Line */}
      <TouchableOpacity
        style={styles.resourceBtn}
        onPress={() => openSMS('741741')}
        activeOpacity={0.7}
      >
        <Ionicons name="chatbubble-outline" size={18} color={Colors.accentText} />
        <View style={styles.resourceInfo}>
          <Text style={styles.resourceTitle}>Crisis Text Line</Text>
          <Text style={styles.resourceDetail}>Text HELLO to 741741</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
      </TouchableOpacity>

      {/* Veterans Crisis Line — conditional */}
      {showVeteransLine && (
        <TouchableOpacity
          style={styles.resourceBtn}
          onPress={() => openPhone('18002738255')}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-outline" size={18} color={Colors.accentText} />
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceTitle}>Veterans Crisis Line</Text>
            <Text style={styles.resourceDetail}>1-800-273-8255, Press 1</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
        </TouchableOpacity>
      )}

      {/* Dismiss — 48 hour snooze */}
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={onDismiss}
        activeOpacity={0.7}
      >
        <Text style={styles.dismissText}>Not right now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1D2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  message: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  resourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  resourceDetail: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 1,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    minHeight: 44,
  },
  dismissText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
});
