// Sprint 2 Fix 1: Haptic feedback utility tests

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error', Warning: 'Warning' },
}));

import * as Haptics from 'expo-haptics';
import {
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticSuccess,
  hapticError,
  hapticWarning,
  hapticSelection,
} from '../utils/haptics';

describe('Haptic feedback utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hapticLight calls impactAsync with Light', async () => {
    await hapticLight();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('Light');
  });

  it('hapticMedium calls impactAsync with Medium', async () => {
    await hapticMedium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('Medium');
  });

  it('hapticHeavy calls impactAsync with Heavy', async () => {
    await hapticHeavy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('Heavy');
  });

  it('hapticSuccess calls notificationAsync with Success', async () => {
    await hapticSuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('Success');
  });

  it('hapticError calls notificationAsync with Error', async () => {
    await hapticError();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('Error');
  });

  it('hapticWarning calls notificationAsync with Warning', async () => {
    await hapticWarning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('Warning');
  });

  it('hapticSelection calls selectionAsync', async () => {
    await hapticSelection();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('no function throws when called', async () => {
    await expect(hapticLight()).resolves.not.toThrow();
    await expect(hapticMedium()).resolves.not.toThrow();
    await expect(hapticHeavy()).resolves.not.toThrow();
    await expect(hapticSuccess()).resolves.not.toThrow();
    await expect(hapticError()).resolves.not.toThrow();
    await expect(hapticWarning()).resolves.not.toThrow();
    await expect(hapticSelection()).resolves.not.toThrow();
  });
});
