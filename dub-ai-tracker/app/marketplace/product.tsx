// Product detail screen
// Phase 22: Marketplace, Influencer System, and Polish

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { FTCDisclosure } from '../../src/components/marketplace/FTCDisclosure';
import { MARKETPLACE_PRODUCTS } from '../../src/components/marketplace/productData';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type { MarketplacePurchaseEvent, DismissedProduct } from '../../src/types/marketplace';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showTriggerReason, setShowTriggerReason] = useState(false);

  const product = MARKETPLACE_PRODUCTS.find((p) => p.id === id);

  if (!product) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Product</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Product not found.</Text>
        </View>
      </View>
    );
  }

  const handlePurchase = async () => {
    const event: MarketplacePurchaseEvent = {
      id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      product_id: product.id,
      influencer_id: null,
      affiliate_partner: product.affiliate_partner,
      clicked_at: new Date().toISOString(),
      trigger: product.contextual_trigger,
    };
    const existing = await storageGet<MarketplacePurchaseEvent[]>(STORAGE_KEYS.MARKETPLACE_PURCHASES);
    await storageSet(STORAGE_KEYS.MARKETPLACE_PURCHASES, [...(existing ?? []), event]);
    Linking.openURL(product.affiliate_url).catch(() => {
      Alert.alert('Error', 'Could not open link.');
    });
  };

  const handleDismiss = async () => {
    const existing = await storageGet<DismissedProduct[]>(STORAGE_KEYS.MARKETPLACE_DISMISSED);
    const entry: DismissedProduct = {
      product_id: product.id,
      dismissed_at: new Date().toISOString(),
    };
    await storageSet(STORAGE_KEYS.MARKETPLACE_DISMISSED, [...(existing ?? []), entry]);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Product Detail</Text>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="eye-off-outline" size={22} color={Colors.secondaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* FTC Disclosure FIRST */}
        <FTCDisclosure disclosures={product.disclosures} />

        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {product.category.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {/* Product image placeholder */}
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={48} color={Colors.divider} />
          <Text style={styles.imagePlaceholderText}>Product Image</Text>
        </View>

        {/* Product info */}
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.description}>{product.description}</Text>

        {product.price != null && (
          <Text style={styles.price}>
            ${product.price.toFixed(2)}
          </Text>
        )}

        {/* Affiliate partner */}
        <View style={styles.partnerRow}>
          <Ionicons name="storefront-outline" size={16} color={Colors.secondaryText} />
          <Text style={styles.partnerText}>
            Available via {product.affiliate_partner.charAt(0).toUpperCase() + product.affiliate_partner.slice(1)}
          </Text>
        </View>

        {/* Why am I seeing this? */}
        <TouchableOpacity
          style={styles.triggerBtn}
          onPress={() => setShowTriggerReason(!showTriggerReason)}
        >
          <Ionicons name="help-circle-outline" size={16} color={Colors.secondaryText} />
          <Text style={styles.triggerBtnText}>Why am I seeing this?</Text>
        </TouchableOpacity>

        {showTriggerReason && (
          <View style={styles.triggerReason}>
            <Text style={styles.triggerReasonText}>{product.trigger_reason}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity style={styles.ctaButton} onPress={handlePurchase} activeOpacity={0.7}>
          <Text style={styles.ctaText}>View Product</Text>
          <Ionicons name="open-outline" size={18} color={Colors.primaryBackground} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.secondaryText, fontSize: 14 },
  categoryBadge: {
    backgroundColor: Colors.divider,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: Colors.secondaryText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imagePlaceholder: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: { color: Colors.divider, fontSize: 13 },
  brand: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  description: { color: Colors.secondaryText, fontSize: 15, lineHeight: 22 },
  price: { color: Colors.accent, fontSize: 24, fontWeight: '700' },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partnerText: { color: Colors.secondaryText, fontSize: 13 },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  triggerBtnText: {
    color: Colors.secondaryText,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  triggerReason: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    padding: 12,
  },
  triggerReasonText: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  ctaText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
});
