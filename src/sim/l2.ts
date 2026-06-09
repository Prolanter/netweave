import type { Node, Edge } from '@xyflow/react';
import type { DeviceData } from '../types';
import { DEVICE_DEFS } from '../data/deviceDefs';

type DNode = Node<DeviceData>;

// Devices a frame can transparently pass *through* at Layer 2.
function canTransit(n: DNode): boolean {
  const r = DEVICE_DEFS[n.data.kind]?.role;
  return r === 'l2' || r === 'wan';
}
// Only real switches enforce VLAN membership; hubs/APs/cloud are VLAN-transparent.
function enforcesVlan(n: DNode): boolean {
  return n.data.kind === 'switch';
}

export function edgeVlan(e: Edge): number {
  return (e.data?.vlan as number) ?? 1;
}
export function edgeTrunk(e: Edge): boolean {
  return !!e.data?.trunk;
}

export function buildAdj(nodes: DNode[], edges: Edge[]): Map<string, { to: string; edge: Edge }[]> {
  const adj = new Map<string, { to: string; edge: Edge }[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push({ to: e.target, edge: e });
      adj.get(e.target)!.push({ to: e.source, edge: e });
    }
  }
  return adj;
}

type V = number | 'X'; // 'X' = no VLAN context yet (before entering a switch)

/**
 * VLAN-aware Layer-2 path from `fromId` to `toId`. A frame may only pass through
 * transit devices (switches/hubs/cloud), switches enforce VLAN membership, and
 * trunk links carry every VLAN. Returns the node-id path, or null.
 */
export function l2Path(
  byId: Map<string, DNode>,
  adj: Map<string, { to: string; edge: Edge }[]>,
  fromId: string,
  toId: string
): string[] | null {
  const key = (id: string, v: V) => `${id}|${v}`;
  const prev = new Map<string, { node: string; vlan: V } | null>();
  prev.set(key(fromId, 'X'), null);
  const queue: { node: string; vlan: V }[] = [{ node: fromId, vlan: 'X' }];

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.node === toId) {
      const path: string[] = [];
      let c: { node: string; vlan: V } | null = cur;
      while (c) {
        path.unshift(c.node);
        c = prev.get(key(c.node, c.vlan)) ?? null;
      }
      return path;
    }
    const node = byId.get(cur.node)!;
    // Only the source and transparent transit devices forward the frame onward.
    if (cur.node !== fromId && !canTransit(node)) continue;

    const curEnforces = enforcesVlan(node);
    for (const { to, edge } of adj.get(cur.node) ?? []) {
      let nv: V = cur.vlan;
      if (curEnforces) {
        // Leaving a switch: the egress link must carry the frame's VLAN.
        if (cur.vlan === 'X') {
          nv = edgeTrunk(edge) ? 'X' : edgeVlan(edge);
        } else if (!edgeTrunk(edge) && edgeVlan(edge) !== cur.vlan) {
          continue; // access port in a different VLAN: blocked
        }
      } else {
        // Leaving a host/router/hub: entering a switch sets the VLAN context.
        const toNode = byId.get(to)!;
        if (enforcesVlan(toNode)) {
          nv = edgeTrunk(edge) ? (cur.vlan === 'X' ? 1 : cur.vlan) : edgeVlan(edge);
        }
      }
      const k = key(to, nv);
      if (!prev.has(k)) {
        prev.set(k, cur);
        queue.push({ node: to, vlan: nv });
      }
    }
  }
  return null;
}
