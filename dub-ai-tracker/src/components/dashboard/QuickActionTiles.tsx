// TF-05: Dashboard quick-action tiles — 3x2 grid with customize picker
// Renders up to 6 gold tiles based on the user's saved selection and
// current enabled categories. Tapping a tile navigates to its log route.
// "Customize" opens a modal where the user can pick up to 6 tiles.

import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import { hapticLight } from '../../utils/haptics';
import {
  ALL_DASHBOARD_TILES,
  DEFAULT_DASHBOARD_TILES,
  MAX_DASHBOARD_TILES,
  resolveVisibleTiles,
  type DashboardTile,
} from '../../constants/dashboardTiles';

interface QuickActionTilesProps {
  enabledTags: string[];
}

const TILE_TEXT = '#0D0F1A';

export function QuickActionTiles({ enabledTags }: QuickActionTilesProps) {
  const [selection, setSelection] = useState<string[]>(DEFAULT_DASHBOARD_TILES);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storageGet<string[]>(STORAGE_KEYS.SETTINGS_DASHBOARD_TILES).then((saved) => {
      if (cancelled) return;
      if (saved && saved.length > 0) setSelection(saved);
    });
    return () => { cancelled = true; };
  }, []);

  const visibleTiles = resolveVisibleTiles(selection, enabledTags);

  const handlePress = useCallback((tile: DashboardTile) => {
    hapticLight();
    router.push(tile.route as never);
  }, []);

  const handleSaveSelection = useCallback(async (nextSelection: string[]) => {
    setSelection(nextSelection);
    setPickerOpen(false);
    await storageSet(STORAGE_KEYS.SETTINGS_DASHBOARD_TILES, nextSelection);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Start Logging</Text>

      <View style={styles.grid}>
        {visibleTiles.map((tile) => (
          <TouchableOpacity
            key={tile.id}
            style={styles.tile}
            onPress={() => handlePress(tile)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Log ${tile.label}`}
          >
            <Ionicons name={tile.icon as never} size={22} color={TILE_TEXT} />
            <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.customizeBtn}
        onPress={() => setPickerOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Customize dashboard tiles"
      >
        <Text style={styles.customizeText}>Customize</Text>
      </TouchableOpacity>

      <TilesPickerModal
        visible={pickerOpen}
        initialSelection={selection}
        enabledTags={enabledTags}
        onCancel={() => setPickerOpen(false)}
        onSave={handleSaveSelection}
      />
    </View>
  );
}

interface TilesPickerModalProps {
  visible: boolean;
  initialSelection: string[];
  enabledTags: string[];
  onCancel: () => void;
  onSave: (selection: string[]) => void;
}

function TilesPickerModal({
  visible,
  initialSelection,
  enabledTags,
  onCancel,
  onSave,
}: TilesPickerModalProps) {
  const [draft, setDraft] = useState<string[]>(initialSelection);
  // S29-F: inline cap hint instead of freezing the whole list. When the
  // user taps a 7th tile we surface a short message under that row and
  // clear it on the next interaction.
  const [capHintForId, setCapHintForId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(initialSelection);
      setCapHintForId(null);
    }
  }, [visible, initialSelection]);

  const availableTiles = ALL_DASHBOARD_TILES.filter(
    (t) => t.tagGate === null || enabledTags.includes(t.tagGate),
  );

  const toggle = (id: string) => {
    hapticLight();
    setDraft((current) => {
      if (current.includes(id)) {
        // S29-F: deselection always works, including from the cap hint state.
        setCapHintForId(null);
        return current.filter((x) => x !== id);
      }
      if (current.length >= MAX_DASHBOARD_TILES) {
        // S29-F: show inline hint on the tapped row instead of disabling
        // the touch handler — a `disabled` prop would also block gesture
        // pass-through and freeze ScrollView dragging.
        setCapHintForId(id);
        return current;
      }
      setCapHintForId(null);
      return [...current, id];
    });
  };

  const selectedCount = draft.length;
  const canSave = selectedCount > 0;
  const atCap = selectedCount >= MAX_DASHBOARD_TILES;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Customize Tiles</Text>
          <Text style={styles.sheetSubtitle}>
            {atCap
              ? `${selectedCount} of ${MAX_DASHBOARD_TILES} — deselect to swap`
              : `Select up to ${MAX_DASHBOARD_TILES} actions for your dashboard (${selectedCount}/${MAX_DASHBOARD_TILES})`}
          </Text>

          <ScrollView
            style={styles.optionList}
            contentContainerStyle={styles.optionListContent}
            showsVerticalScrollIndicator={false}
          >
            {availableTiles.map((tile) => {
              const isSelected = draft.includes(tile.id);
              const dimmed = !isSelected && atCap;
              const showHint = capHintForId === tile.id;
              return (
                <View key={tile.id}>
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected, dimmed && styles.optionDisabled]}
                    onPress={() => toggle(tile.id)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={tile.label}
                  >
                    <Ionicons name={tile.icon as never} size={20} color={isSelected ? Colors.accent : Colors.secondaryText} />
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{tile.label}</Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSelected ? Colors.accent : Colors.secondaryText}
                    />
                  </TouchableOpacity>
                  {showHint && (
                    <Text style={styles.capHint}>Max reached — deselect one to add</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={() => canSave && onSave(draft)}
              disabled={!canSave}
              accessibilityRole="button"
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  header: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    flexBasis: '31.5%',
    flexGrow: 1,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 72,
  },
  tileLabel: {
    color: TILE_TEXT,
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  customizeBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  customizeText: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: Spacing.xl,
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    marginBottom: 12,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  sheetSubtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginBottom: 12,
  },
  optionList: {
    flexGrow: 0,
  },
  optionListContent: {
    paddingVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: Colors.accent,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  capHint: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 14,
    fontStyle: 'italic',
  },
  optionLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  optionLabelSelected: {
    color: Colors.accentText,
    fontWeight: FontWeight.semibold,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: FontWeight.semibold,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: TILE_TEXT,
    fontSize: 15,
    fontWeight: FontWeight.bold,
  },
});
