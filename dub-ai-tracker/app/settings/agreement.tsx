// Settings > User Agreement
// Sprint 8 Fix 4: Single location for full disclaimer/agreement text

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';

const AGREEMENT_SECTIONS = [
  {
    title: 'AI Wellness Assistant',
    text: 'Coach DUB is an AI-powered wellness assistant. It is NOT a licensed healthcare provider, dietitian, therapist, or certified trainer. Coach DUB does not diagnose conditions, prescribe treatments, or provide medical advice. Do not use it for medical emergencies, diagnosis, or treatment decisions.',
  },
  {
    title: 'Data Storage & Privacy',
    text: 'Health data you log in DUB_AI Tracker is stored locally on your device. When you use Coach DUB, a summary of your logged data (profile information, daily entries, and 7-day rolling averages) is sent to Anthropic for AI processing. Raw device data from connected health apps (Apple Health, Google Health Connect) is never transmitted to third parties. Therapy session notes are never shared — only a yes/no session flag is included.',
  },
  {
    title: 'Not Medical Advice',
    text: 'DUB_AI Tracker and Coach DUB are wellness tools, not substitutes for professional medical advice, diagnosis, or treatment. Always consult qualified healthcare professionals for medical decisions. If you are experiencing a medical emergency, call 911 or your local emergency number.',
  },
  {
    title: 'User Responsibility',
    text: 'You assume responsibility for health and lifestyle decisions made using information from this app. DUB_AI Tracker provides data tracking and AI-generated wellness guidance to support your goals, but final decisions about your health are yours alone.',
  },
  {
    title: 'Age Requirement',
    text: 'DUB_AI Tracker is designed for adults 18 years of age and older.',
  },
];

export default function AgreementScreen() {
  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>User Agreement</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.intro}>
          By using DUB_AI Tracker, you agreed to the following terms during onboarding.
        </Text>

        {AGREEMENT_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionText}>{section.text}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  intro: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  section: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionText: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
});
