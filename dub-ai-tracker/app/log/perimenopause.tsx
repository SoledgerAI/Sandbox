// Sprint 21: Perimenopause logging screen

import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { DateContextBanner } from '../../src/components/DateContextBanner';
import { PerimenopauseLogger } from '../../src/components/logging/PerimenopauseLogger';

export default function PerimenopauseScreen() {
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
          <Text style={styles.title}>Perimenopause</Text>
          <View style={styles.backBtn} />
        </View>

        <DateContextBanner />
        <PerimenopauseLogger />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 32,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
