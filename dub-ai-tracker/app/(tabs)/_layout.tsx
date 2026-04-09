import { Text, TouchableOpacity, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { hapticLight } from '../../src/utils/haptics';

type TabIcon = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: { name: string; title: string; icon: TabIcon; iconFocused: TabIcon }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconFocused: 'home' },
  { name: 'log', title: 'Log', icon: 'add-circle-outline', iconFocused: 'add-circle' },
  { name: 'coach', title: 'Coach DUB', icon: 'chatbubble-ellipses-outline', iconFocused: 'chatbubble-ellipses' },
  { name: 'trends', title: 'Charts', icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person' },
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
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
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
          }}
        />
      ))}
      {/* Hide settings from tab bar — accessible via Profile menu */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
