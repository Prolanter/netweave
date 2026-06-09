import type { CableType, DeviceKind } from '../types';
import { DEVICE_DEFS } from './deviceDefs';

export interface CableDef {
  label: string;
  short: string;
  color: string;
  dash?: string; // SVG stroke-dasharray
  desc: string;
}

export const CABLE_DEFS: Record<CableType, CableDef> = {
  straight: {
    label: 'Copper Straight-Through',
    short: 'Straight',
    color: '#94a3b8',
    desc: 'Connects unlike devices (PC↔switch, switch↔router).',
  },
  crossover: {
    label: 'Copper Cross-Over',
    short: 'Crossover',
    color: '#f59e0b',
    desc: 'Connects like devices (PC↔PC, switch↔switch, router↔router).',
  },
  fiber: {
    label: 'Fiber Optic',
    short: 'Fiber',
    color: '#38bdf8',
    desc: 'High-speed optical link, long distances.',
  },
  serial: {
    label: 'Serial (WAN)',
    short: 'Serial',
    color: '#a78bfa',
    dash: '7 5',
    desc: 'WAN link between routers, or to the cloud/ISP.',
  },
  wireless: {
    label: 'Wireless',
    short: 'Wi-Fi',
    color: '#2dd4bf',
    dash: '2 6',
    desc: 'No cable. A Wi-Fi association via an access point or wireless router.',
  },
};

// Cables a user can pick manually (wireless is auto-only, since it needs an AP/wireless router).
export const CABLE_TYPES: CableType[] = ['straight', 'crossover', 'fiber', 'serial'];

// Relative time to cross a link (lower = faster). Fiber is quickest, serial WAN slowest.
export const CABLE_SPEED: Record<CableType, number> = {
  fiber: 0.55,
  straight: 1,
  crossover: 1,
  wireless: 1.35,
  serial: 1.9,
};

const WIRELESS_CLIENT = new Set<DeviceKind>(['phone', 'iot']);
const WIRELESS_INFRA = new Set<DeviceKind>(['accesspoint', 'wifirouter']);

function wirelessCapable(k: DeviceKind) {
  return WIRELESS_CLIENT.has(k) || WIRELESS_INFRA.has(k);
}

/** Pick a sensible default cable for a link between two device kinds (like Packet Tracer's "Automatic"). */
export function autoCable(a: DeviceKind, b: DeviceKind): CableType {
  if (
    (WIRELESS_CLIENT.has(a) && wirelessCapable(b)) ||
    (WIRELESS_CLIENT.has(b) && wirelessCapable(a))
  ) {
    return 'wireless';
  }
  const ra = DEVICE_DEFS[a].role;
  const rb = DEVICE_DEFS[b].role;
  if (ra === 'wan' || rb === 'wan') return 'serial';
  if (ra === 'l3' && rb === 'l3') return 'serial'; // router-to-router WAN
  if (ra === rb) return 'crossover'; // like devices
  return 'straight'; // unlike devices
}

export function cableStyle(cable: CableType | undefined, active: boolean) {
  const def = CABLE_DEFS[cable ?? 'straight'] ?? CABLE_DEFS.straight;
  return {
    stroke: active ? '#2dd4bf' : def.color,
    strokeWidth: active ? 3.5 : 2,
    strokeDasharray: def.dash,
  };
}
