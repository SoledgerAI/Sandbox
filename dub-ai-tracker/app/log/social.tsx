// Social Connection logging screen — Sprint 19

import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { DateContextBanner } from '../../src/components/DateContextBanner';
import { SocialConnectionLogger } from '../../src/components/logging/SocialConnectionLogger';

export default function SocialScreen() {
  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Social Connection</Text>
        <View style={styles.backBtn} />
      </View>

      <DateContextBanner />
      <SocialConnectionLogger />
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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
});
