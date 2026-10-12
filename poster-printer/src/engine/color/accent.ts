// Phase 15 (Ar't alignment §7, Q2): ONE accent rule for the gate, the audit and art direction.
// Before: gate 8 % (contrasting only), audit 15 % (any accent ≠ ground), direction 15 % (any accent-filled zone), docs 10 %.
// Now: only an OPPONENT accent is capped, at 15 %. A spot colour in the field's own hue family (or an achromatic one) is
// part of the field and never counted. Evidence (白, U1): accent 2–15 % averaged 7.6 (n=10) vs 7.28 below 2 %; >15 % 7.0 (n=4).
import { hexToOklch } from './oklch';

export const ACCENT_CAP = 0.15;
/** hue families merge within 60° (gates R1); chroma ≤ 0.05 is achromatic */
export function isOpponentAccent(accent: string, field: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(accent) || !/^#[0-9a-f]{6}$/i.test(field)) return false;
  const [, ca, ha] = hexToOklch(accent), [, cf, hf] = hexToOklch(field);
  if (ca <= 0.05) return false;
  if (cf <= 0.05) return true;
  return Math.abs(((ha - hf + 540) % 360) - 180) > 60;
}
