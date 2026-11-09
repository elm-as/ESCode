"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyDistance = void 0;
/**
 * Computes weighted probabilities for typing errors based on physical key distance.
 * Closer keys are more likely to be hit accidentally.
 */
class KeyDistance {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    /**
     * Calculate the Euclidean distance between two characters on the keyboard.
     * Returns Infinity if either character is not in the layout.
     */
    distance(charA, charB) {
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
    getAdjacentChars(char, maxDistance = 1.5) {
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
    getWeightedRandomNeighbor(char, random) {
        const neighbors = this.layout.getNeighbors(char);
        if (neighbors.length === 0) {
            return char;
        }
        // Calculate weights inversely proportional to distance
        const weighted = [];
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
    euclidean(a, b) {
        const colOffsetA = a.col + a.row * 0.25;
        const colOffsetB = b.col + b.row * 0.25;
        const dx = colOffsetA - colOffsetB;
        const dy = a.row - b.row;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
exports.KeyDistance = KeyDistance;
//# sourceMappingURL=KeyDistance.js.map