export type DeviceKind =
  | 'router'
  | 'switch'
  | 'l3switch'
  | 'firewall'
  | 'hub'
  | 'wifirouter'
  | 'accesspoint'
  | 'pc'
  | 'laptop'
  | 'server'
  | 'phone'
  | 'printer'
  | 'iot'
  | 'cloud';

// Behavioral role used by the simulation engine.
export type DeviceRole = 'host' | 'l3' | 'l2' | 'wan';

// Physical media of an interface (affects which devices can link, and display).
export type LinkType = 'copper' | 'fiber' | 'serial' | 'wireless';

// The kind of cable/link used on an edge between two devices.
export type CableType =
  | 'straight'
  | 'crossover'
  | 'fiber'
  | 'serial'
  | 'wireless';

// Traffic types we can visualise as distinct coloured packets.
export type TrafficKind = 'icmp' | 'dns' | 'http';

// A canvas annotation (text label or zone box) for documenting a topology.
export interface Annotation {
  id: string;
  type: 'label' | 'zone';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
}

// A manually-configured static route on an L3 device.
export interface StaticRoute {
  network: string; // destination network address, e.g. 10.0.1.0
  mask: string; // dotted-decimal mask
  nextHop: string; // next-hop IP on a directly-connected subnet
}

export interface NetInterface {
  id: string;
  name: string; // e.g. "GigabitEthernet0/0", "Fa0/1", "eth0"
  ip: string; // empty string if unassigned
  mask: string; // dotted decimal, e.g. "255.255.255.0"
  up: boolean;
  type?: LinkType;
}

// ---- Services (server / router) ----
export type ServiceKind = 'dhcp' | 'dns' | 'http';

export interface DhcpService {
  enabled: boolean;
  poolStart: string;
  poolEnd: string;
  mask: string;
  gateway: string;
  dns: string;
}

export interface DnsRecord {
  name: string;
  ip: string;
}

export interface DnsService {
  enabled: boolean;
  records: DnsRecord[];
}

export interface HttpService {
  enabled: boolean;
  page: string; // simple text/HTML returned to clients
}

export interface DeviceServices {
  dhcp?: DhcpService;
  dns?: DnsService;
  http?: HttpService;
}

export interface DeviceData {
  kind: DeviceKind;
  name: string;
  interfaces: NetInterface[];
  gateway?: string; // for end hosts (pc/server/iot)
  dns?: string; // DNS server address for end hosts
  dhcpClient?: boolean; // host obtains its IP automatically
  script?: string; // for IoT devices
  services?: DeviceServices; // for servers / routers
  routes?: StaticRoute[]; // static routes on L3 devices
  // arbitrary key used by React Flow node data bag
  [key: string]: unknown;
}

export interface LabObjective {
  id: string;
  text: string;
  // a check function key resolved in the labs runner
  check: LabCheck;
}

export type LabCheck =
  | { type: 'deviceCount'; kind: DeviceKind; min: number }
  | { type: 'linkCount'; min: number }
  | { type: 'interfaceConfigured'; min: number }
  | { type: 'pingSucceeds'; from: string; to: string };

export interface Lab {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  objectives: LabObjective[];
  hints: string[];
}

export interface SimStep {
  nodeId: string;
  label: string;
  ok: boolean;
}

// One row of a traceroute (each Layer-3 hop the packet passes).
export interface TraceHop {
  ttl: number;
  nodeId: string;
  name: string;
  ip: string;
}

// One Layer-2 segment of the journey (between two L3 boundaries).
// IP src/dst stay constant end-to-end; MAC src/dst are rewritten per segment.
export interface PacketSegment {
  fromName: string;
  toName: string;
  via: string[]; // transparent L2 devices crossed (switches/hubs)
  l3src: string;
  l3dst: string;
  l2src: string;
  l2dst: string;
  note: string;
}

export interface SimResult {
  success: boolean;
  summary: string;
  steps: SimStep[];
  path: string[]; // node ids in order
  hops?: TraceHop[]; // traceroute view
  packets?: PacketSegment[]; // packet-inspection view
}
