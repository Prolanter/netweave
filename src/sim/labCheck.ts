import type { Node, Edge } from '@xyflow/react';
import type { DeviceData, LabCheck } from '../types';
import { isValidIp } from './ip';

type DNode = Node<DeviceData>;

export function checkObjective(
  check: LabCheck,
  nodes: DNode[],
  edges: Edge[]
): boolean {
  switch (check.type) {
    case 'deviceCount':
      return nodes.filter((n) => n.data.kind === check.kind).length >= check.min;
    case 'linkCount':
      return edges.length >= check.min;
    case 'interfaceConfigured': {
      let count = 0;
      for (const n of nodes) {
        for (const itf of n.data.interfaces) {
          if (isValidIp(itf.ip)) count++;
        }
      }
      return count >= check.min;
    }
    case 'pingSucceeds':
      // resolved elsewhere; treat as not-auto-checkable here
      return false;
    default:
      return false;
  }
}
