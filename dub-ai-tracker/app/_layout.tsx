import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primaryBackground },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: COLORS.primaryBackground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="water"
          options={{ title: 'Water Intake', headerBackTitle: 'Back' }}
        />
      </Stack>
    </>
  );
}
