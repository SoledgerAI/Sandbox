// Settings > Privacy Policy
// Full scrollable privacy policy screen (Finding 72-1)

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';

const SECTIONS = [
  {
    title: 'What Data We Collect',
    body: `DUB_AI Tracker collects and stores the following data categories based on your usage:

• Profile data (name, date of birth, sex, height, weight, activity level, goals)
• Nutrition logs (food, water, caffeine, supplements)
• Fitness logs (workouts, strength sessions)
• Body measurements (weight, body composition, bloodwork, blood glucose, blood pressure)
• Mind & wellness logs (mood, stress, gratitude, meditation, therapy notes, substances)
• Health logs (sleep, cycle, digestive, injury, sexual health, self care)
• Custom tags you create
• Coach DUB conversation history
• App settings and preferences`,
  },
  {
    title: 'How Data Is Stored',
    body: `All your health data is stored locally on your device using AsyncStorage and SecureStore (iOS Keychain / Android Keystore). Your data never leaves your device unless you explicitly choose to export it or use the AI Coach feature.

• No cloud storage or server-side databases
• No user accounts or registration required
• Your API key is stored in encrypted secure storage
• Exported data (PDF reports, CSV) is generated locally on your device`,
  },
  {
    title: 'When Data Is Transmitted',
    body: `Data is only transmitted from your device in the following circumstances:

• AI Coach conversations: When you use Coach DUB, your health context summary and messages are sent to Anthropic, PBC for processing. Anthropic processes this data to generate Coach responses and does not store your data beyond the conversation session.
• Food search: When searching for foods, queries are sent to USDA FoodData Central, Open Food Facts, or FatSecret APIs to retrieve nutritional information.
• No data is transmitted for any other feature.`,
  },
  {
    title: 'Third-Party Services',
    body: `DUB_AI integrates with the following third-party services:

• Anthropic API — Powers the AI Coach feature. Your health context and messages are transmitted for processing. Subject to Anthropic's usage policy.
• USDA FoodData Central — Food nutrition database searches.
• Open Food Facts — Barcode scanning and food product data.
• FatSecret API — Additional food nutrition data.
• Apple HealthKit / Health Connect — Optional device health data sync (steps, heart rate, sleep). Data flows from these services to DUB_AI only.
• Instacart — Optional grocery list links. No personal data is shared.`,
  },
  {
    title: 'Your Rights',
    body: `You have full control over your data at all times:

• Export all data: Settings > Export lets you generate a complete export of your health data.
• Delete all data: Settings > About > Delete My Data permanently removes all stored data from your device.
• No account required: DUB_AI does not require registration, login, or any personally identifiable information to function.
• No data sold or shared: Your health data is never sold, shared with advertisers, or used for any purpose other than providing the app's features to you.
• Therapy notes are never transmitted to any third party, including the AI Coach.`,
  },
  {
    title: 'Contact',
    body: `For privacy-related questions or concerns:

Email: privacy@soledgerai.com
Company: SoledgerAI Inc.`,
  },
  {
    title: 'Effective Date',
    body: 'This privacy policy is effective as of April 2026.',
  },
  {
    title: 'Changes to This Policy',
    body: 'We will notify you of any material changes to this privacy policy via an app update. Continued use of the app after an update constitutes acceptance of the revised policy.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.appName}>DUB_AI Tracker</Text>
      <Text style={styles.subtitle}>Your data, your device, your control.</Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
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
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  appName: {
    color: Colors.accentText,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionBody: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
});
