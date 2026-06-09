import type {
  DeviceKind,
  DeviceRole,
  NetInterface,
  LinkType,
  ServiceKind,
  DeviceServices,
} from '../types';

export type DeviceCategory = 'Network' | 'Wireless' | 'End Devices' | 'WAN & Security';

export interface DeviceDef {
  kind: DeviceKind;
  label: string;
  description: string;
  color: string;
  category: DeviceCategory;
  role: DeviceRole; // simulation behavior
  // factory for default interfaces
  makeInterfaces: () => NetInterface[];
  scriptable: boolean;
  services?: ServiceKind[]; // services this device can run
}

let ifCounter = 0;
const iface = (name: string, type: LinkType = 'copper'): NetInterface => ({
  id: `if-${Date.now().toString(36)}-${ifCounter++}`,
  name,
  ip: '',
  mask: '255.255.255.0',
  up: true,
  type,
});

const ethPorts = (n: number, prefix = 'FastEthernet0/', type: LinkType = 'copper') =>
  Array.from({ length: n }, (_, i) => iface(`${prefix}${i + 1}`, type));

export const DEVICE_DEFS: Record<DeviceKind, DeviceDef> = {
  router: {
    kind: 'router',
    label: 'Router',
    description: 'Routes traffic between networks (Layer 3)',
    color: '#2dd4bf',
    category: 'Network',
    role: 'l3',
    scriptable: false,
    services: ['dhcp'],
    makeInterfaces: () => [
      iface('GigabitEthernet0/0'),
      iface('GigabitEthernet0/1'),
      iface('Serial0/0/0', 'serial'),
      iface('Serial0/0/1', 'serial'),
    ],
  },
  switch: {
    kind: 'switch',
    label: 'Switch',
    description: 'Connects devices within a LAN (Layer 2)',
    color: '#60a5fa',
    category: 'Network',
    role: 'l2',
    scriptable: false,
    makeInterfaces: () => [
      ...ethPorts(24),
      iface('GigabitEthernet0/1', 'fiber'),
      iface('GigabitEthernet0/2', 'fiber'),
    ],
  },
  l3switch: {
    kind: 'l3switch',
    label: 'Layer 3 Switch',
    description: 'Multilayer switch that switches and routes between VLANs',
    color: '#818cf8',
    category: 'Network',
    role: 'l3',
    scriptable: false,
    makeInterfaces: () => ethPorts(8, 'GigabitEthernet1/0/'),
  },
  hub: {
    kind: 'hub',
    label: 'Hub',
    description: 'Repeats signals to all ports (Layer 1, one collision domain)',
    color: '#94a3b8',
    category: 'Network',
    role: 'l2',
    scriptable: false,
    makeInterfaces: () => ethPorts(4, 'Port'),
  },
  accesspoint: {
    kind: 'accesspoint',
    label: 'Access Point',
    description: 'Bridges Wi-Fi clients to the wired LAN (Layer 2)',
    color: '#a78bfa',
    category: 'Wireless',
    role: 'l2',
    scriptable: false,
    makeInterfaces: () => [
      iface('Wireless0', 'wireless'),
      iface('GigabitEthernet0'),
    ],
  },
  wifirouter: {
    kind: 'wifirouter',
    label: 'Wireless Router',
    description: 'Home gateway: routing, Wi-Fi, and switching combined',
    color: '#c084fc',
    category: 'Wireless',
    role: 'l3',
    scriptable: false,
    services: ['dhcp'],
    makeInterfaces: () => [
      iface('Internet'),
      iface('Wireless0', 'wireless'),
      iface('LAN1'),
      iface('LAN2'),
    ],
  },
  pc: {
    kind: 'pc',
    label: 'PC',
    description: 'Desktop workstation',
    color: '#f59e0b',
    category: 'End Devices',
    role: 'host',
    scriptable: false,
    makeInterfaces: () => [iface('FastEthernet0')],
  },
  laptop: {
    kind: 'laptop',
    label: 'Laptop',
    description: 'Portable workstation',
    color: '#fbbf24',
    category: 'End Devices',
    role: 'host',
    scriptable: false,
    makeInterfaces: () => [iface('FastEthernet0')],
  },
  server: {
    kind: 'server',
    label: 'Server',
    description: 'Hosts services (DHCP, DNS, HTTP)',
    color: '#34d399',
    category: 'End Devices',
    role: 'host',
    scriptable: false,
    services: ['dhcp', 'dns', 'http'],
    makeInterfaces: () => [iface('GigabitEthernet0')],
  },
  phone: {
    kind: 'phone',
    label: 'Smartphone',
    description: 'Mobile wireless client',
    color: '#22d3ee',
    category: 'End Devices',
    role: 'host',
    scriptable: false,
    makeInterfaces: () => [iface('Wireless0', 'wireless')],
  },
  printer: {
    kind: 'printer',
    label: 'Printer',
    description: 'Networked printer',
    color: '#cbd5e1',
    category: 'End Devices',
    role: 'host',
    scriptable: false,
    makeInterfaces: () => [iface('FastEthernet0')],
  },
  iot: {
    kind: 'iot',
    label: 'IoT Device',
    description: 'Programmable smart device (scriptable)',
    color: '#f472b6',
    category: 'End Devices',
    role: 'host',
    scriptable: true,
    makeInterfaces: () => [iface('Wireless0', 'wireless')],
  },
  firewall: {
    kind: 'firewall',
    label: 'Firewall',
    description: 'Filters and forwards traffic between zones (Layer 3)',
    color: '#fb7185',
    category: 'WAN & Security',
    role: 'l3',
    scriptable: false,
    makeInterfaces: () => [
      iface('outside'),
      iface('inside'),
      iface('dmz'),
    ],
  },
  cloud: {
    kind: 'cloud',
    label: 'Cloud / Internet',
    description: 'Represents the internet or an ISP/WAN link',
    color: '#7dd3fc',
    category: 'WAN & Security',
    role: 'wan',
    scriptable: false,
    makeInterfaces: () => [iface('WAN0', 'serial'), iface('WAN1', 'serial')],
  },
};

// Sensible default service configuration for a newly-dropped device.
export function makeDefaultServices(kinds: ServiceKind[]): DeviceServices {
  const s: DeviceServices = {};
  if (kinds.includes('dhcp')) {
    s.dhcp = {
      enabled: false,
      poolStart: '192.168.1.100',
      poolEnd: '192.168.1.200',
      mask: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: '192.168.1.10',
    };
  }
  if (kinds.includes('dns')) {
    s.dns = { enabled: false, records: [{ name: 'www.lab.local', ip: '192.168.1.10' }] };
  }
  if (kinds.includes('http')) {
    s.http = {
      enabled: false,
      page: 'Welcome to the NetWeave lab web server!',
    };
  }
  return s;
}

// Order within the palette, grouped by category.
export const PALETTE_CATEGORIES: { category: DeviceCategory; kinds: DeviceKind[] }[] = [
  { category: 'Network', kinds: ['router', 'switch', 'l3switch', 'hub'] },
  { category: 'Wireless', kinds: ['accesspoint', 'wifirouter'] },
  { category: 'End Devices', kinds: ['pc', 'laptop', 'server', 'phone', 'printer', 'iot'] },
  { category: 'WAN & Security', kinds: ['firewall', 'cloud'] },
];

export const DEFAULT_SCRIPT = `// IoT device script (JavaScript sandbox). Press Run.
// API:
//   device.name, device.ip            this device's identity
//   log(...args)                      print to the console
//   ping(ip)                          ping a host, returns true/false
//   setInterface(name, {ip, mask, up})
//   onTick(fn)                        run fn() once per second (max 120s)
//   random(min, max)                  a random number in [min, max)

let count = 0;

onTick(() => {
  count++;
  const temp = (20 + random(0, 5)).toFixed(1);
  log(\`\${device.name} heartbeat #\${count}, sensor temp \${temp} C\`);
});
`;
