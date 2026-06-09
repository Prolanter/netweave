import type { Node, Edge } from '@xyflow/react';
import type { DeviceData, NetInterface, StaticRoute } from '../types';
import { routingTable, arpTable } from './netinfo';
import { simulatePing } from './simulate';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { maskToCidr, isValidIp, isValidMask } from './ip';

type DNode = Node<DeviceData>;

export type CliMode = 'user' | 'priv' | 'config' | 'if';

export interface CliSession {
  mode: CliMode;
  ifId: string | null;
}

export interface CliApi {
  node: DNode;
  nodes: DNode[];
  edges: Edge[];
  setName: (name: string) => void;
  patchIface: (ifId: string, patch: Partial<NetInterface>) => void;
  setRoutes: (routes: StaticRoute[]) => void;
}

export interface CliResult {
  lines: string[];
  session: CliSession;
}

export const initialSession: CliSession = { mode: 'user', ifId: null };

export function cliPrompt(name: string, s: CliSession): string {
  switch (s.mode) {
    case 'user':
      return `${name}>`;
    case 'priv':
      return `${name}#`;
    case 'config':
      return `${name}(config)#`;
    case 'if':
      return `${name}(config-if)#`;
  }
}

// Resolve a (possibly abbreviated) interface name like "g0/0", "gi0/0", "fa0/1".
function findIface(node: DNode, token: string): NetInterface | undefined {
  const t = token.toLowerCase().replace(/\s+/g, '');
  const expanded = t
    .replace(/^gig?(?=\d)/, 'gigabitethernet')
    .replace(/^gi(?=\d)/, 'gigabitethernet')
    .replace(/^g(?=\d)/, 'gigabitethernet')
    .replace(/^fas?t?(?=\d)/, 'fastethernet')
    .replace(/^fa(?=\d)/, 'fastethernet')
    .replace(/^se?r?(?=\d)/, 'serial')
    .replace(/^eth?(?=\d)/, 'ethernet');
  return node.data.interfaces.find((i) => {
    const name = i.name.toLowerCase();
    return name === expanded || name.startsWith(expanded) || name.startsWith(t);
  });
}

const HELP_USER = [
  'enable            Enter privileged mode',
  'ping <ip>         Send echo requests to a host',
  'show ...          Show running information',
  '?                 Show this help',
];
const HELP_PRIV = [
  'configure terminal  Enter global configuration',
  'show ...            Show running information',
  'ping <ip>           Send echo requests',
  'disable             Return to user mode',
];
const HELP_CONFIG = [
  'hostname <name>               Set device name',
  'interface <if>                Configure an interface (e.g. g0/0)',
  'ip route <net> <mask> <nh>    Add a static route',
  'no ip route <net> <mask>      Remove a static route',
  'exit                          Leave configuration',
];
const HELP_IF = [
  'ip address <ip> <mask>   Set the interface address',
  'no shutdown              Enable the interface',
  'shutdown                 Disable the interface',
  'exit                     Back to global config',
];

function showCommands(rest: string, api: CliApi): string[] {
  const { node, nodes, edges } = api;
  const sub = rest.trim().toLowerCase();

  if (sub.startsWith('ip int') || sub === 'ip interface brief') {
    const rows = ['Interface              IP-Address       Status     Protocol'];
    for (const i of node.data.interfaces) {
      const ip = i.ip || 'unassigned';
      const status = i.up ? 'up' : 'administratively down';
      const proto = i.up && i.ip ? 'up' : 'down';
      rows.push(
        `${i.name.padEnd(22)} ${ip.padEnd(16)} ${status.padEnd(10)} ${proto}`
      );
    }
    return rows;
  }
  if (sub.startsWith('ip route')) {
    const routes = routingTable(node);
    if (!routes.length) return ['No routes. Configure an interface IP first.'];
    return [
      'Codes: C - connected, S* - default static',
      ...routes.map(
        (r) => `${r.type.padEnd(3)} ${r.network}/${r.cidr ?? ''} ${r.via}`
      ),
    ];
  }
  if (sub.startsWith('arp')) {
    const arp = arpTable(node, nodes, edges);
    if (!arp.length) return ['ARP table is empty.'];
    return [
      'Address          Hardware Addr       Device',
      ...arp.map((a) => `${a.ip.padEnd(16)} ${a.mac}   ${a.name}`),
    ];
  }
  if (sub.startsWith('mac')) {
    // MAC table = the device's own ports plus learned neighbours.
    const arp = arpTable(node, nodes, edges);
    return [
      'Mac Address Table',
      'Vlan    Mac Address         Type      Ports',
      ...arp.map((a) => `1       ${a.mac}   dynamic   (${a.name})`),
    ];
  }
  if (sub.startsWith('run') || sub.startsWith('start')) {
    const out = [`hostname ${node.data.name}`, '!'];
    for (const i of node.data.interfaces) {
      out.push(`interface ${i.name}`);
      if (i.ip) out.push(` ip address ${i.ip} ${i.mask}`);
      out.push(i.up ? ' no shutdown' : ' shutdown');
      out.push('!');
    }
    return out;
  }
  if (sub.startsWith('ver')) {
    return [
      `NetWeave IOS (educational), ${DEVICE_DEFS[node.data.kind].label}`,
      `${node.data.name} uptime is 0 minutes`,
      `${node.data.interfaces.length} interfaces`,
    ];
  }
  return [`% Unknown show command. Try: ip interface brief | ip route | arp | mac address-table | running-config`];
}

export function execCli(input: string, api: CliApi, session: CliSession): CliResult {
  const { node, nodes, edges } = api;
  const raw = input.trim();
  const lower = raw.toLowerCase();
  const lines: string[] = [];
  let s = { ...session };

  if (raw === '') return { lines, session: s };
  if (raw === '?') {
    const help =
      s.mode === 'user'
        ? HELP_USER
        : s.mode === 'priv'
        ? HELP_PRIV
        : s.mode === 'config'
        ? HELP_CONFIG
        : HELP_IF;
    return { lines: help, session: s };
  }

  const [cmd, ...args] = lower.split(/\s+/);

  // mode-independent navigation
  if (lower === 'end') {
    s.mode = s.mode === 'user' ? 'user' : 'priv';
    if (s.mode === 'priv') s.ifId = null;
    return { lines, session: s };
  }

  if (s.mode === 'user') {
    if (cmd === 'enable' || cmd === 'en') {
      s.mode = 'priv';
      return { lines, session: s };
    }
    if (cmd === 'ping') return { lines: doPing(args[0], api), session: s };
    if (cmd === 'show') return { lines: showCommands(raw.slice(4), api), session: s };
    return { lines: [`% Unknown command. Type ? for help.`], session: s };
  }

  if (s.mode === 'priv') {
    if (lower === 'configure terminal' || lower === 'conf t' || lower === 'config t' || cmd === 'configure') {
      s.mode = 'config';
      lines.push('Enter configuration commands, one per line. End with CNTL/Z.');
      return { lines, session: s };
    }
    if (cmd === 'disable') {
      s.mode = 'user';
      return { lines, session: s };
    }
    if (cmd === 'exit') {
      s.mode = 'user';
      return { lines, session: s };
    }
    if (cmd === 'ping') return { lines: doPing(args[0], api), session: s };
    if (cmd === 'show') return { lines: showCommands(raw.slice(4), api), session: s };
    if (cmd === 'write' || (cmd === 'copy' && args.length)) {
      return { lines: ['Building configuration...', '[OK]'], session: s };
    }
    return { lines: [`% Unknown command. Type ? for help.`], session: s };
  }

  if (s.mode === 'config') {
    if (cmd === 'hostname' && args[0]) {
      api.setName(raw.split(/\s+/)[1]);
      return { lines, session: s };
    }
    if (cmd === 'interface' || cmd === 'int') {
      const token = raw.split(/\s+/).slice(1).join('');
      const itf = findIface(node, token);
      if (!itf) return { lines: [`% Invalid interface "${token}"`], session: s };
      s.mode = 'if';
      s.ifId = itf.id;
      return { lines, session: s };
    }
    if (cmd === 'exit') {
      s.mode = 'priv';
      return { lines, session: s };
    }
    if (cmd === 'ip' && args[0] === 'route') {
      const p = raw.split(/\s+/);
      const net = p[2];
      const mask = p[3];
      const nh = p[4];
      if (!net || !mask || !nh) {
        return { lines: ['% Usage: ip route <network> <mask> <next-hop>'], session: s };
      }
      if (!isValidIp(net) || !isValidMask(mask) || !isValidIp(nh)) {
        return { lines: ['% Invalid network, mask, or next-hop address.'], session: s };
      }
      const existing = node.data.routes ?? [];
      api.setRoutes([
        ...existing.filter((r) => !(r.network === net && r.mask === mask)),
        { network: net, mask, nextHop: nh },
      ]);
      return { lines, session: s };
    }
    if (cmd === 'no' && args[0] === 'ip' && args[1] === 'route') {
      const p = raw.split(/\s+/);
      const net = p[3];
      const mask = p[4];
      api.setRoutes((node.data.routes ?? []).filter((r) => !(r.network === net && r.mask === mask)));
      return { lines, session: s };
    }
    return { lines: [`% Unrecognized command in config mode. Type ? for help.`], session: s };
  }

  // interface config mode
  if (s.mode === 'if') {
    const itf = node.data.interfaces.find((i) => i.id === s.ifId);
    if (cmd === 'exit') {
      s.mode = 'config';
      s.ifId = null;
      return { lines, session: s };
    }
    if (!itf) return { lines: ['% No interface selected.'], session: s };
    if (cmd === 'ip' && args[0] === 'address') {
      const ip = args[1];
      const mask = args[2];
      if (!ip || !mask) return { lines: ['% Usage: ip address <ip> <mask>'], session: s };
      if (!isValidIp(ip)) return { lines: [`% Invalid IP address "${ip}"`], session: s };
      if (!isValidMask(mask)) return { lines: [`% Invalid subnet mask "${mask}"`], session: s };
      api.patchIface(itf.id, { ip, mask });
      const cidr = maskToCidr(mask);
      lines.push(`Address set: ${ip}/${cidr}`);
      return { lines, session: s };
    }
    if (cmd === 'no' && args[0] === 'ip' && args[1] === 'address') {
      api.patchIface(itf.id, { ip: '' });
      return { lines, session: s };
    }
    if (cmd === 'shutdown') {
      api.patchIface(itf.id, { up: false });
      lines.push(`%LINK: Interface ${itf.name}, changed state to administratively down`);
      return { lines, session: s };
    }
    if (cmd === 'no' && args[0] === 'shutdown') {
      api.patchIface(itf.id, { up: true });
      lines.push(`%LINK: Interface ${itf.name}, changed state to up`);
      return { lines, session: s };
    }
    if (cmd === 'description') {
      return { lines, session: s }; // accepted, not stored
    }
    return { lines: [`% Unrecognized interface command. Type ? for help.`], session: s };
  }

  return { lines: ['% Error.'], session: s };

  function doPing(target: string | undefined, papi: CliApi): string[] {
    if (!target) return ['% Usage: ping <ip>'];
    const dest = papi.nodes.find((n) =>
      n.data.interfaces.some((i) => i.ip === target)
    );
    if (!dest) return [`% No host has the address ${target}.`];
    const res = simulatePing(nodes, edges, node.id, dest.id);
    if (res.success) {
      return [
        `Sending 5, 100-byte ICMP Echos to ${target}:`,
        '!!!!!',
        `Success rate is 100 percent (5/5)`,
      ];
    }
    return [
      `Sending 5, 100-byte ICMP Echos to ${target}:`,
      '.....',
      `Success rate is 0 percent (0/5). ${res.summary}`,
    ];
  }
}
