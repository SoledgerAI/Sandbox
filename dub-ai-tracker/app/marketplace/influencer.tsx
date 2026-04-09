// Influencer storefront screen
// Phase 22: Marketplace, Influencer System, and Polish
// Stub UI with application flow and dual FTC disclosure

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { Colors } from '../../src/constants/colors';
import { InfluencerStorefrontView, InfluencerApplicationForm } from '../../src/components/marketplace/InfluencerStorefront';

export default function InfluencerScreen() {
  const { id, apply } = useLocalSearchParams<{ id?: string; apply?: string }>();

  const showApplication = apply === 'true';

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {showApplication ? 'Apply' : 'Influencer'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {showApplication ? (
        <InfluencerApplicationForm />
      ) : (
        <InfluencerStorefrontView influencerId={id} />
      )}
    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
});
