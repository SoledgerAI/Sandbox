// Root layout: checks onboarding state on launch
// Phase 3: Onboarding Flow
// Per Section 8: If dub.onboarding.complete is true, skip to Dashboard

import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../src/utils/storage';

export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;

    async function checkOnboarding() {
      try {
        const complete = await storageGet<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETE);
        if (!complete) {
          router.replace('/onboarding');
        }
      } finally {
        setChecking(false);
      }
    }
    checkOnboarding();
  }, [navigationState?.key]);

  return (
    <>
      <StatusBar style="light" />
      {checking && (
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.primaryBackground,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.primaryBackground },
        }}
      >
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
