// Anthropic data consent modal for Coach DUB
// MASTER-05: Users must consent before PII is transmitted to Anthropic
// Consent is stored with version tracking for re-consent on policy changes

import { useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export const CONSENT_VERSION = '1.0';

interface AnthropicConsentModalProps {
  visible: boolean;
  onConsent: () => void;
}

export function AnthropicConsentModal({ visible, onConsent }: AnthropicConsentModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>AI Coach Data Notice</Text>

            <Text style={styles.body}>
              When you use Coach DUB, the following data is sent to Anthropic (a third-party AI
              service) for processing:
            </Text>

            <View style={styles.bulletList}>
              <Text style={styles.bullet}>
                {'\u2022'} Your profile information (name, age, biological sex, height, weight)
              </Text>
              <Text style={styles.bullet}>
                {'\u2022'} Today's logged health data (calories, macros, water, exercise, mood,
                sleep, recovery score)
              </Text>
              <Text style={styles.bullet}>{'\u2022'} Your 7-day rolling averages</Text>
              <Text style={styles.bullet}>
                {'\u2022'} Active injuries, supplement flags, and sobriety goals
              </Text>
              <Text style={styles.bullet}>{'\u2022'} Your typed messages</Text>
            </View>

            <Text style={styles.body}>
              This data is transmitted using your personal API key. Anthropic processes this data
              solely to generate Coach responses.
            </Text>

            <View style={styles.links}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://www.anthropic.com/privacy')}
              >
                <Text style={styles.link}>Anthropic Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://dubaitracker.com/privacy')}
              >
                <Text style={styles.link}>DUB_AI Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setChecked(!checked)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? Colors.accent : Colors.secondaryText}
              />
              <Text style={styles.checkboxLabel}>
                I understand and consent to this data processing.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, !checked && styles.buttonDisabled]}
              onPress={onConsent}
              disabled={!checked}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, !checked && styles.buttonTextDisabled]}>
                Continue to Coach
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: {
    gap: 6,
    marginBottom: 12,
    paddingLeft: 4,
  },
  bullet: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  links: {
    gap: 8,
    marginBottom: 20,
  },
  link: {
    color: Colors.accent,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  checkboxLabel: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.divider,
  },
  buttonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: Colors.secondaryText,
  },
});
