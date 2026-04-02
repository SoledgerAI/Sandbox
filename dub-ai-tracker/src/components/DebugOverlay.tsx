// DEBUG: REMOVE BEFORE PRODUCTION
// On-screen debug overlay for diagnosing splash screen / init hangs on physical devices.
// Shows the current initialization step as bright red text at the top of the screen.

import { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';

type Listener = (msg: string) => void;

let _listeners: Listener[] = [];
let _currentStep = 'INIT';
let _log: string[] = [];

/** Call from anywhere to update the debug overlay step */
export function debugStep(step: string) {
  const ts = new Date().toLocaleTimeString();
  const entry = `[${ts}] ${step}`;
  _currentStep = step;
  _log.push(entry);
  // Keep last 20 entries
  if (_log.length > 20) _log.shift();
  _listeners.forEach((fn) => fn(step));
}

/** Get the full debug log */
export function getDebugLog(): string[] {
  return [..._log];
}

export function DebugOverlay() {
  const [step, setStep] = useState(_currentStep);
  const [log, setLog] = useState<string[]>([..._log]);

  useEffect(() => {
    const listener: Listener = () => {
      setStep(_currentStep);
      setLog([..._log]);
    };
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.banner}>
        <Text style={styles.stepText}>{step}</Text>
      </View>
      <View style={styles.logContainer}>
        {log.slice(-8).map((entry, i) => (
          <Text key={i} style={styles.logText}>{entry}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
  },
  banner: {
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    paddingTop: 50, // safe area for iOS notch
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  stepText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  logContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logText: {
    color: '#00FF00',
    fontSize: 10,
    fontFamily: 'Menlo',
  },
});
