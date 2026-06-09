import type { Node, Edge } from '@xyflow/react';
import type { DeviceData } from '../types';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { simulatePing } from './simulate';

type DNode = Node<DeviceData>;

export interface MatrixHost {
  id: string;
  name: string;
}

export interface MatrixResult {
  hosts: MatrixHost[];
  // cell[i][j] = can host i reach host j? (null on the diagonal)
  cell: (boolean | null)[][];
  reachable: number;
  total: number;
}

/** Ping every host→host pair and build a reachability grid. */
export function connectivityMatrix(nodes: DNode[], edges: Edge[]): MatrixResult {
  const hosts = nodes
    .filter((n) => DEVICE_DEFS[n.data.kind].role === 'host')
    .map((n) => ({ id: n.id, name: n.data.name }));

  const cell: (boolean | null)[][] = [];
  let reachable = 0;
  let total = 0;

  for (let i = 0; i < hosts.length; i++) {
    cell[i] = [];
    for (let j = 0; j < hosts.length; j++) {
      if (i === j) {
        cell[i][j] = null;
        continue;
      }
      const ok = simulatePing(nodes, edges, hosts[i].id, hosts[j].id).success;
      cell[i][j] = ok;
      total++;
      if (ok) reachable++;
    }
  }

  return { hosts, cell, reachable, total };
}
