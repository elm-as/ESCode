import { KeyboardKey, KeyboardLayoutMap, KeyPosition } from '../types';

/**
 * Full AZERTY keyboard layout with physical key positions.
 * Positions are (row, col) where row 0 is the number row and col 0 is leftmost.
 * Each key maps to its unshifted char, shifted char, and optionally AltGr char.
 */

// Row definitions for the AZERTY keyboard
// Row 0: number row
// Row 1: top letter row (azertyuiop)
// Row 2: home row (qsdfghjklm)
// Row 3: bottom row (wxcvbn,;:!)

const AZERTY_ROWS: KeyboardKey[][] = [
  // Row 0: Number row
  [
    { char: '²', position: { row: 0, col: 0 } },
    { char: '&', position: { row: 0, col: 1 }, shifted: '1' },
    { char: 'é', position: { row: 0, col: 2 }, shifted: '2', altGr: '~' },
    { char: '"', position: { row: 0, col: 3 }, shifted: '3', altGr: '#' },
    { char: '\'', position: { row: 0, col: 4 }, shifted: '4', altGr: '{' },
    { char: '(', position: { row: 0, col: 5 }, shifted: '5', altGr: '[' },
    { char: '-', position: { row: 0, col: 6 }, shifted: '6', altGr: '|' },
    { char: 'è', position: { row: 0, col: 7 }, shifted: '7', altGr: '`' },
    { char: '_', position: { row: 0, col: 8 }, shifted: '8', altGr: '\\' },
    { char: 'ç', position: { row: 0, col: 9 }, shifted: '9', altGr: '^' },
    { char: 'à', position: { row: 0, col: 10 }, shifted: '0', altGr: '@' },
    { char: ')', position: { row: 0, col: 11 }, shifted: '°', altGr: ']' },
    { char: '=', position: { row: 0, col: 12 }, shifted: '+', altGr: '}' },
  ],
  // Row 1: Top letter row
  [
    { char: 'a', position: { row: 1, col: 0 }, shifted: 'A' },
    { char: 'z', position: { row: 1, col: 1 }, shifted: 'Z' },
    { char: 'e', position: { row: 1, col: 2 }, shifted: 'E', altGr: '€' },
    { char: 'r', position: { row: 1, col: 3 }, shifted: 'R' },
    { char: 't', position: { row: 1, col: 4 }, shifted: 'T' },
    { char: 'y', position: { row: 1, col: 5 }, shifted: 'Y' },
    { char: 'u', position: { row: 1, col: 6 }, shifted: 'U' },
    { char: 'i', position: { row: 1, col: 7 }, shifted: 'I' },
    { char: 'o', position: { row: 1, col: 8 }, shifted: 'O' },
    { char: 'p', position: { row: 1, col: 9 }, shifted: 'P' },
    { char: '^', position: { row: 1, col: 10 }, shifted: '¨' },
    { char: '$', position: { row: 1, col: 11 }, shifted: '£', altGr: '¤' },
  ],
  // Row 2: Home row
  [
    { char: 'q', position: { row: 2, col: 0 }, shifted: 'Q' },
    { char: 's', position: { row: 2, col: 1 }, shifted: 'S' },
    { char: 'd', position: { row: 2, col: 2 }, shifted: 'D' },
    { char: 'f', position: { row: 2, col: 3 }, shifted: 'F' },
    { char: 'g', position: { row: 2, col: 4 }, shifted: 'G' },
    { char: 'h', position: { row: 2, col: 5 }, shifted: 'H' },
    { char: 'j', position: { row: 2, col: 6 }, shifted: 'J' },
    { char: 'k', position: { row: 2, col: 7 }, shifted: 'K' },
    { char: 'l', position: { row: 2, col: 8 }, shifted: 'L' },
    { char: 'm', position: { row: 2, col: 9 }, shifted: 'M' },
    { char: 'ù', position: { row: 2, col: 10 }, shifted: '%' },
    { char: '*', position: { row: 2, col: 11 }, shifted: 'µ' },
  ],
  // Row 3: Bottom row
  [
    { char: '<', position: { row: 3, col: 0 }, shifted: '>' },
    { char: 'w', position: { row: 3, col: 1 }, shifted: 'W' },
    { char: 'x', position: { row: 3, col: 2 }, shifted: 'X' },
    { char: 'c', position: { row: 3, col: 3 }, shifted: 'C' },
    { char: 'v', position: { row: 3, col: 4 }, shifted: 'V' },
    { char: 'b', position: { row: 3, col: 5 }, shifted: 'B' },
    { char: 'n', position: { row: 3, col: 6 }, shifted: 'N' },
    { char: ',', position: { row: 3, col: 7 }, shifted: '?' },
    { char: ';', position: { row: 3, col: 8 }, shifted: '.' },
    { char: ':', position: { row: 3, col: 9 }, shifted: '/' },
    { char: '!', position: { row: 3, col: 10 }, shifted: '§' },
  ],
  // Row 4: Space bar row
  [
    { char: ' ', position: { row: 4, col: 5 }, shifted: ' ' },
  ],
];

/**
 * Build a flat lookup map from character → KeyboardKey.
 * Includes unshifted, shifted, and altGr variants.
 */
function buildLayoutMap(): KeyboardLayoutMap {
  const map: KeyboardLayoutMap = {};

  for (const row of AZERTY_ROWS) {
    for (const key of row) {
      map[key.char] = key;
      if (key.shifted && !map[key.shifted]) {
        map[key.shifted] = {
          char: key.shifted,
          position: key.position,
          shifted: key.char,
        };
      }
      if (key.altGr && !map[key.altGr]) {
        map[key.altGr] = {
          char: key.altGr,
          position: key.position,
        };
      }
    }
  }

  return map;
}

export class AzertyLayout {
  private readonly layoutMap: KeyboardLayoutMap;
  private readonly allKeys: KeyboardKey[];

  constructor() {
    this.layoutMap = buildLayoutMap();
    this.allKeys = AZERTY_ROWS.flat();
  }

  /**
   * Get the key information for a character.
   */
  getKey(char: string): KeyboardKey | undefined {
    return this.layoutMap[char];
  }

  /**
   * Get all keys in the layout.
   */
  getAllKeys(): KeyboardKey[] {
    return [...this.allKeys];
  }

  /**
   * Get all characters known to this layout.
   */
  getAllChars(): string[] {
    return Object.keys(this.layoutMap);
  }

  /**
   * Check if a character exists in this layout.
   */
  hasChar(char: string): boolean {
    return char in this.layoutMap;
  }

  /**
   * Get the physical position of a character on the keyboard.
   */
  getPosition(char: string): KeyPosition | undefined {
    return this.layoutMap[char]?.position;
  }

  /**
   * Get neighboring characters (adjacent keys) sorted by distance.
   * Only returns lowercase letter neighbors for letter inputs.
   */
  getNeighbors(char: string): string[] {
    const key = this.layoutMap[char];
    if (!key) {
      return [];
    }

    const pos = key.position;
    const neighbors: Array<{ char: string; distance: number }> = [];

    for (const otherKey of this.allKeys) {
      if (otherKey.char === char || otherKey.char === ' ') {
        continue;
      }

      const dist = this.euclideanDistance(pos, otherKey.position);
      // Only consider keys within ~1.5 key distance as "adjacent"
      if (dist <= 1.5) {
        neighbors.push({ char: otherKey.char, distance: dist });
      }
    }

    neighbors.sort((a, b) => a.distance - b.distance);
    return neighbors.map(n => n.char);
  }

  /**
   * Euclidean distance between two key positions.
   * Accounts for the stagger between keyboard rows.
   */
  private euclideanDistance(a: KeyPosition, b: KeyPosition): number {
    // Keyboard rows are slightly staggered; approximate with 0.25 col offset per row
    const colOffsetA = a.col + a.row * 0.25;
    const colOffsetB = b.col + b.row * 0.25;
    const dx = colOffsetA - colOffsetB;
    const dy = a.row - b.row;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
