// Sprint 30: Tier 2 (checklist) confirmation card
// Renders one consolidated card across one or more tool calls for the same
// turn. User can uncheck individual fields, edit values inline, and tap
// "Log all" to commit only the checked fields.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { ToolUseRequest } from '../../types/coach';

const SKIP_FIELDS = new Set(['source', 'extraction_source', 'timestamp']);

interface CardField {
  toolUseId: string;
  toolName: string;
  fieldKey: string;
  label: string;
  rawValue: unknown;
}

function humanizeFieldKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValueForLabel(key: string, v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') {
    if (key.includes('lbs')) return `${v} lbs`;
    if (key.includes('oz')) return `${v} oz`;
    if (key.includes('pct')) return `${v}%`;
    if (key === 'hours') return `${v}h`;
    return String(v);
  }
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function buildFields(tools: ToolUseRequest[]): CardField[] {
  const out: CardField[] = [];
  for (const t of tools) {
    for (const [k, v] of Object.entries(t.input)) {
      if (SKIP_FIELDS.has(k)) continue;
      if (v == null) continue;
      if (typeof v === 'string' && v.length === 0) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out.push({
        toolUseId: t.toolUseId,
        toolName: t.name,
        fieldKey: k,
        label: humanizeFieldKey(k),
        rawValue: v,
      });
    }
  }
  return out;
}

type FieldFlag = 'low_confidence' | 'out_of_range';

interface ToolConfirmationCardProps {
  tools: ToolUseRequest[];
  onLogAll: (checkedTools: ToolUseRequest[]) => void;
  onCancel: () => void;
  // Sprint 31: keyed by `${toolUseId}.${fieldKey}` to match the card's
  // existing per-field state keys. Caller (Commit-2 wearable route) is
  // responsible for transforming bare service-layer keys into the
  // compound format before passing them in.
  fieldFlags?: Record<string, FieldFlag>;
}

export function ToolConfirmationCard({ tools, onLogAll, onCancel, fieldFlags }: ToolConfirmationCardProps) {
  const initialFields = useMemo(() => buildFields(tools), [tools]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const f of initialFields) m[`${f.toolUseId}.${f.fieldKey}`] = true;
    return m;
  });
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const f of initialFields) {
      m[`${f.toolUseId}.${f.fieldKey}`] = formatValueForLabel(f.fieldKey, f.rawValue);
    }
    return m;
  });

  const toggleField = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogAll = () => {
    // Build a filtered copy of each tool with only checked fields included.
    const result: ToolUseRequest[] = [];
    for (const t of tools) {
      const next: Record<string, unknown> = {};
      // Always carry through bookkeeping fields.
      for (const skip of SKIP_FIELDS) {
        if (skip in t.input) next[skip] = t.input[skip];
      }
      let hasMeaningful = false;
      for (const [k, v] of Object.entries(t.input)) {
        if (SKIP_FIELDS.has(k)) continue;
        const id = `${t.toolUseId}.${k}`;
        if (!checked[id]) continue;
        if (editing && id in editValues) {
          const raw = editValues[id];
          if (typeof v === 'number') {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) next[k] = parsed;
            else next[k] = v;
          } else if (Array.isArray(v)) {
            next[k] = raw.split(',').map((s) => s.trim()).filter(Boolean);
          } else {
            next[k] = raw;
          }
        } else {
          next[k] = v;
        }
        hasMeaningful = true;
      }
      if (hasMeaningful) {
        result.push({ ...t, input: next });
      }
    }
    onLogAll(result);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Confirm what to log</Text>
      {initialFields.map((f) => {
        const id = `${f.toolUseId}.${f.fieldKey}`;
        const isChecked = checked[id];
        const flag = fieldFlags?.[id];
        return (
          <View key={id} style={styles.row}>
            <Pressable onPress={() => toggleField(id)} style={styles.checkboxBtn} accessibilityRole="checkbox" accessibilityState={{ checked: isChecked }}>
              <Ionicons
                name={isChecked ? 'checkbox' : 'square-outline'}
                size={20}
                color={isChecked ? Colors.accent : Colors.secondaryText}
              />
            </Pressable>
            <Text style={styles.label}>{f.label}</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={editValues[id] ?? ''}
                onChangeText={(t) => setEditValues((prev) => ({ ...prev, [id]: t }))}
              />
            ) : (
              <Text style={styles.value}>{formatValueForLabel(f.fieldKey, f.rawValue)}</Text>
            )}
            {flag ? (
              <View style={[styles.badge, flag === 'out_of_range' ? styles.badgeRed : styles.badgeYellow]}>
                <Text style={styles.badgeText}>
                  {flag === 'out_of_range' ? 'out of range' : 'low confidence'}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={handleLogAll} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Log all</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => setEditing((p) => !p)} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{editing ? 'Done editing' : 'Edit'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  checkboxBtn: {
    paddingRight: 8,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  value: {
    fontSize: 13,
    color: Colors.secondaryText,
  },
  input: {
    fontSize: 13,
    color: Colors.text,
    minWidth: 80,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingVertical: 2,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: 13,
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeYellow: {
    backgroundColor: '#D4A843',
  },
  badgeRed: {
    backgroundColor: '#C0392B',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
