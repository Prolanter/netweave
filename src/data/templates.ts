import type { Node, Edge } from '@xyflow/react';
import type { DeviceData, DeviceKind, DeviceServices } from '../types';
import { DEVICE_DEFS, makeDefaultServices } from './deviceDefs';
import { autoCable } from './cables';

type DNode = Node<DeviceData>;

let uid = 0;
const nid = () => `tpl-${Date.now().toString(36)}-${uid++}`;

interface DevCfg {
  ip?: string;
  ips?: (string | null)[];
  mask?: string;
  gateway?: string;
  dns?: string;
  dhcpClient?: boolean;
  services?: DeviceServices;
}

function dev(kind: DeviceKind, name: string, x: number, y: number, cfg: DevCfg = {}): DNode {
  const def = DEVICE_DEFS[kind];
  const interfaces = def.makeInterfaces();
  const mask = cfg.mask ?? '255.255.255.0';
  if (cfg.ip) interfaces[0] = { ...interfaces[0], ip: cfg.ip, mask };
  if (cfg.ips)
    cfg.ips.forEach((ip, i) => {
      if (ip && interfaces[i]) interfaces[i] = { ...interfaces[i], ip, mask };
    });
  const data: DeviceData = {
    kind,
    name,
    interfaces,
    ...(def.role === 'host'
      ? { gateway: cfg.gateway ?? '', dns: cfg.dns ?? '', dhcpClient: cfg.dhcpClient ?? false }
      : {}),
    ...(def.services ? { services: cfg.services ?? makeDefaultServices(def.services) } : {}),
  };
  return { id: nid(), type: 'device', position: { x, y }, data };
}

function link(a: DNode, b: DNode): Edge {
  return {
    id: nid(),
    source: a.id,
    target: b.id,
    type: 'deletable',
    data: { cable: autoCable(a.data.kind, b.data.kind) },
  };
}

export interface Template {
  id: string;
  name: string;
  desc: string;
  build: () => { nodes: DNode[]; edges: Edge[] };
}

export const TEMPLATES: Template[] = [
  {
    id: 'lan',
    name: 'Single LAN',
    desc: 'Two PCs on one switch, same subnet.',
    build: () => {
      const pc1 = dev('pc', 'PC1', 80, 80, { ip: '192.168.1.10', gateway: '192.168.1.1' });
      const sw = dev('switch', 'SW1', 320, 200);
      const pc2 = dev('pc', 'PC2', 80, 320, { ip: '192.168.1.20', gateway: '192.168.1.1' });
      return { nodes: [pc1, sw, pc2], edges: [link(pc1, sw), link(pc2, sw)] };
    },
  },
  {
    id: 'two-lans',
    name: 'Two LANs + Router',
    desc: 'A router joins two subnets through two switches.',
    build: () => {
      const pc1 = dev('pc', 'PC1', 60, 80, { ip: '192.168.1.10', gateway: '192.168.1.1' });
      const sw1 = dev('switch', 'SW1', 280, 80);
      const r1 = dev('router', 'R1', 480, 200, { ips: ['192.168.1.1', '192.168.2.1'] });
      const sw2 = dev('switch', 'SW2', 280, 340);
      const pc2 = dev('pc', 'PC2', 60, 340, { ip: '192.168.2.10', gateway: '192.168.2.1' });
      return {
        nodes: [pc1, sw1, r1, sw2, pc2],
        edges: [link(pc1, sw1), link(sw1, r1), link(r1, sw2), link(sw2, pc2)],
      };
    },
  },
  {
    id: 'services',
    name: 'DHCP + DNS + Web server',
    desc: 'A server hands out IPs and serves a web page to two clients.',
    build: () => {
      const srv = dev('server', 'SRV1', 480, 200, {
        ip: '192.168.1.10',
        services: {
          dhcp: {
            enabled: true,
            poolStart: '192.168.1.100',
            poolEnd: '192.168.1.200',
            mask: '255.255.255.0',
            gateway: '192.168.1.1',
            dns: '192.168.1.10',
          },
          dns: { enabled: true, records: [{ name: 'www.lab.local', ip: '192.168.1.10' }] },
          http: { enabled: true, page: 'Welcome to the NetWeave lab web server!' },
        },
      });
      const sw = dev('switch', 'SW1', 280, 200);
      const pc1 = dev('pc', 'PC1', 80, 80, { dhcpClient: true });
      const pc2 = dev('pc', 'PC2', 80, 320, { dhcpClient: true });
      return {
        nodes: [srv, sw, pc1, pc2],
        edges: [link(srv, sw), link(pc1, sw), link(pc2, sw)],
      };
    },
  },
  {
    id: 'office',
    name: 'Small office (Wi-Fi)',
    desc: 'Router, switch, server, a wired PC and a wireless phone.',
    build: () => {
      const r1 = dev('router', 'R1', 480, 80, { ips: ['192.168.1.1'] });
      const sw = dev('switch', 'SW1', 320, 200);
      const srv = dev('server', 'SRV1', 520, 240, { ip: '192.168.1.10' });
      const pc1 = dev('pc', 'PC1', 100, 100, { ip: '192.168.1.20', gateway: '192.168.1.1' });
      const ap = dev('accesspoint', 'AP1', 160, 320);
      const phone = dev('phone', 'PH1', 380, 380, { ip: '192.168.1.30', gateway: '192.168.1.1' });
      return {
        nodes: [r1, sw, srv, pc1, ap, phone],
        edges: [
          link(r1, sw),
          link(srv, sw),
          link(pc1, sw),
          link(ap, sw),
          link(phone, ap),
        ],
      };
    },
  },
];
