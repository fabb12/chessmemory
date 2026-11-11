import type { BoardOrientationPreference, Side } from '../types';

export function resolveOrientation(pref: BoardOrientationPreference, side: Side): 'white' | 'black' {
  if (pref === 'white' || pref === 'black') return pref;
  return side === 'w' ? 'white' : 'black';
}
