// Sprint 25: Recent Coach Interaction Card
// Shows last Coach DUB message preview or prompt to chat

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import type { ChatMessage } from '../../types/coach';

interface RecentCoachCardProps {
  lastMessage: ChatMessage | null;
}

export function RecentCoachCard({ lastMessage }: RecentCoachCardProps) {
  const hasRecentMessage = lastMessage != null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push('/(tabs)/coach')}
    >
      <PremiumCard>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.accentText} />
          </View>
          <View style={styles.textContainer}>
            {hasRecentMessage ? (
              <>
                <Text style={styles.title}>Coach DUB</Text>
                <Text style={styles.preview} numberOfLines={2}>
                  {lastMessage.content.slice(0, 100)}
                  {lastMessage.content.length > 100 ? '...' : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Chat with Coach DUB</Text>
                <Text style={styles.subtitle}>Get personalized health insights</Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.secondaryText} />
        </View>
      </PremiumCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  preview: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
});
