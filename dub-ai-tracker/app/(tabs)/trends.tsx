import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../src/constants/colors';

export default function TrendsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trends</Text>
      <Text style={styles.subtitle}>Charts and analytics</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 16,
    marginTop: 8,
  },
});
