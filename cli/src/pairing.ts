/**
 * StackShift pairing detection. Reads `.stackshift/installed.json` if present.
 */
import { join } from 'node:path';
import { readJsonSafe } from './fs-utils.js';

export interface PairingState {
  paired: boolean;
  a11yRequired: boolean;
  invalid: boolean;
  installedJson?: Record<string, unknown>;
}

export function detectPairing(cwd: string): PairingState {
  const path = join(cwd, '.stackshift', 'installed.json');
  const data = readJsonSafe<Record<string, unknown>>(path);
  if (!data) return { paired: false, a11yRequired: false, invalid: false };
  // Minimal validity check — expects an object with at least one field we can name.
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { paired: false, a11yRequired: false, invalid: true };
  }
  return {
    paired: true,
    a11yRequired: data.a11yRequired === true,
    invalid: false,
    installedJson: data,
  };
}
