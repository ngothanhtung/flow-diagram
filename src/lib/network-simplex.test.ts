import { describe, expect, it } from 'vitest';
import { networkSimplex, type SimplexEdge } from './network-simplex';

const cost = (values: number[], edges: SimplexEdge[]) => edges.reduce((total, edge) => total + edge.weight * (values[edge.head] - values[edge.tail]), 0);
const feasible = (values: number[], edges: SimplexEdge[]) => edges.every((edge) => values[edge.head] - values[edge.tail] >= edge.minlen);

describe('networkSimplex', () => {
  it('keeps every constraint and pulls weighted edges tight', () => {
    // a → b → c with a long optional edge a → c.
    const edges: SimplexEdge[] = [
      { tail: 0, head: 1, minlen: 1, weight: 1 },
      { tail: 1, head: 2, minlen: 1, weight: 1 },
      { tail: 0, head: 2, minlen: 1, weight: 5 },
    ];
    const values = networkSimplex(3, edges);
    expect(feasible(values, edges)).toBe(true);
    expect(values).toEqual([0, 1, 2]);
  });

  it('lines a node up with the median of what it connects to', () => {
    // Variables 0..2 are positions in one rank (left to right, 100 apart);
    // 3 is a node in the next rank wired to 0 and 1 and 2. Aux nodes 4..6
    // model |x3 - xi| as in dot.
    const edges: SimplexEdge[] = [
      { tail: 0, head: 1, minlen: 100, weight: 0 },
      { tail: 1, head: 2, minlen: 100, weight: 0 },
    ];
    [0, 1, 2].forEach((i, k) => {
      edges.push({ tail: 4 + k, head: i, minlen: 0, weight: 1 }, { tail: 4 + k, head: 3, minlen: 0, weight: 1 });
    });
    const values = networkSimplex(7, edges);
    expect(feasible(values, edges)).toBe(true);
    expect(values[3]).toBe(values[1]);
  });

  it('centres a parent over its two children when that costs nothing extra', () => {
    // 0, 1: children 120 apart; 2: parent. 3, 4: aux.
    const edges: SimplexEdge[] = [
      { tail: 0, head: 1, minlen: 120, weight: 0 },
      { tail: 3, head: 0, minlen: 0, weight: 1 },
      { tail: 3, head: 2, minlen: 0, weight: 1 },
      { tail: 4, head: 1, minlen: 0, weight: 1 },
      { tail: 4, head: 2, minlen: 0, weight: 1 },
    ];
    const plain = networkSimplex(5, edges);
    const balanced = networkSimplex(5, edges, { balance: true });
    expect(cost(balanced, edges)).toBe(cost(plain, edges));
    expect(balanced[2] - balanced[0]).toBe(60);
  });

  it('joins disconnected components without changing the cost', () => {
    const edges: SimplexEdge[] = [
      { tail: 0, head: 1, minlen: 3, weight: 1 },
      { tail: 2, head: 3, minlen: 4, weight: 1 },
    ];
    const values = networkSimplex(4, edges);
    expect(values[1] - values[0]).toBe(3);
    expect(values[3] - values[2]).toBe(4);
  });

  it('refuses a cyclic constraint graph', () => {
    expect(() => networkSimplex(2, [{ tail: 0, head: 1, minlen: 1, weight: 1 }, { tail: 1, head: 0, minlen: 1, weight: 1 }])).toThrow();
  });
});
