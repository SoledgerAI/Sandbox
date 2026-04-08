import { Text, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { hapticLight } from '../../src/utils/haptics';

type TabIcon = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: { name: string; title: string; icon: TabIcon; iconFocused: TabIcon }[] = [
  { name: 'index', title: 'Dashboard', icon: 'home-outline', iconFocused: 'home' },
  { name: 'log', title: 'Log', icon: 'add-circle-outline', iconFocused: 'add-circle' },
  { name: 'coach', title: 'Coach', icon: 'chatbubble-ellipses-outline', iconFocused: 'chatbubble-ellipses' },
  { name: 'trends', title: 'Trends', icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.secondaryText,
        tabBarButton: (props) => {
          const { onPress, ...rest } = props as any;
          return (
            <TouchableOpacity
              {...rest}
              onPress={(e) => { hapticLight(); onPress?.(e); }}
            />
          );
        },
        tabBarStyle: {
          backgroundColor: Colors.primaryBackground,
          borderTopColor: Colors.divider,
          borderTopWidth: 1,
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
            tabBarLabel: ({ focused, color }) =>
              focused ? (
                <Text style={{ color, fontSize: 10, marginTop: -2 }}>
                  {tab.title}
                </Text>
              ) : null,
          }}
        />
      ))}
    </Tabs>
  );
}
