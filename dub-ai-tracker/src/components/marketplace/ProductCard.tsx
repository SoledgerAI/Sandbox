// Product card component for marketplace
// Phase 22: Marketplace, Influencer System, and Polish
// FTC disclosure appears BEFORE product description, price, or buy button

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import { FTCDisclosure } from './FTCDisclosure';
import type { Product, MarketplacePurchaseEvent, DismissedProduct } from '../../types/marketplace';

interface ProductCardProps {
  product: Product;
  onDismiss?: (productId: string) => void;
}

export function ProductCard({ product, onDismiss }: ProductCardProps) {
  const [showTriggerReason, setShowTriggerReason] = useState(false);

  const handlePurchase = async () => {
    // Log click-through for analytics (not PII)
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

    // Open affiliate link
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
    onDismiss?.(product.id);
  };

  return (
    <View style={styles.card}>
      {/* FTC Disclosure appears FIRST -- before any product info */}
      <FTCDisclosure disclosures={product.disclosures} />

      {/* Product header */}
      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {product.category.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle-outline" size={20} color={Colors.secondaryText} />
        </TouchableOpacity>
      </View>

      {/* Product info */}
      <Text style={styles.brand}>{product.brand}</Text>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.description}>{product.description}</Text>

      {product.price != null && (
        <Text style={styles.price}>
          {product.price_currency === 'USD' ? '$' : product.price_currency}
          {product.price.toFixed(2)}
        </Text>
      )}

      {/* "Why am I seeing this?" button */}
      <TouchableOpacity
        style={styles.triggerBtn}
        onPress={() => setShowTriggerReason(!showTriggerReason)}
      >
        <Ionicons name="help-circle-outline" size={14} color={Colors.secondaryText} />
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
        <Ionicons name="open-outline" size={16} color={Colors.primaryBackground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: Colors.divider,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: Colors.secondaryText,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brand: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  price: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  triggerBtnText: {
    color: Colors.secondaryText,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  triggerReason: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 6,
    padding: 10,
  },
  triggerReasonText: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
    marginTop: 4,
  },
  ctaText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '700',
  },
});
