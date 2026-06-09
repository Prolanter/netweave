import type { Lab } from '../types';

export const LABS: Lab[] = [
  {
    id: 'lab1',
    title: 'Your First Network',
    difficulty: 'Beginner',
    description:
      'Build the simplest possible network: two PCs connected through a switch, on the same subnet, able to ping each other.',
    objectives: [
      { id: 'o1', text: 'Add at least 2 PCs', check: { type: 'deviceCount', kind: 'pc', min: 2 } },
      { id: 'o2', text: 'Add a switch', check: { type: 'deviceCount', kind: 'switch', min: 1 } },
      { id: 'o3', text: 'Create at least 2 links', check: { type: 'linkCount', min: 2 } },
      { id: 'o4', text: 'Assign IPs to both PCs', check: { type: 'interfaceConfigured', min: 2 } },
    ],
    hints: [
      'Drag two PCs and one Switch onto the canvas.',
      'Connect each PC to the switch by dragging from the dot on a device edge.',
      'Click a PC, then give it an IP like 192.168.1.10 with mask 255.255.255.0.',
      'Give the second PC 192.168.1.11 with the same mask, then run a ping between them.',
    ],
  },
  {
    id: 'lab2',
    title: 'Routing Between Subnets',
    difficulty: 'Intermediate',
    description:
      'Two separate networks can only talk through a router. Connect two subnets via a router and make a ping cross it.',
    objectives: [
      { id: 'o1', text: 'Add a router', check: { type: 'deviceCount', kind: 'router', min: 1 } },
      { id: 'o2', text: 'Add at least 2 PCs', check: { type: 'deviceCount', kind: 'pc', min: 2 } },
      { id: 'o3', text: 'Configure at least 4 interfaces (2 PCs + 2 router ports)', check: { type: 'interfaceConfigured', min: 4 } },
    ],
    hints: [
      'Put each PC on its own subnet, e.g. 10.0.0.0/24 and 10.0.1.0/24.',
      'Give the router an interface IP in each subnet (10.0.0.1 and 10.0.1.1).',
      'Set each PC\'s default gateway to the router IP on its side.',
      'Run a ping from one PC to the other; it should cross the router.',
    ],
  },
  {
    id: 'lab3',
    title: 'Smart Home with IoT',
    difficulty: 'Advanced',
    description:
      'Connect IoT devices to an access point and a server, then experiment with the IoT scripting sandbox.',
    objectives: [
      { id: 'o1', text: 'Add an access point', check: { type: 'deviceCount', kind: 'accesspoint', min: 1 } },
      { id: 'o2', text: 'Add at least 2 IoT devices', check: { type: 'deviceCount', kind: 'iot', min: 2 } },
      { id: 'o3', text: 'Add a server', check: { type: 'deviceCount', kind: 'server', min: 1 } },
      { id: 'o4', text: 'Configure at least 3 interfaces', check: { type: 'interfaceConfigured', min: 3 } },
    ],
    hints: [
      'Drag an Access Point, a Server, and two IoT devices onto the canvas.',
      'Wire the IoT devices and server to the access point.',
      'Give everything IPs on the same subnet (e.g. 192.168.0.0/24).',
      'Select an IoT device and open the Script tab to edit its behavior.',
    ],
  },
];
