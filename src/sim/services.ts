import type { Node, Edge } from '@xyflow/react';
import type { DeviceData } from '../types';
import { ipToInt, isValidIp, sameSubnet } from './ip';
import { broadcastDomain } from './netinfo';
import { simulatePing } from './simulate';

type DNode = Node<DeviceData>;

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export interface DhcpLease {
  clientId: string;
  clientName: string;
  serverName: string;
  ip: string;
  mask: string;
  gateway: string;
  dns: string;
}

export interface DhcpOutcome {
  leases: DhcpLease[];
  failures: { clientName: string; reason: string }[];
}

/**
 * Assign IPs to every host marked as a DHCP client, from a reachable DHCP
 * server in the same broadcast domain. Returns the leases (the store applies
 * them to the nodes).
 */
export function assignDhcp(nodes: DNode[], edges: Edge[]): DhcpOutcome {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const leases: DhcpLease[] = [];
  const failures: { clientName: string; reason: string }[] = [];

  // Pool of IPs already in use anywhere (static or previously leased).
  const usedIps = new Set<string>();
  for (const n of nodes) {
    for (const itf of n.data.interfaces) {
      if (isValidIp(itf.ip)) usedIps.add(itf.ip);
    }
  }

  for (const client of nodes) {
    if (!client.data.dhcpClient) continue;

    // Find a reachable, enabled DHCP server in the same broadcast domain.
    const domain = broadcastDomain(nodes, edges, client.id);
    const server = domain
      .map((id) => byId.get(id))
      .find((n) => n?.data.services?.dhcp?.enabled);

    if (!server || !server.data.services?.dhcp) {
      failures.push({
        clientName: client.data.name,
        reason: 'no DHCP server reachable on this network',
      });
      continue;
    }

    const pool = server.data.services.dhcp;
    const start = ipToInt(pool.poolStart);
    const end = ipToInt(pool.poolEnd);
    if (start === null || end === null || start > end) {
      failures.push({
        clientName: client.data.name,
        reason: `DHCP server ${server.data.name} has an invalid address pool`,
      });
      continue;
    }

    // First free address in the pool, skipping used IPs and the gateway.
    let assigned: string | null = null;
    for (let v = start; v <= end; v++) {
      const ip = intToIp(v >>> 0);
      if (ip === pool.gateway) continue;
      if (usedIps.has(ip)) continue;
      assigned = ip;
      break;
    }

    if (!assigned) {
      failures.push({
        clientName: client.data.name,
        reason: `DHCP pool on ${server.data.name} is exhausted`,
      });
      continue;
    }

    usedIps.add(assigned);
    leases.push({
      clientId: client.id,
      clientName: client.data.name,
      serverName: server.data.name,
      ip: assigned,
      mask: pool.mask,
      gateway: pool.gateway,
      dns: pool.dns,
    });
  }

  return { leases, failures };
}

/** Resolve a hostname against every enabled DNS server in the topology. */
export function resolveDns(nodes: DNode[], name: string): string | null {
  const q = name.trim().toLowerCase();
  for (const n of nodes) {
    const dns = n.data.services?.dns;
    if (!dns?.enabled) continue;
    for (const rec of dns.records) {
      if (rec.name.trim().toLowerCase() === q && isValidIp(rec.ip)) return rec.ip;
    }
  }
  return null;
}

export interface HttpOutcome {
  ok: boolean;
  status: string;
  serverName?: string;
  body?: string;
}

/**
 * Simulate an HTTP GET from a host to a target (IP or hostname). Resolves DNS
 * if needed, checks the server is reachable (ping), and that HTTP is enabled.
 */
export function httpGet(
  nodes: DNode[],
  edges: Edge[],
  fromId: string,
  target: string
): HttpOutcome {
  let ip = target.trim();
  if (!isValidIp(ip)) {
    const resolved = resolveDns(nodes, ip);
    if (!resolved) return { ok: false, status: `cannot resolve "${target}"` };
    ip = resolved;
  }

  const server = nodes.find((n) =>
    n.data.interfaces.some((itf) => itf.ip === ip)
  );
  if (!server) return { ok: false, status: `no host has address ${ip}` };

  const reachable = simulatePing(nodes, edges, fromId, server.id).success;
  if (!reachable) return { ok: false, status: `${ip} is unreachable` };

  const http = server.data.services?.http;
  if (!http?.enabled) {
    return { ok: false, status: `connection refused (no web server on ${ip})`, serverName: server.data.name };
  }

  return { ok: true, status: '200 OK', serverName: server.data.name, body: http.page };
}

// Re-export for callers that want to confirm a static IP is on a host's subnet.
export { sameSubnet };
