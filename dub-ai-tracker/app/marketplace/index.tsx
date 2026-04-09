// Marketplace browse screen
// Phase 22: Marketplace, Influencer System, and Polish
// 16 product categories browseable with contextual triggers only

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { Colors } from '../../src/constants/colors';
import { ProductCard } from '../../src/components/marketplace/ProductCard';
import { getTriggeredProducts } from '../../src/components/marketplace/ContextualTrigger';
import { requestTrackingPermission } from '../../src/utils/tracking';
import { PRODUCT_CATEGORIES, MARKETPLACE_PRODUCTS, SAMPLE_INFLUENCERS } from '../../src/components/marketplace/productData';
import { PREF_KEYS } from '../../src/services/secureStorageService';
import type { Product } from '../../src/types/marketplace';

type Tab = 'for_you' | 'browse' | 'influencers';

export default function MarketplaceScreen() {
  const [tab, setTab] = useState<Tab>('for_you');
  const [loading, setLoading] = useState(true);
  const [triggeredProducts, setTriggeredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [bannerDismissed, setBannerDismissed] = useState(true); // default hidden until loaded

  const loadTriggered = useCallback(async () => {
    setLoading(true);
    const [products, dismissed] = await Promise.all([
      getTriggeredProducts(),
      AsyncStorage.getItem(PREF_KEYS.AFFILIATE_BANNER_DISMISSED),
    ]);
    setTriggeredProducts(products);
    setBannerDismissed(dismissed === 'true');
    setLoading(false);
  }, []);

  useEffect(() => {
    // MASTER-42: Request ATT permission before any click tracking can occur
    requestTrackingPermission();
    loadTriggered();
  }, [loadTriggered]);

  const handleDismissBanner = useCallback(async () => {
    setBannerDismissed(true);
    await AsyncStorage.setItem(PREF_KEYS.AFFILIATE_BANNER_DISMISSED, 'true');
  }, []);

  const handleDismiss = (productId: string) => {
    setDismissedIds((prev) => new Set([...prev, productId]));
    setTriggeredProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const filteredByCategory = selectedCategory
    ? MARKETPLACE_PRODUCTS.filter((p) => p.category === selectedCategory && !dismissedIds.has(p.id))
    : [];

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Marketplace</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['for_you', 'browse', 'influencers'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => { setTab(t); setSelectedCategory(null); }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'for_you' ? 'For You' : t === 'browse' ? 'Browse' : 'Influencers'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Affiliate disclosure banner */}
      {!bannerDismissed ? (
        <View style={styles.affiliateBanner}>
          <Ionicons name="information-circle" size={16} color={Colors.warning} />
          <Text style={styles.affiliateBannerText}>
            Some products contain affiliate links. DUB_AI may earn a commission at no extra cost to you.
          </Text>
          <TouchableOpacity onPress={handleDismissBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={Colors.secondaryText} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.affiliateMiniBanner}>
          <Ionicons name="information-circle-outline" size={12} color={Colors.secondaryText} />
          <Text style={styles.affiliateMiniText}>Affiliate links</Text>
        </View>
      )}

      {/* Content */}
      {tab === 'for_you' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionDesc}>
            Products recommended based on your goals, patterns, and activity. Products are never randomly surfaced.
          </Text>

          {loading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
          ) : triggeredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={48} color={Colors.divider} />
              <Text style={styles.emptyTitle}>No Recommendations Yet</Text>
              <Text style={styles.emptyDesc}>
                As you log more data and build patterns, personalized product suggestions will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.productList}>
              {triggeredProducts.map((p) => (
                <ProductCard key={p.id} product={p} onDismiss={handleDismiss} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'browse' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {selectedCategory === null ? (
            <>
              <Text style={styles.sectionDesc}>Browse all 16 product categories.</Text>
              <View style={styles.categoryGrid}>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryCard}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={cat.icon as any} size={28} color={Colors.accent} />
                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                    <Text style={styles.categoryCount}>{cat.count} products</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.backToCategories}
                onPress={() => setSelectedCategory(null)}
              >
                <Ionicons name="arrow-back" size={18} color={Colors.accent} />
                <Text style={styles.backToCategoriesText}>All Categories</Text>
              </TouchableOpacity>
              <Text style={styles.categoryTitle}>
                {PRODUCT_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
              </Text>
              {filteredByCategory.length === 0 ? (
                <Text style={styles.emptyDesc}>No products in this category yet.</Text>
              ) : (
                <View style={styles.productList}>
                  {filteredByCategory.map((p) => (
                    <ProductCard key={p.id} product={p} onDismiss={handleDismiss} />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {tab === 'influencers' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionDesc}>
            Influencer storefronts with curated product recommendations.
          </Text>

          {SAMPLE_INFLUENCERS.map((inf) => (
            <TouchableOpacity
              key={inf.id}
              style={styles.influencerCard}
              onPress={() => router.push(`/marketplace/influencer?id=${inf.id}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.influencerAvatar}>
                <Text style={styles.influencerInitial}>
                  {inf.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.influencerInfo}>
                <Text style={styles.influencerName}>{inf.storefront_name}</Text>
                <Text style={styles.influencerBio} numberOfLines={2}>{inf.bio}</Text>
                <View style={styles.influencerTags}>
                  {inf.niche.slice(0, 3).map((n) => (
                    <View key={n} style={styles.nicheTag}>
                      <Text style={styles.nicheTagText}>{n}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          ))}

          {/* Apply CTA */}
          <TouchableOpacity
            style={styles.applyCta}
            onPress={() => router.push('/marketplace/influencer?apply=true' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="star-outline" size={24} color={Colors.accent} />
            <View style={styles.applyCtaInfo}>
              <Text style={styles.applyCtaTitle}>Become an Influencer</Text>
              <Text style={styles.applyCtaDesc}>Bring your brand deals to the DUB_AI marketplace</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
          </TouchableOpacity>
        </ScrollView>
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
  title: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.primaryBackground,
  },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionDesc: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyDesc: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  productList: { gap: 12 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  categoryLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryCount: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  backToCategories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  backToCategoriesText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  influencerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  influencerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  influencerInitial: {
    color: Colors.primaryBackground,
    fontSize: 20,
    fontWeight: 'bold',
  },
  influencerInfo: { flex: 1, gap: 4 },
  influencerName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  influencerBio: { color: Colors.secondaryText, fontSize: 12, lineHeight: 16 },
  influencerTags: { flexDirection: 'row', gap: 4, marginTop: 2 },
  nicheTag: {
    backgroundColor: Colors.divider,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nicheTagText: { color: Colors.text, fontSize: 10, fontWeight: '600' },
  applyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  applyCtaInfo: { flex: 1 },
  applyCtaTitle: { color: Colors.accentText, fontSize: 15, fontWeight: '600' },
  applyCtaDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  affiliateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 168, 67, 0.08)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.warning,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 6,
    padding: 10,
    gap: 8,
  },
  affiliateBannerText: {
    flex: 1,
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 15,
  },
  affiliateMiniBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  affiliateMiniText: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
});
