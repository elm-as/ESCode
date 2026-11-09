import { KeyPosition } from '../types';
import { AzertyLayout } from './AzertyLayout';

/**
 * Computes weighted probabilities for typing errors based on physical key distance.
 * Closer keys are more likely to be hit accidentally.
 */
export class KeyDistance {
  private readonly layout: AzertyLayout;

  constructor(layout: AzertyLayout) {
    this.layout = layout;
  }

  /**
   * Calculate the Euclidean distance between two characters on the keyboard.
   * Returns Infinity if either character is not in the layout.
   */
  distance(charA: string, charB: string): number {
    const posA = this.layout.getPosition(charA);
    const posB = this.layout.getPosition(charB);
    if (!posA || !posB) {
      return Infinity;
    }
    return this.euclidean(posA, posB);
  }

  /**
   * Get adjacent characters for a key, sorted by proximity.
   * Returns characters within a configurable radius.
   */
  getAdjacentChars(char: string, maxDistance: number = 1.5): string[] {
    return this.layout.getNeighbors(char).filter(neighbor => {
      return this.distance(char, neighbor) <= maxDistance;
    });
  }

  /**
   * Get a weighted random neighbor for a character.
   * Closer keys have higher probability of being selected.
   * @param char The target character
   * @param random A random value between 0 and 1
   * @returns The selected neighbor character, or the original if no neighbors
   */
  getWeightedRandomNeighbor(char: string, random: number): string {
    const neighbors = this.layout.getNeighbors(char);
    if (neighbors.length === 0) {
      return char;
    }

    // Calculate weights inversely proportional to distance
    const weighted: Array<{ char: string; weight: number }> = [];
    let totalWeight = 0;

    for (const neighbor of neighbors) {
      const dist = this.distance(char, neighbor);
      if (dist > 0 && dist < Infinity) {
        // Inverse square weighting: closer keys are much more likely
        const weight = 1 / (dist * dist);
        totalWeight += weight;
        weighted.push({ char: neighbor, weight });
      }
    }

    if (totalWeight === 0) {
      return neighbors[0] || char;
    }

    // Select based on weighted probability
    let cumulative = 0;
    const threshold = random * totalWeight;

    for (const entry of weighted) {
      cumulative += entry.weight;
      if (cumulative >= threshold) {
        return entry.char;
      }
    }

    return weighted[weighted.length - 1]?.char ?? char;
  }

  private euclidean(a: KeyPosition, b: KeyPosition): number {
    const colOffsetA = a.col + a.row * 0.25;
    const colOffsetB = b.col + b.row * 0.25;
    const dx = colOffsetA - colOffsetB;
    const dy = a.row - b.row;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
