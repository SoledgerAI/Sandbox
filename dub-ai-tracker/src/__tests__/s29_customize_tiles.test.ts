// S29-F: Customize Tiles modal allows scrolling past the 6-tile cap.
// Source-level checks: the cap is enforced by selection logic (and an
// inline hint), NOT by disabling the row's TouchableOpacity, which is
// what was freezing scroll dragging in TF screenshot #27.

import * as fs from 'fs';
import * as path from 'path';

const TILES_PATH = path.join(
  __dirname,
  '../components/dashboard/QuickActionTiles.tsx',
);

function read(): string {
  return fs.readFileSync(TILES_PATH, 'utf-8');
}

describe('S29-F: Customize Tiles scroll fix', () => {
  it('does not pass disabled={atCap} to the row TouchableOpacity', () => {
    const src = read();
    expect(src).not.toMatch(/disabled=\{atCap\}/);
  });

  it('shows an inline cap hint when a 7th selection is attempted', () => {
    const src = read();
    expect(src).toContain('Max reached — deselect one to add');
    expect(src).toContain('setCapHintForId');
  });

  it('updates the header to "X of N — deselect to swap" when at cap', () => {
    const src = read();
    expect(src).toContain('deselect to swap');
  });

  it('keeps deselection unconditional', () => {
    // The toggle must early-return on the deselect branch BEFORE the
    // cap check — otherwise users could not deselect at cap.
    const src = read();
    const togglePos = src.indexOf('const toggle = (id: string) =>');
    expect(togglePos).toBeGreaterThan(-1);
    const slice = src.slice(togglePos, togglePos + 600);
    const deselectIdx = slice.indexOf('current.filter((x) => x !== id)');
    const capCheckIdx = slice.indexOf('current.length >= MAX_DASHBOARD_TILES');
    expect(deselectIdx).toBeGreaterThan(-1);
    expect(capCheckIdx).toBeGreaterThan(deselectIdx);
  });
});
