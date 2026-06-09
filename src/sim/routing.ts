import type { Node, Edge } from '@xyflow/react';
import type { DeviceData, StaticRoute } from '../types';
import { DEVICE_DEFS } from '../data/deviceDefs';
import {
  ipToInt,
  isValidIp,
  maskToCidr,
  networkAddress,
  sameSubnet,
} from './ip';
import { buildAdj, l2Path } from './l2';

type DNode = Node<DeviceData>;

export interface RouteEntry {
  kind: 'connected' | 'static' | 'default';
  network: string;
  mask: string;
  cidr: number;
  iface?: string; // egress interface (connected)
  nextHop?: string; // next-hop IP (static/default)
}

export interface RouteResult {
  ok: boolean;
  reason: string;
  path: string[]; // full ordered node ids incl. L2 transit
  l3hops: { id: string; name: string; ip: string }[]; // routers crossed
}

const role = (n: DNode) => DEVICE_DEFS[n.data.kind].role;
const isHost = (n: DNode) => role(n) === 'host';
const isL3 = (n: DNode) => role(n) === 'l3';

/** Full routing table: connected interfaces + static routes + host default route. */
export function routingTableFull(node: DNode): RouteEntry[] {
  const entries: RouteEntry[] = [];
  for (const itf of node.data.interfaces) {
    if (!itf.up || !isValidIp(itf.ip)) continue;
    const net = networkAddress(itf.ip, itf.mask);
    const cidr = maskToCidr(itf.mask);
    if (net && cidr != null) {
      entries.push({ kind: 'connected', network: net, mask: itf.mask, cidr, iface: itf.name });
    }
  }
  for (const r of node.data.routes ?? []) {
    if (!isValidIp(r.nextHop)) continue;
    const net = networkAddress(r.network, r.mask) ?? r.network;
    const cidr = maskToCidr(r.mask) ?? 0;
    entries.push({ kind: 'static', network: net, mask: r.mask, cidr, nextHop: r.nextHop });
  }
  if (isHost(node) && isValidIp(node.data.gateway ?? '')) {
    entries.push({
      kind: 'default',
      network: '0.0.0.0',
      mask: '0.0.0.0',
      cidr: 0,
      nextHop: node.data.gateway,
    });
  }
  return entries;
}

function longestPrefixMatch(entries: RouteEntry[], dstIp: string): RouteEntry | null {
  const d = ipToInt(dstIp);
  if (d == null) return null;
  let best: RouteEntry | null = null;
  for (const e of entries) {
    const net = ipToInt(e.network);
    const mask = ipToInt(e.mask);
    if (net == null || mask == null) continue;
    if (((d & mask) >>> 0) === ((net & mask) >>> 0)) {
      if (!best || e.cidr > best.cidr) best = e;
    }
  }
  return best;
}

/**
 * Route a packet from srcId to the IP dstIp using each device's routing table
 * (connected + static + default), hopping router-by-router. Layer-2 segments
 * are traced VLAN-aware, so VLAN segmentation is respected.
 */
export function routePacket(
  nodes: DNode[],
  edges: Edge[],
  srcId: string,
  dstIp: string
): RouteResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = buildAdj(nodes, edges);
  const src = byId.get(srcId);
  if (!src) return { ok: false, reason: 'Source not found.', path: [], l3hops: [] };

  const dstNode = nodes.find((n) =>
    n.data.interfaces.some((i) => i.ip === dstIp && i.up)
  );

  const fullPath: string[] = [srcId];
  const l3hops: RouteResult['l3hops'] = [];
  const visited = new Set<string>([srcId]);
  let current = src;

  for (let guard = 0; guard < 64; guard++) {
    // Is the destination on a subnet directly connected to `current`?
    const localItf = current.data.interfaces.find(
      (i) => i.up && isValidIp(i.ip) && sameSubnet(i.ip, dstIp, i.mask)
    );
    if (localItf) {
      if (!dstNode) {
        return { ok: false, reason: `No device owns ${dstIp}.`, path: fullPath, l3hops };
      }
      if (dstNode.id === current.id) {
        return { ok: true, reason: 'delivered', path: fullPath, l3hops };
      }
      const seg = l2Path(byId, adj, current.id, dstNode.id);
      if (!seg) {
        return {
          ok: false,
          reason: `${dstIp} is on a connected subnet but has no cable path.`,
          path: fullPath,
          l3hops,
        };
      }
      fullPath.push(...seg.slice(1));
      return { ok: true, reason: 'delivered', path: fullPath, l3hops };
    }

    // Otherwise consult the routing table for a next hop.
    const route = longestPrefixMatch(routingTableFull(current), dstIp);
    if (!route || !route.nextHop) {
      return {
        ok: false,
        reason: isHost(current)
          ? `${current.data.name} has no default gateway for ${dstIp}.`
          : `${current.data.name} has no route to ${dstIp}.`,
        path: fullPath,
        l3hops,
      };
    }

    const nextHopIp = route.nextHop;
    const egress = current.data.interfaces.find(
      (i) => i.up && isValidIp(i.ip) && sameSubnet(i.ip, nextHopIp, i.mask)
    );
    if (!egress) {
      return {
        ok: false,
        reason: `Next hop ${nextHopIp} is not on a connected subnet of ${current.data.name}.`,
        path: fullPath,
        l3hops,
      };
    }
    const nhNode = nodes.find(
      (n) => n.id !== current.id && n.data.interfaces.some((i) => i.ip === nextHopIp && i.up)
    );
    if (!nhNode) {
      return { ok: false, reason: `No device has next-hop IP ${nextHopIp}.`, path: fullPath, l3hops };
    }
    const seg = l2Path(byId, adj, current.id, nhNode.id);
    if (!seg) {
      return {
        ok: false,
        reason: `Next hop ${nextHopIp} is unreachable (no cable path).`,
        path: fullPath,
        l3hops,
      };
    }
    fullPath.push(...seg.slice(1));
    if (isL3(nhNode)) l3hops.push({ id: nhNode.id, name: nhNode.data.name, ip: nextHopIp });

    if (visited.has(nhNode.id)) {
      return { ok: false, reason: `Routing loop detected at ${nhNode.data.name}.`, path: fullPath, l3hops };
    }
    visited.add(nhNode.id);
    current = nhNode;

    if (isHost(current) && !current.data.interfaces.some((i) => i.ip === dstIp)) {
      return {
        ok: false,
        reason: `Path runs into end host ${current.data.name}, which can't forward.`,
        path: fullPath,
        l3hops,
      };
    }
  }

  return { ok: false, reason: 'TTL exceeded (too many hops).', path: fullPath, l3hops };
}

interface Subnet {
  key: string;
  network: string;
  mask: string;
}

/**
 * Compute static routes that make every subnet reachable from every router
 * (a converged routing table, like a routing protocol would build). Returns a
 * map of routerId to the static routes it should hold.
 */
export function computeAutoRoutes(
  nodes: DNode[],
  _edges: Edge[]
): Record<string, StaticRoute[]> {
  const routers = nodes.filter(isL3);
  const subKey = (net: string, mask: string) => `${net}/${mask}`;

  const connected = new Map<string, Subnet[]>();
  const allSubs = new Map<string, Subnet>();
  for (const r of routers) {
    const subs: Subnet[] = [];
    for (const itf of r.data.interfaces) {
      if (!itf.up || !isValidIp(itf.ip)) continue;
      const net = networkAddress(itf.ip, itf.mask);
      if (!net) continue;
      const s = { key: subKey(net, itf.mask), network: net, mask: itf.mask };
      subs.push(s);
      allSubs.set(s.key, s);
    }
    connected.set(r.id, subs);
  }

  // Router adjacency: two routers are neighbours if they share a subnet.
  const adj = new Map<string, { to: string; viaIp: string }[]>();
  for (const r of routers) adj.set(r.id, []);
  for (const a of routers) {
    for (const b of routers) {
      if (a.id === b.id) continue;
      for (const ai of a.data.interfaces) {
        if (!ai.up || !isValidIp(ai.ip)) continue;
        const bi = b.data.interfaces.find(
          (x) => x.up && isValidIp(x.ip) && sameSubnet(ai.ip, x.ip, ai.mask)
        );
        if (bi) {
          adj.get(a.id)!.push({ to: b.id, viaIp: bi.ip });
          break;
        }
      }
    }
  }

  const result: Record<string, StaticRoute[]> = {};
  for (const r of routers) {
    const mine = new Set((connected.get(r.id) ?? []).map((s) => s.key));
    const routes: StaticRoute[] = [];
    for (const [key, sub] of allSubs) {
      if (mine.has(key)) continue;
      // BFS over routers to the nearest one that connects `sub`; record first hop.
      const prev = new Map<string, string | null>([[r.id, null]]);
      const firstVia = new Map<string, string>();
      const queue = [r.id];
      let via: string | null = null;
      while (queue.length) {
        const cur = queue.shift()!;
        if (cur !== r.id && (connected.get(cur) ?? []).some((s) => s.key === key)) {
          via = firstVia.get(cur) ?? null;
          break;
        }
        for (const e of adj.get(cur) ?? []) {
          if (!prev.has(e.to)) {
            prev.set(e.to, cur);
            firstVia.set(e.to, cur === r.id ? e.viaIp : firstVia.get(cur)!);
            queue.push(e.to);
          }
        }
      }
      if (via) routes.push({ network: sub.network, mask: sub.mask, nextHop: via });
    }
    result[r.id] = routes;
  }
  return result;
}
