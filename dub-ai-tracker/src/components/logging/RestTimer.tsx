// Rest timer component -- countdown timer with configurable defaults
// Phase 11: Fitness and Workout Logging

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

const PRESET_DURATIONS = [60, 90, 120, 180];

interface RestTimerProps {
  defaultSeconds?: number;
  onComplete?: () => void;
}

export function RestTimer({ defaultSeconds = 90, onComplete }: RestTimerProps) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(defaultSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds, onComplete]);

  const toggleTimer = useCallback(() => {
    if (seconds === 0) {
      setSeconds(selectedPreset);
      setIsRunning(true);
    } else {
      setIsRunning((prev) => !prev);
    }
  }, [seconds, selectedPreset]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setSeconds(selectedPreset);
  }, [selectedPreset]);

  const selectPreset = useCallback((duration: number) => {
    setSelectedPreset(duration);
    if (!isRunning) {
      setSeconds(duration);
    }
  }, [isRunning]);

  const formatTime = (s: number): string => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = selectedPreset > 0 ? seconds / selectedPreset : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rest Timer</Text>

      {/* Preset buttons */}
      <View style={styles.presetRow}>
        {PRESET_DURATIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.presetBtn, selectedPreset === d && styles.presetBtnActive]}
            onPress={() => selectPreset(d)}
          >
            <Text style={[styles.presetText, selectedPreset === d && styles.presetTextActive]}>
              {d >= 60 ? `${d / 60}m` : `${d}s`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timer display */}
      <View style={styles.timerRow}>
        <Text style={[styles.timerText, seconds === 0 && styles.timerComplete]}>
          {formatTime(seconds)}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Controls */}
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={resetTimer}>
          <Ionicons name="refresh" size={20} color={Colors.secondaryText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.playBtn, isRunning && styles.pauseBtn]}
          onPress={toggleTimer}
        >
          <Ionicons
            name={isRunning ? 'pause' : 'play'}
            size={24}
            color={Colors.primaryBackground}
          />
        </TouchableOpacity>
      </View>

      {seconds === 0 && (
        <Text style={styles.completeText}>Rest complete</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  presetBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  presetText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  presetTextActive: {
    color: Colors.primaryBackground,
  },
  timerRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  timerText: {
    color: Colors.text,
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerComplete: {
    color: Colors.success,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtn: {
    backgroundColor: Colors.warning,
  },
  completeText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
