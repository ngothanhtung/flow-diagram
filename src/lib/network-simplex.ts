// Network simplex — the integer program Graphviz's `dot` solves to place
// nodes (Gansner, Koutsofios, North & Vo, "A Technique for Drawing Directed
// Graphs", 1993):
//
//     minimise   Σ weight(e) · (value(head) − value(tail))
//     subject to value(head) − value(tail) ≥ minlen(e)   for every edge e
//
// Auto-layout uses it for the across-the-flow coordinate: "pull a Block
// into line with what it connects to" is the objective, "don't let
// neighbours in a rank overlap" is the constraint set. Pure and
// dependency-free; covered by `network-simplex.test.ts`.
//
// The implementation follows the paper (and dagre's port of it): a
// feasible tight spanning tree, cut values, then repeatedly swap a tree
// edge with a negative cut value for the non-tree edge of least slack.
// `balance` adds dot's left-right balancing, which moves a subtree to the
// middle of its free range when doing so costs nothing — without it a
// parent with two children sits flush above one of them, since anywhere
// between the two is equally cheap.

export interface SimplexEdge {
  tail: number;
  head: number;
  minlen: number;
  weight: number;
}

interface Edge {
  tail: number;
  head: number;
  minlen: number;
  weight: number;
}

/**
 * Solve for `nodeCount` integer values. Every `minlen` must be an integer
 * and the constraint graph must be acyclic. Values are normalised so the
 * smallest is 0. Parallel edges are merged (weights summed, the largest
 * minlen kept); a disconnected graph is joined through a virtual root that
 * adds no cost.
 */
export function networkSimplex(nodeCount: number, input: SimplexEdge[], options: { balance?: boolean; maxIterations?: number } = {}): number[] {
  if (nodeCount === 0) return [];
  const maxIterations = options.maxIterations ?? 5000;

  // Merge parallel edges.
  const merged = new Map<string, Edge>();
  for (const edge of input) {
    if (edge.tail === edge.head) continue;
    const key = `${edge.tail}>${edge.head}`;
    const existing = merged.get(key);
    if (existing) {
      existing.weight += edge.weight;
      existing.minlen = Math.max(existing.minlen, edge.minlen);
    } else merged.set(key, { ...edge });
  }
  const edges: Edge[] = [...merged.values()];

  // Join components through a virtual root so the spanning tree exists.
  let n = nodeCount;
  {
    const seen = new Array<boolean>(n).fill(false);
    const adjacency: number[][] = Array.from({ length: n }, () => []);
    for (const edge of edges) {
      adjacency[edge.tail].push(edge.head);
      adjacency[edge.head].push(edge.tail);
    }
    const representatives: number[] = [];
    for (let start = 0; start < n; start += 1) {
      if (seen[start]) continue;
      representatives.push(start);
      const stack = [start];
      seen[start] = true;
      while (stack.length > 0) {
        const v = stack.pop()!;
        for (const w of adjacency[v]) {
          if (!seen[w]) {
            seen[w] = true;
            stack.push(w);
          }
        }
      }
    }
    if (representatives.length > 1) {
      const root = n;
      n += 1;
      for (const representative of representatives) edges.push({ tail: root, head: representative, minlen: 0, weight: 0 });
    }
  }

  const incident: number[][] = Array.from({ length: n }, () => []);
  edges.forEach((edge, index) => {
    incident[edge.tail].push(index);
    incident[edge.head].push(index);
  });

  // 1. Feasible initial values: longest path over the DAG.
  const rank = new Array<number>(n).fill(0);
  {
    const indegree = new Array<number>(n).fill(0);
    for (const edge of edges) indegree[edge.head] += 1;
    const queue: number[] = [];
    for (let v = 0; v < n; v += 1) if (indegree[v] === 0) queue.push(v);
    const visited = new Array<boolean>(n).fill(false);
    let processed = 0;
    while (queue.length > 0) {
      const v = queue.shift()!;
      visited[v] = true;
      processed += 1;
      for (const index of incident[v]) {
        const edge = edges[index];
        if (edge.tail !== v) continue;
        rank[edge.head] = Math.max(rank[edge.head], rank[v] + edge.minlen);
        indegree[edge.head] -= 1;
        if (indegree[edge.head] === 0) queue.push(edge.head);
      }
    }
    if (processed < n) throw new Error('networkSimplex: constraint graph has a cycle');
  }

  const slack = (index: number) => rank[edges[index].head] - rank[edges[index].tail] - edges[index].minlen;

  // 2. Feasible tight spanning tree.
  const inTree = new Array<boolean>(edges.length).fill(false);
  const treeNode = new Array<boolean>(n).fill(false);
  {
    treeNode[0] = true;
    let size = 1;
    const grow = () => {
      const stack: number[] = [];
      for (let v = 0; v < n; v += 1) if (treeNode[v]) stack.push(v);
      while (stack.length > 0) {
        const v = stack.pop()!;
        for (const index of incident[v]) {
          const edge = edges[index];
          const w = edge.tail === v ? edge.head : edge.tail;
          if (!treeNode[w] && slack(index) === 0) {
            treeNode[w] = true;
            inTree[index] = true;
            size += 1;
            stack.push(w);
          }
        }
      }
    };
    grow();
    while (size < n) {
      let best = -1;
      let bestSlack = Infinity;
      edges.forEach((edge, index) => {
        if (treeNode[edge.tail] === treeNode[edge.head]) return;
        const value = slack(index);
        if (value < bestSlack) {
          bestSlack = value;
          best = index;
        }
      });
      const delta = treeNode[edges[best].tail] ? bestSlack : -bestSlack;
      for (let v = 0; v < n; v += 1) if (treeNode[v]) rank[v] += delta;
      grow();
    }
  }

  // Tree bookkeeping: parent edge, postorder low/lim, cut values.
  const parent = new Array<number>(n).fill(-1);
  const parentEdge = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const lim = new Array<number>(n).fill(0);
  const cut = new Array<number>(edges.length).fill(0);
  const root = 0;

  const treeNeighbours = (v: number) => incident[v].filter((index) => inTree[index]);

  const initTree = () => {
    // Iterative postorder DFS from the root.
    let next = 1;
    parent[root] = -1;
    parentEdge[root] = -1;
    const stack: Array<{ v: number; iterator: number; low: number }> = [{ v: root, iterator: 0, low: next }];
    const order: number[] = [];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbours = treeNeighbours(frame.v);
      if (frame.iterator < neighbours.length) {
        const index = neighbours[frame.iterator++];
        const edge = edges[index];
        const w = edge.tail === frame.v ? edge.head : edge.tail;
        if (w === parent[frame.v] && index === parentEdge[frame.v]) continue;
        parent[w] = frame.v;
        parentEdge[w] = index;
        stack.push({ v: w, iterator: 0, low: next });
      } else {
        low[frame.v] = frame.low;
        lim[frame.v] = next++;
        order.push(frame.v);
        stack.pop();
      }
    }
    // Cut values, children before parents.
    for (const child of order) {
      if (child === root) continue;
      const index = parentEdge[child];
      const childIsTail = edges[index].tail === child;
      let value = edges[index].weight;
      for (const otherIndex of incident[child]) {
        if (otherIndex === index) continue;
        const other = edges[otherIndex];
        const isOut = other.tail === child;
        const pointsToHead = isOut === childIsTail;
        value += pointsToHead ? other.weight : -other.weight;
        if (inTree[otherIndex]) value += pointsToHead ? -cut[otherIndex] : cut[otherIndex];
      }
      cut[index] = value;
    }
  };

  const isDescendant = (v: number, of: number) => low[of] <= lim[v] && lim[v] <= lim[of];

  /** The non-tree edge that replaces tree edge `index`, or -1. */
  const enterEdge = (index: number) => {
    const edge = edges[index];
    let tailSide = edge.tail;
    let flip = false;
    if (lim[edge.tail] > lim[edge.head]) {
      tailSide = edge.head;
      flip = true;
    }
    let best = -1;
    let bestSlack = Infinity;
    edges.forEach((candidate, candidateIndex) => {
      if (inTree[candidateIndex]) return;
      if (flip === isDescendant(candidate.tail, tailSide) && flip !== isDescendant(candidate.head, tailSide)) {
        const value = slack(candidateIndex);
        if (value < bestSlack) {
          bestSlack = value;
          best = candidateIndex;
        }
      }
    });
    return best;
  };

  const updateRanks = () => {
    // Preorder from the root, each child placed tight against its parent.
    const stack = [root];
    const visited = new Array<boolean>(n).fill(false);
    visited[root] = true;
    while (stack.length > 0) {
      const v = stack.pop()!;
      for (const index of treeNeighbours(v)) {
        const edge = edges[index];
        const w = edge.tail === v ? edge.head : edge.tail;
        if (visited[w]) continue;
        visited[w] = true;
        rank[w] = edge.tail === v ? rank[v] + edge.minlen : rank[v] - edge.minlen;
        stack.push(w);
      }
    }
  };

  initTree();
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let leave = -1;
    for (let index = 0; index < edges.length; index += 1) {
      if (inTree[index] && cut[index] < 0) {
        leave = index;
        break;
      }
    }
    if (leave === -1) break;
    const enter = enterEdge(leave);
    if (enter === -1) break;
    inTree[leave] = false;
    inTree[enter] = true;
    initTree();
    updateRanks();
  }

  if (options.balance) {
    // dot's LR_balance: a zero-cut tree edge means its subtree can slide
    // freely within the entering edge's slack; centre it in that range.
    const shiftSubtree = (v: number, delta: number) => {
      const stack = [v];
      const visited = new Set<number>([v, parent[v]]);
      while (stack.length > 0) {
        const u = stack.pop()!;
        rank[u] -= delta;
        for (const index of treeNeighbours(u)) {
          const edge = edges[index];
          const w = edge.tail === u ? edge.head : edge.tail;
          if (visited.has(w)) continue;
          visited.add(w);
          stack.push(w);
        }
      }
    };
    for (let index = 0; index < edges.length; index += 1) {
      if (!inTree[index] || cut[index] !== 0) continue;
      const enter = enterEdge(index);
      if (enter === -1) continue;
      const delta = slack(enter);
      if (delta <= 1) continue;
      const edge = edges[index];
      if (lim[edge.tail] < lim[edge.head]) shiftSubtree(edge.tail, Math.floor(delta / 2));
      else shiftSubtree(edge.head, -Math.floor(delta / 2));
    }
  }

  const values = rank.slice(0, nodeCount);
  const minimum = Math.min(...values);
  return values.map((value) => value - minimum);
}
