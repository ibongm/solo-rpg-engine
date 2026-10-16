import { describe, it, expect } from 'vitest';
import { isBackgroundInterruption, shouldAutoResume, MAX_AUTO_RETRIES, BACKGROUND_GRACE_MS } from './turnRecovery.js';

const net = { code: 'network' };

describe('turn recovery', () => {
  it('treats a network drop while hidden (or hidden mid-request) as a background pause', () => {
    expect(isBackgroundInterruption(net, { visibility: 'hidden', startedAt: 100, now: 200 })).toBe(true);
    expect(isBackgroundInterruption(net, { visibility: 'visible', startedAt: 100, lastHiddenAt: 150, lastVisibleAt: 190, now: 200 })).toBe(true);
    expect(isBackgroundInterruption({ code: 'timeout' }, { visibility: 'hidden', startedAt: 0, now: 1 })).toBe(true);
  });

  it('allows a short grace window right after returning to the app', () => {
    const p = { visibility: 'visible', startedAt: 1000, lastHiddenAt: 500, lastVisibleAt: 900 };
    expect(isBackgroundInterruption(net, { ...p, now: 900 + BACKGROUND_GRACE_MS })).toBe(true);
    expect(isBackgroundInterruption(net, { ...p, now: 900 + BACKGROUND_GRACE_MS + 1 })).toBe(false);
  });

  it('keeps real failures as failures', () => {
    expect(isBackgroundInterruption(net, { visibility: 'visible', startedAt: 100, now: 200 })).toBe(false);
    expect(isBackgroundInterruption({ code: 'http' }, { visibility: 'hidden', startedAt: 0, now: 1 })).toBe(false);
    expect(isBackgroundInterruption(null, { visibility: 'hidden', startedAt: 0, now: 1 })).toBe(false);
  });

  it('auto-resumes paused turns and retries failed ones a limited number of times', () => {
    expect(shouldAutoResume(null)).toBe(false);
    expect(shouldAutoResume({ status: 'paused_background', autoRetries: 9 })).toBe(true);
    expect(shouldAutoResume({ status: 'failed', retryable: true, autoRetries: 0 })).toBe(true);
    expect(shouldAutoResume({ status: 'failed', retryable: true, autoRetries: MAX_AUTO_RETRIES })).toBe(false);
    expect(shouldAutoResume({ status: 'failed', retryable: false })).toBe(false);
    expect(shouldAutoResume({ status: 'pending' })).toBe(false);
  });
});
