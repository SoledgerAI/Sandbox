import { Tabs } from 'expo-router';
import { Text, StyleSheet } from 'react-native';
import { COLORS } from '../../src/constants/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '📊',
    Log: '📝',
    Coach: '🤖',
    Trends: '📈',
    Settings: '⚙️',
  };
  return (
    <Text style={[styles.icon, { opacity: focused ? 1 : 0.5 }]}>
      {icons[label] || '•'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.tabBarBackground,
          borderTopColor: '#333',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: COLORS.tabBarActive,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: COLORS.primaryBackground },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Log" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Coach" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Trends" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
  },
});
