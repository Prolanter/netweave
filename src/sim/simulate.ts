import type { Node, Edge } from '@xyflow/react';
import type {
  DeviceData,
  SimResult,
  SimStep,
  TraceHop,
  PacketSegment,
} from '../types';
import { sameSubnet, isValidIp } from './ip';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { macFor } from './netinfo';
import { routePacket } from './routing';

type DNode = Node<DeviceData>;

interface Graph {
  byId: Map<string, DNode>;
  neighbors: Map<string, string[]>;
}

function buildGraph(nodes: DNode[], edges: Edge[]): Graph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbors = new Map<string, string[]>();
  for (const n of nodes) neighbors.set(n.id, []);
  for (const e of edges) {
    if (neighbors.has(e.source) && neighbors.has(e.target)) {
      neighbors.get(e.source)!.push(e.target);
      neighbors.get(e.target)!.push(e.source);
    }
  }
  return { byId, neighbors };
}

function hostIp(n: DNode): string {
  return n.data.interfaces[0]?.ip ?? '';
}

// Educational ping driven by per-device routing tables (connected + static + default).
export function simulatePing(
  nodes: DNode[],
  edges: Edge[],
  fromId: string,
  toId: string
): SimResult {
  const g = buildGraph(nodes, edges);
  const steps: SimStep[] = [];
  const src = g.byId.get(fromId);
  const dst = g.byId.get(toId);

  if (!src || !dst) {
    return { success: false, summary: 'Source or destination not found.', steps, path: [] };
  }

  const srcIp = hostIp(src);
  const dstIp = hostIp(dst);

  if (!isValidIp(srcIp)) {
    steps.push({ nodeId: src.id, label: `${src.data.name} has no valid IP address`, ok: false });
    return { success: false, summary: `${src.data.name} is missing a valid IP.`, steps, path: [] };
  }
  if (!isValidIp(dstIp)) {
    steps.push({ nodeId: dst.id, label: `${dst.data.name} has no valid IP address`, ok: false });
    return { success: false, summary: `${dst.data.name} is missing a valid IP.`, steps, path: [] };
  }

  steps.push({
    nodeId: src.id,
    label: `${src.data.name} (${srcIp}) starts ICMP echo to ${dstIp}`,
    ok: true,
  });

  const routed = routePacket(nodes, edges, fromId, dstIp);
  const path = routed.path;

  if (sameSubnet(srcIp, dstIp, src.data.interfaces[0]?.mask ?? '255.255.255.0')) {
    steps.push({ nodeId: src.id, label: `${dstIp} is on the same subnet → direct delivery`, ok: true });
  } else if (routed.l3hops.length > 0) {
    steps.push({
      nodeId: src.id,
      label: `Different subnet → forwarding to gateway ${src.data.gateway}`,
      ok: true,
    });
  }

  for (const hop of routed.l3hops) {
    steps.push({ nodeId: hop.id, label: `${hop.name} routes the packet toward ${dstIp}`, ok: true });
  }

  if (!routed.ok) {
    steps.push({ nodeId: dst.id, label: routed.reason, ok: false });
    return { success: false, summary: routed.reason, steps, path };
  }

  steps.push({
    nodeId: dst.id,
    label: `${dst.data.name} (${dstIp}) receives echo, sends reply`,
    ok: true,
  });

  const hops = buildHops(g, path, dst.id);
  const packets = buildPackets(g, path, srcIp, dstIp);

  return {
    success: true,
    summary: `Reply from ${dstIp}: ping successful (${path.length - 1} hop${
      path.length - 1 === 1 ? '' : 's'
    }).`,
    steps,
    path,
    hops,
    packets,
  };
}

// Traceroute: list each Layer-3 boundary (router / WAN) plus the destination.
function buildHops(g: Graph, path: string[], dstId: string): TraceHop[] {
  const hops: TraceHop[] = [];
  let ttl = 1;
  for (let i = 1; i < path.length; i++) {
    const node = g.byId.get(path[i])!;
    const r = DEVICE_DEFS[node.data.kind].role;
    const isLast = node.id === dstId;
    if (r === 'l3' || r === 'wan' || isLast) {
      const ip =
        r === 'l3' || r === 'wan'
          ? node.data.interfaces.find((itf) => isValidIp(itf.ip))?.ip ?? '·'
          : hostIp(node);
      hops.push({ ttl: ttl++, nodeId: node.id, name: node.data.name, ip });
    }
  }
  return hops;
}

// Packet inspection: split the path into Layer-2 segments at each L3 boundary.
// The L3 (IP) addresses stay constant; the L2 (MAC) addresses are rewritten per
// segment: the core lesson of how routing vs. switching works.
function buildPackets(
  g: Graph,
  path: string[],
  srcIp: string,
  dstIp: string
): PacketSegment[] {
  const termIdx: number[] = [];
  for (let i = 0; i < path.length; i++) {
    const r = DEVICE_DEFS[g.byId.get(path[i])!.data.kind].role;
    if (i === 0 || i === path.length - 1 || r === 'l3' || r === 'wan') {
      termIdx.push(i);
    }
  }
  const packets: PacketSegment[] = [];
  for (let s = 0; s < termIdx.length - 1; s++) {
    const a = termIdx[s];
    const b = termIdx[s + 1];
    const from = g.byId.get(path[a])!;
    const to = g.byId.get(path[b])!;
    const via = path.slice(a + 1, b).map((id) => g.byId.get(id)!.data.name);
    packets.push({
      fromName: from.data.name,
      toName: to.data.name,
      via,
      l3src: srcIp,
      l3dst: dstIp,
      l2src: macFor(from.id, 0),
      l2dst: macFor(to.id, 0),
      note: via.length
        ? `crosses ${via.join(', ')} (Layer 2, MACs unchanged)`
        : 'directly connected link',
    });
  }
  return packets;
}
