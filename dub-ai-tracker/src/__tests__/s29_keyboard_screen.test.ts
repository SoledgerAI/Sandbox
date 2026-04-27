// S29-A: KeyboardAwareScreen + logger wiring.
// Verifies the wrapper exists and that the loggers Josh flagged
// (Sleep Notes TF#4, Stress TF#11, plus Mood/Journal/Substance)
// route their TextInputs through it.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('S29-A: Keyboard avoidance', () => {
  it('exports a KeyboardAwareScreen component', () => {
    const src = read('src/components/KeyboardAwareScreen.tsx');
    expect(src).toContain('export function KeyboardAwareScreen');
    expect(src).toContain('KeyboardAvoidingView');
    expect(src).toContain('keyboardShouldPersistTaps="handled"');
  });

  const wrappedLoggers = [
    'src/components/logging/SleepLogger.tsx',
    'src/components/logging/StressLogger.tsx',
    'src/components/logging/MoodPicker.tsx',
    'src/components/logging/MoodMentalLogger.tsx',
    'src/components/logging/JournalLogger.tsx',
    'src/components/logging/SubstanceLogger.tsx',
  ];

  it.each(wrappedLoggers)(
    '%s renders KeyboardAwareScreen',
    (rel) => {
      const src = read(rel);
      expect(src).toContain('KeyboardAwareScreen');
    },
  );

  it.each(wrappedLoggers)(
    '%s no longer hardcodes the wrong keyboardVerticalOffset',
    (rel) => {
      const src = read(rel);
      expect(src).not.toContain('keyboardVerticalOffset={Platform.OS === \'ios\' ? 90 : 0}');
    },
  );
});
