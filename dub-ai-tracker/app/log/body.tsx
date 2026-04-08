// Body metrics logging screen -- tabbed interface for weight, body fat, measurements, vitals
// Phase 9: Body Metrics and Weight Tracking

import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { DateContextBanner } from '../../src/components/DateContextBanner';
import { WeightLogger } from '../../src/components/logging/WeightLogger';
import { BodyFatLogger } from '../../src/components/logging/BodyFatLogger';
import { MeasurementsLogger } from '../../src/components/logging/MeasurementsLogger';
import { VitalsLogger } from '../../src/components/logging/VitalsLogger';
import { WeightTrend } from '../../src/components/charts/WeightTrend';

type BodyTab = 'weight' | 'bodyfat' | 'measurements' | 'vitals';

const TABS: { key: BodyTab; label: string; icon: string }[] = [
  { key: 'weight', label: 'Weight', icon: 'scale-outline' },
  { key: 'bodyfat', label: 'Body Fat', icon: 'body-outline' },
  { key: 'measurements', label: 'Measure', icon: 'resize-outline' },
  { key: 'vitals', label: 'Vitals', icon: 'pulse-outline' },
];

export default function BodyScreen() {
  const [activeTab, setActiveTab] = useState<BodyTab>('weight');
  const [refreshKey, setRefreshKey] = useState(0);
  const { width: screenWidth } = useWindowDimensions();

  const handleEntryLogged = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Body Metrics</Text>
        <View style={styles.backBtn} />
      </View>

      <DateContextBanner />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? Colors.accent : Colors.secondaryText}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Weight trend chart (shown on weight tab) */}
        {activeTab === 'weight' && (
          <View style={styles.chartCard} key={`chart-${refreshKey}`}>
            <WeightTrend width={screenWidth - 64} height={200} />
          </View>
        )}

        {activeTab === 'weight' && (
          <WeightLogger onEntryLogged={handleEntryLogged} />
        )}
        {activeTab === 'bodyfat' && (
          <BodyFatLogger onEntryLogged={handleEntryLogged} />
        )}
        {activeTab === 'measurements' && (
          <MeasurementsLogger onEntryLogged={handleEntryLogged} />
        )}
        {activeTab === 'vitals' && (
          <VitalsLogger onEntryLogged={handleEntryLogged} />
        )}
      </ScrollView>
    </View>
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
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  tabActive: {
    backgroundColor: Colors.cardBackground,
  },
  tabText: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.accentText,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  chartCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
});
