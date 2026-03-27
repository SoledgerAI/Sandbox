import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../src/constants/colors';

export default function CoachScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coach</Text>
      <Text style={styles.subtitle}>AI-powered coaching</Text>
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
