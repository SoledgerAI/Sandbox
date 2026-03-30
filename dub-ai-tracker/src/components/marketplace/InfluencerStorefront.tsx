// Influencer storefront component
// Phase 22: Marketplace, Influencer System, and Polish
// Stub UI with application flow concept
// Dual FTC disclosure on every influencer product card

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FTCDisclosure } from './FTCDisclosure';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import type { InfluencerProduct, MarketplacePurchaseEvent } from '../../types/marketplace';
import { SAMPLE_INFLUENCERS } from './productData';

interface InfluencerStorefrontProps {
  influencerId?: string;
}

export function InfluencerStorefrontView({ influencerId }: InfluencerStorefrontProps) {
  const influencer = SAMPLE_INFLUENCERS.find((i) => i.id === influencerId) ?? SAMPLE_INFLUENCERS[0];

  if (!influencer) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Influencer not found.</Text>
      </View>
    );
  }

  const handleProductClick = async (ip: InfluencerProduct) => {
    const event: MarketplacePurchaseEvent = {
      id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      product_id: ip.product_id,
      influencer_id: influencer.id,
      affiliate_partner: ip.product.affiliate_partner,
      clicked_at: new Date().toISOString(),
      trigger: ip.product.contextual_trigger,
    };
    const existing = await storageGet<MarketplacePurchaseEvent[]>(STORAGE_KEYS.MARKETPLACE_PURCHASES);
    await storageSet(STORAGE_KEYS.MARKETPLACE_PURCHASES, [...(existing ?? []), event]);
    Linking.openURL(ip.product.affiliate_url).catch(() => {
      Alert.alert('Error', 'Could not open link.');
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Influencer Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {influencer.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.storefrontName}>{influencer.storefront_name}</Text>
        <Text style={styles.bio}>{influencer.bio}</Text>
        <View style={styles.nicheTags}>
          {influencer.niche.map((n) => (
            <View key={n} style={styles.nicheTag}>
              <Text style={styles.nicheTagText}>{n}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Partner Code */}
      <View style={styles.partnerCodeCard}>
        <Text style={styles.partnerCodeLabel}>Partner Code</Text>
        <Text style={styles.partnerCode}>{influencer.partner_code}</Text>
      </View>

      {/* Report link */}
      <TouchableOpacity
        style={styles.reportLink}
        onPress={() => Alert.alert('Report', 'Thank you. Your report has been received and will be reviewed by the DUB_AI team.')}
      >
        <Ionicons name="flag-outline" size={14} color={Colors.secondaryText} />
        <Text style={styles.reportText}>Report this influencer</Text>
      </TouchableOpacity>

      {/* Products */}
      <Text style={styles.sectionTitle}>Products</Text>
      {influencer.products.length === 0 ? (
        <Text style={styles.emptyText}>No products listed yet.</Text>
      ) : (
        influencer.products.map((ip) => (
          <View key={ip.product_id} style={styles.productCard}>
            {/* Dual FTC Disclosure -- BEFORE product info */}
            <FTCDisclosure
              disclosures={[ip.influencer_disclosure, ip.platform_disclosure]}
            />
            <Text style={styles.productBrand}>{ip.product.brand}</Text>
            <Text style={styles.productName}>{ip.product.name}</Text>
            <Text style={styles.productDesc}>{ip.product.description}</Text>
            {ip.product.price != null && (
              <Text style={styles.productPrice}>
                ${ip.product.price.toFixed(2)}
              </Text>
            )}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => handleProductClick(ip)}
              activeOpacity={0.7}
            >
              <Text style={styles.ctaText}>View Product</Text>
              <Ionicons name="open-outline" size={16} color={Colors.primaryBackground} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// Influencer Application Form (stub)
export function InfluencerApplicationForm() {
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || !niche.trim()) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={styles.applicationContainer}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
        <Text style={styles.applicationTitle}>Application Received</Text>
        <Text style={styles.applicationDesc}>
          Thank you for your interest in the DUB_AI Influencer Marketplace.
          Our team will review your application and respond within 5-7 business days.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.applicationContainer}>
      <Text style={styles.applicationTitle}>Become a DUB_AI Influencer</Text>
      <Text style={styles.applicationDesc}>
        Bring your brand deals into the DUB_AI marketplace. You negotiate your own vendor
        relationships -- DUB_AI takes a 15-20% commission on sales made through the platform.
      </Text>

      <Text style={styles.termsTitle}>Terms of Service</Text>
      <View style={styles.termsList}>
        <Text style={styles.termsItem}>- No unverified health claims</Text>
        <Text style={styles.termsItem}>- No misleading before/after photos</Text>
        <Text style={styles.termsItem}>- No income claims</Text>
        <Text style={styles.termsItem}>- Must disclose all material connections</Text>
        <Text style={styles.termsItem}>- DUB_AI reserves right to remove violating content</Text>
      </View>

      <Text style={styles.inputLabel}>Your Name / Brand</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Enter your name or brand"
        placeholderTextColor={Colors.secondaryText}
      />

      <Text style={styles.inputLabel}>Niche / Category</Text>
      <TextInput
        style={styles.input}
        value={niche}
        onChangeText={setNiche}
        placeholder="e.g., Fitness, Nutrition, Recovery"
        placeholderTextColor={Colors.secondaryText}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.7}>
        <Text style={styles.submitText}>Submit Application</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: Colors.secondaryText, fontSize: 14, textAlign: 'center' },
  profileHeader: { alignItems: 'center', gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.primaryBackground, fontSize: 28, fontWeight: 'bold' },
  storefrontName: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  bio: { color: Colors.secondaryText, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
  nicheTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  nicheTag: { backgroundColor: Colors.divider, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  nicheTagText: { color: Colors.text, fontSize: 11, fontWeight: '600' },
  partnerCodeCard: {
    backgroundColor: Colors.inputBackground, borderRadius: 8, padding: 12,
    alignItems: 'center', gap: 4,
  },
  partnerCodeLabel: { color: Colors.secondaryText, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  partnerCode: { color: Colors.accent, fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center' },
  reportText: { color: Colors.secondaryText, fontSize: 11, textDecorationLine: 'underline' },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  productCard: { backgroundColor: Colors.cardBackground, borderRadius: 12, padding: 14, gap: 6 },
  productBrand: { color: Colors.secondaryText, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  productName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  productDesc: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18 },
  productPrice: { color: Colors.accent, fontSize: 16, fontWeight: '700' },
  ctaButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 10, gap: 8, marginTop: 4,
  },
  ctaText: { color: Colors.primaryBackground, fontSize: 14, fontWeight: '700' },
  applicationContainer: { padding: 16, paddingBottom: 40, alignItems: 'center', gap: 16 },
  applicationTitle: { color: Colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  applicationDesc: { color: Colors.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  termsTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', alignSelf: 'flex-start' },
  termsList: { alignSelf: 'stretch', gap: 4, paddingLeft: 8 },
  termsItem: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18 },
  inputLabel: { color: Colors.text, fontSize: 14, fontWeight: '600', alignSelf: 'flex-start' },
  input: {
    width: '100%', backgroundColor: Colors.inputBackground, borderWidth: 1,
    borderColor: Colors.divider, borderRadius: 8, padding: 12,
    color: Colors.text, fontSize: 15,
  },
  submitButton: {
    width: '100%', backgroundColor: Colors.accent, borderRadius: 8,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitText: { color: Colors.primaryBackground, fontSize: 16, fontWeight: '700' },
});
