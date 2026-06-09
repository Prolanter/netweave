import type { Node, Edge } from '@xyflow/react';
import type { DeviceData } from '../types';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { isValidIp, sameSubnet } from './ip';

type DNode = Node<DeviceData>;

export interface ValidationIssue {
  level: 'error' | 'warning';
  nodeId?: string;
  device?: string;
  message: string;
}

const roleOf = (n: DNode) => DEVICE_DEFS[n.data.kind]?.role;

/** Scan the topology for the configuration mistakes students commonly make. */
export function validateTopology(nodes: DNode[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const devices = nodes.filter((n) => DEVICE_DEFS[n.data.kind]);

  // 1. Duplicate IP addresses across the whole topology.
  const ipOwners = new Map<string, string[]>();
  for (const n of devices) {
    for (const itf of n.data.interfaces) {
      if (!isValidIp(itf.ip)) continue;
      if (!ipOwners.has(itf.ip)) ipOwners.set(itf.ip, []);
      ipOwners.get(itf.ip)!.push(n.data.name);
    }
  }
  for (const [ip, owners] of ipOwners) {
    if (owners.length > 1) {
      issues.push({
        level: 'error',
        message: `Duplicate IP ${ip} is used by ${owners.join(', ')}.`,
      });
    }
  }

  // Per-device checks.
  const linked = new Set<string>();
  for (const e of edges) {
    linked.add(e.source);
    linked.add(e.target);
  }

  for (const n of devices) {
    const role = roleOf(n);

    // 2. Isolated device (no cables).
    if (!linked.has(n.id) && n.data.kind !== 'cloud') {
      issues.push({
        level: 'warning',
        nodeId: n.id,
        device: n.data.name,
        message: `${n.data.name} is not connected to anything.`,
      });
    }

    if (role === 'host') {
      const hasIp = n.data.interfaces.some((i) => isValidIp(i.ip));
      // 3. Host with no address and not using DHCP.
      if (!hasIp && !n.data.dhcpClient) {
        issues.push({
          level: 'warning',
          nodeId: n.id,
          device: n.data.name,
          message: `${n.data.name} has no IP address (set one or enable DHCP).`,
        });
      }
      // 4. Default gateway not on any connected subnet.
      const gw = n.data.gateway ?? '';
      if (isValidIp(gw)) {
        const onSubnet = n.data.interfaces.some(
          (i) => isValidIp(i.ip) && sameSubnet(i.ip, gw, i.mask)
        );
        if (!onSubnet && hasIp) {
          issues.push({
            level: 'warning',
            nodeId: n.id,
            device: n.data.name,
            message: `${n.data.name}'s gateway ${gw} is not on its own subnet.`,
          });
        }
      }
    }

    // 5. L3 device with no addressed interface.
    if (role === 'l3') {
      const anyIp = n.data.interfaces.some((i) => i.up && isValidIp(i.ip));
      if (linked.has(n.id) && !anyIp) {
        issues.push({
          level: 'warning',
          nodeId: n.id,
          device: n.data.name,
          message: `${n.data.name} has no active interface IP configured.`,
        });
      }
    }
  }

  return issues;
}
