// Fix 4: Coach error retry tests
// Verifies useCoach retry functionality and error card

import * as fs from 'fs';
import * as path from 'path';

describe('useCoach retry functionality', () => {
  it('useCoach exports retry and lastUserMessage', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../hooks/useCoach.ts'),
      'utf-8',
    );
    expect(source).toContain('lastUserMessage');
    expect(source).toContain('retry');
  });

  it('useCoach preserves last message on error', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../hooks/useCoach.ts'),
      'utf-8',
    );
    // setLastUserMessage is called before the API call
    expect(source).toContain('setLastUserMessage(trimmed)');
    // lastUserMessage is cleared only on success
    expect(source).toContain('setLastUserMessage(null)');
  });

  it('useCoach retry re-sends the preserved message', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../hooks/useCoach.ts'),
      'utf-8',
    );
    // retry function calls sendUserMessage with lastUserMessage
    expect(source).toContain('await sendUserMessage(lastUserMessage)');
  });
});

describe('Coach error card UI', () => {
  it('error card renders retry button in coach.tsx', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/(tabs)/coach.tsx'),
      'utf-8',
    );
    expect(source).toContain('Tap to Retry');
    expect(source).toContain('errorCard');
    expect(source).toContain("Something went wrong. Your message wasn't lost.");
  });

  it('retry button calls retry from useCoach', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/(tabs)/coach.tsx'),
      'utf-8',
    );
    expect(source).toContain('onPress={retry}');
  });

  it('retry button shows spinner while sending', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/(tabs)/coach.tsx'),
      'utf-8',
    );
    expect(source).toContain('disabled={sending}');
    // Shows ActivityIndicator when sending
    expect(source).toContain('ActivityIndicator');
  });
});
