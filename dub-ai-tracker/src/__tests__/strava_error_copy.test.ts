// S34-A step 6: stravaErrorToUserCopy - hybrid error-to-UX mapping (PQ-A5).

import { stravaErrorToUserCopy, StravaError } from '../services/strava';

describe('stravaErrorToUserCopy', () => {
  it('detailed copy for INVALID_CODE', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'INVALID_CODE'));
    expect(msg).toMatch(/timed out/i);
  });

  it('detailed copy for RATE_LIMITED', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'RATE_LIMITED'));
    expect(msg).toMatch(/too many/i);
  });

  it('detailed copy for STATE_MISMATCH', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'STATE_MISMATCH'));
    expect(msg).toMatch(/security check/i);
  });

  it('NETWORK explains connectivity', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'NETWORK'));
    expect(msg).toMatch(/connection/i);
  });

  it('STRAVA_5XX names Strava as the issue', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'STRAVA_5XX'));
    expect(msg).toMatch(/strava/i);
  });

  it('generic copy for INVALID_VERIFIER', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'INVALID_VERIFIER'));
    expect(msg).toMatch(/connection failed/i);
  });

  it('generic copy for MALFORMED_TOKEN_RESPONSE', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'MALFORMED_TOKEN_RESPONSE'));
    expect(msg).toMatch(/connection failed/i);
  });

  it('generic copy for unknown / catch-all codes', () => {
    const msg = stravaErrorToUserCopy(new StravaError('x', 'REFRESH_FAILED'));
    expect(msg).toMatch(/connection failed/i);
  });

  it('returns no empty strings', () => {
    const codes = [
      'NO_CLIENT_ID',
      'CANNOT_OPEN_URL',
      'STATE_MISMATCH',
      'NETWORK',
      'INVALID_CODE',
      'INVALID_VERIFIER',
      'RATE_LIMITED',
      'STRAVA_5XX',
      'MALFORMED_TOKEN_RESPONSE',
      'NOT_CONNECTED',
      'FETCH_FAILED',
      'REFRESH_FAILED',
    ] as const;
    for (const code of codes) {
      const msg = stravaErrorToUserCopy(new StravaError('x', code));
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});
