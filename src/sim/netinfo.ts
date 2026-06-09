import type { Node, Edge } from '@xyflow/react';
import type { DeviceData } from '../types';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { isValidIp, sameSubnet, networkAddress, maskToCidr } from './ip';
import { buildAdj, l2Path } from './l2';

type DNode = Node<DeviceData>;

// Deterministic, stable "MAC address" for a device interface (educational only).
export function macFor(nodeId: string, idx = 0): string {
  let h = 0x811c9dc5;
  const s = `${nodeId}#${idx}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const bytes = [(h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff];
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase());
  return `02:1A:2B:${hex.join(':')}`;
}

function neighbors(nodes: DNode[], edges: Edge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const n of nodes) map.set(n.id, []);
  for (const e of edges) {
    if (map.has(e.source) && map.has(e.target)) {
      map.get(e.source)!.push(e.target);
      map.get(e.target)!.push(e.source);
    }
  }
  return map;
}

function role(n: DNode) {
  return DEVICE_DEFS[n.data.kind].role;
}

/**
 * The broadcast domain reachable from `startId`: every host/router endpoint you
 * can reach without passing *through* a Layer-3 device or another host. Layer-2
 * devices (switch/hub/AP) are transparent and get traversed.
 */
export function broadcastDomain(
  nodes: DNode[],
  edges: Edge[],
  startId: string
): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nb = neighbors(nodes, edges);
  const seen = new Set<string>([startId]);
  const endpoints = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const id of nb.get(cur) ?? []) {
      const node = byId.get(id);
      if (!node) continue;
      const r = role(node);
      if (r === 'host' || r === 'l3') {
        // an endpoint: record it but don't traverse through it
        endpoints.add(id);
      } else if (!seen.has(id)) {
        // transparent L2 device: keep walking
        seen.add(id);
        queue.push(id);
      }
    }
  }
  endpoints.delete(startId);
  return [...endpoints];
}

export interface PortRow {
  name: string;
  ip: string;
  mask: string;
  cidr: number | null;
  mac: string;
  adminUp: boolean;
  link: boolean; // is a cable attached?
  status: 'up/up' | 'up/down' | 'admin-down';
  neighbor: string | null;
}

export function portTable(
  node: DNode,
  nodes: DNode[],
  edges: Edge[]
): PortRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nb = neighbors(nodes, edges).get(node.id) ?? [];
  // We don't model which cable lands on which port, so we surface the first
  // neighbour as the link partner for display purposes.
  const firstNeighbor = nb.length ? byId.get(nb[0])?.data.name ?? null : null;
  return node.data.interfaces.map((itf, i) => {
    const link = nb.length > 0;
    const status: PortRow['status'] = !itf.up
      ? 'admin-down'
      : link
      ? 'up/up'
      : 'up/down';
    return {
      name: itf.name,
      ip: itf.ip,
      mask: itf.mask,
      cidr: itf.mask ? maskToCidr(itf.mask) : null,
      mac: macFor(node.id, i),
      adminUp: itf.up,
      link,
      status,
      neighbor: i === 0 ? firstNeighbor : null,
    };
  });
}

export interface ArpRow {
  ip: string;
  mac: string;
  name: string;
}

export function arpTable(
  node: DNode,
  nodes: DNode[],
  edges: Edge[]
): ArpRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = buildAdj(nodes, edges);
  const myIps = node.data.interfaces.filter((i) => isValidIp(i.ip));
  const rows: ArpRow[] = [];
  for (const other of nodes) {
    if (other.id === node.id) continue;
    // Only neighbours reachable at Layer 2 (same VLAN/broadcast domain).
    if (!l2Path(byId, adj, node.id, other.id)) continue;
    other.data.interfaces.forEach((itf, idx) => {
      if (!isValidIp(itf.ip)) return;
      const onSameWire = myIps.some((mi) => sameSubnet(mi.ip, itf.ip, mi.mask));
      if (onSameWire) {
        rows.push({ ip: itf.ip, mac: macFor(other.id, idx), name: other.data.name });
      }
    });
  }
  return rows;
}

export interface RouteRow {
  type: 'C' | 'S' | 'S*'; // connected, static, or default static
  network: string;
  cidr: number | null;
  via: string; // "directly connected, <iface>" or next-hop IP
}

export function routingTable(node: DNode): RouteRow[] {
  const rows: RouteRow[] = [];
  for (const itf of node.data.interfaces) {
    if (!itf.up || !isValidIp(itf.ip)) continue;
    const net = networkAddress(itf.ip, itf.mask);
    if (!net) continue;
    rows.push({
      type: 'C',
      network: net,
      cidr: maskToCidr(itf.mask),
      via: `directly connected, ${itf.name}`,
    });
  }
  // Static routes configured via the CLI.
  for (const r of node.data.routes ?? []) {
    if (!isValidIp(r.nextHop)) continue;
    rows.push({
      type: 'S',
      network: networkAddress(r.network, r.mask) ?? r.network,
      cidr: maskToCidr(r.mask),
      via: `via ${r.nextHop}`,
    });
  }
  // Hosts model a default route via their gateway.
  if (DEVICE_DEFS[node.data.kind].role === 'host' && isValidIp(node.data.gateway ?? '')) {
    rows.push({
      type: 'S*',
      network: '0.0.0.0',
      cidr: 0,
      via: `${node.data.gateway}`,
    });
  }
  return rows;
}
