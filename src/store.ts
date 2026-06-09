import { create } from 'zustand';
import type { Node, Edge, Connection } from '@xyflow/react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  reconnectEdge,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import type {
  DeviceData,
  DeviceKind,
  SimResult,
  CableType,
  TrafficKind,
  Annotation,
} from './types';
import { DEVICE_DEFS, DEFAULT_SCRIPT, makeDefaultServices } from './data/deviceDefs';
import { autoCable, CABLE_SPEED } from './data/cables';
import { simulatePing } from './sim/simulate';
import { computeAutoRoutes } from './sim/routing';
import { validateTopology, type ValidationIssue } from './sim/validate';
import { isValidIp } from './sim/ip';
import { SEG_MS } from './sim/anim';
import { connectivityMatrix, type MatrixResult } from './sim/connectivity';
import { assignDhcp, resolveDns, httpGet } from './sim/services';

type DNode = Node<DeviceData>;

export interface ConsoleLine {
  id: string;
  kind: 'info' | 'ok' | 'error' | 'sim';
  text: string;
}

interface AppState {
  nodes: DNode[];
  edges: Edge[];
  selectedId: string | null;
  console: ConsoleLine[];
  simResult: SimResult | null;
  lastSim: SimResult | null; // persists for the Packets/Trace tab
  activePath: string[]; // node ids currently being animated
  packetSeg: { from: string; to: string; ms: number } | null; // current hop being animated
  packetKind: TrafficKind; // colour of the travelling packet
  past: { nodes: DNode[]; edges: Edge[] }[]; // undo history
  future: { nodes: DNode[]; edges: Edge[] }[]; // redo history
  pingFrom: string | null;
  pingTo: string | null;
  activeLabId: string | null;
  simMode: boolean; // click-on-canvas ping mode
  running: boolean;
  bottomTab: 'console' | 'labs' | 'packets';
  matrix: MatrixResult | null;
  showMatrix: boolean;
  issues: ValidationIssue[];
  showIssues: boolean;
  scriptRunning: Record<string, boolean>;
  annotations: Annotation[];

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  onReconnect: (oldEdge: Edge, conn: Connection) => void;
  setCableType: (id: string, cable: CableType) => void;
  setEdgeVlan: (id: string, vlan: number) => void;
  setEdgeTrunk: (id: string, trunk: boolean) => void;

  addDevice: (kind: DeviceKind, position: { x: number; y: number }) => void;
  deleteSelected: () => void;
  removeEdge: (id: string) => void;
  select: (id: string | null) => void;
  updateDevice: (id: string, patch: Partial<DeviceData>) => void;

  log: (kind: ConsoleLine['kind'], text: string) => void;
  clearConsole: () => void;
  setSimResult: (r: SimResult | null) => void;
  setActivePath: (ids: string[]) => void;
  setPingEndpoints: (from: string | null, to: string | null) => void;
  setActiveLab: (id: string | null) => void;
  clearTopology: () => void;

  setSimMode: (on: boolean) => void;
  setBottomTab: (tab: 'console' | 'labs' | 'packets') => void;
  handleNodeClick: (id: string) => void;
  runPing: (fromId: string, toId: string) => Promise<void>;
  runConnectivityTest: () => void;
  setShowMatrix: (show: boolean) => void;
  autoRoute: () => void;
  runValidation: () => void;
  setShowIssues: (show: boolean) => void;
  runScript: (nodeId: string) => void;
  stopScript: (nodeId: string) => void;
  addAnnotation: (type: Annotation['type'], pos: { x: number; y: number }) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  requestDhcp: () => void;
  runNslookup: (fromId: string, name: string) => Promise<void>;
  runHttpGet: (fromId: string, target: string) => Promise<void>;
  animatePath: (path: string[], kind: TrafficKind, withReply: boolean) => Promise<void>;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadTopology: (nodes: DNode[], edges: Edge[]) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const prefix: Record<DeviceKind, string> = {
  router: 'R',
  switch: 'SW',
  l3switch: 'MLS',
  firewall: 'FW',
  hub: 'HUB',
  wifirouter: 'WR',
  accesspoint: 'AP',
  pc: 'PC',
  laptop: 'LT',
  server: 'SRV',
  phone: 'PH',
  printer: 'PR',
  iot: 'IoT',
  cloud: 'NET',
};

let idSeq = 0;
const newId = () => `n${Date.now().toString(36)}${idSeq++}`;

// Running IoT script tick timers, keyed by device id.
const scriptTimers = new Map<string, ReturnType<typeof setInterval>>();

const STORAGE_KEY = 'nw.topology';

function loadPersisted(): { nodes: DNode[]; edges: Edge[]; annotations: Annotation[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { nodes: p.nodes ?? [], edges: p.edges ?? [], annotations: p.annotations ?? [] };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { nodes: [], edges: [], annotations: [] };
}

const persisted = loadPersisted();

export const useStore = create<AppState>((set, get) => ({
  nodes: persisted.nodes,
  edges: persisted.edges,
  selectedId: null,
  console: [
    {
      id: 'welcome',
      kind: 'info',
      text: persisted.nodes.length
        ? `NetWeave ready. Restored your last topology (${persisted.nodes.length} device${persisted.nodes.length === 1 ? '' : 's'}).`
        : 'NetWeave ready. Drag a device from the left to begin.',
    },
  ],
  simResult: null,
  lastSim: null,
  activePath: [],
  packetSeg: null,
  packetKind: 'icmp',
  past: [],
  future: [],
  pingFrom: null,
  pingTo: null,
  activeLabId: null,
  simMode: false,
  running: false,
  bottomTab: 'console',
  issues: [],
  showIssues: false,
  scriptRunning: {},
  annotations: persisted.annotations,
  matrix: null,
  showMatrix: false,

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) as DNode[] }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (conn) => {
    get().pushHistory();
    const a = get().nodes.find((n) => n.id === conn.source);
    const b = get().nodes.find((n) => n.id === conn.target);
    const cable = a && b ? autoCable(a.data.kind, b.data.kind) : 'straight';
    // Switch-to-switch links default to trunks; everything else is access VLAN 1.
    const trunk = a?.data.kind === 'switch' && b?.data.kind === 'switch';
    const edge = {
      ...conn,
      type: 'deletable',
      animated: false,
      data: { cable, vlan: 1, trunk },
    };
    set({ edges: addEdge(edge, get().edges) });
    if (a && b) get().log('ok', `Linked ${a.data.name} ↔ ${b.data.name} (${cable} cable)`);
  },

  onReconnect: (oldEdge, conn) => {
    get().pushHistory();
    set({ edges: reconnectEdge(oldEdge, conn, get().edges) });
  },

  setCableType: (id, cable) => {
    get().pushHistory();
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, cable } } : e
      ),
    });
  },

  setEdgeVlan: (id, vlan) =>
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, vlan, trunk: false } } : e
      ),
    }),

  setEdgeTrunk: (id, trunk) =>
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, trunk } } : e
      ),
    }),

  addDevice: (kind, position) => {
    get().pushHistory();
    const def = DEVICE_DEFS[kind];
    // Reuse the lowest free number for this kind (e.g. PC1 frees up when removed).
    const used = new Set(
      get()
        .nodes.filter((n) => n.data.kind === kind)
        .map((n) => n.data.name)
    );
    let num = 1;
    while (used.has(`${prefix[kind]}${num}`)) num++;
    const name = `${prefix[kind]}${num}`;
    const data: DeviceData = {
      kind,
      name,
      interfaces: def.makeInterfaces(),
      ...(def.role === 'host' ? { gateway: '', dns: '', dhcpClient: false } : {}),
      ...(def.services ? { services: makeDefaultServices(def.services) } : {}),
      ...(def.scriptable ? { script: DEFAULT_SCRIPT } : {}),
    };
    const node: DNode = {
      id: newId(),
      type: 'device',
      position,
      data,
    };
    set({ nodes: [...get().nodes, node], selectedId: node.id });
    get().log('info', `Added ${def.label} "${name}"`);
  },

  deleteSelected: () => {
    const id = get().selectedId;
    if (!id) return;
    get().pushHistory();
    get().stopScript(id);
    const node = get().nodes.find((n) => n.id === id);
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: null,
    });
    if (node) get().log('info', `Removed ${node.data.name}`);
  },

  removeEdge: (id) => {
    get().pushHistory();
    const edge = get().edges.find((e) => e.id === id);
    set({ edges: get().edges.filter((e) => e.id !== id) });
    if (edge) {
      const a = get().nodes.find((n) => n.id === edge.source);
      const b = get().nodes.find((n) => n.id === edge.target);
      if (a && b) get().log('info', `Removed link ${a.data.name} ↔ ${b.data.name}`);
    }
  },

  select: (id) => set({ selectedId: id }),

  updateDevice: (id, patch) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    }),

  log: (kind, text) =>
    set({
      console: [
        ...get().console.slice(-200),
        { id: newId(), kind, text },
      ],
    }),

  clearConsole: () => set({ console: [] }),
  setSimResult: (r) => set({ simResult: r }),
  setActivePath: (ids) => set({ activePath: ids }),
  setPingEndpoints: (from, to) => set({ pingFrom: from, pingTo: to }),
  setActiveLab: (id) => set({ activeLabId: id }),

  setSimMode: (on) =>
    set({
      simMode: on,
      pingFrom: null,
      pingTo: null,
      simResult: null,
      activePath: [],
      packetSeg: null,
    }),

  setBottomTab: (tab) => set({ bottomTab: tab }),

  handleNodeClick: (id) => {
    const { simMode, pingFrom, running } = get();
    if (!simMode || running) return;
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    const isHost = DEVICE_DEFS[node.data.kind].role === 'host';
    if (!isHost) {
      get().log('error', `${node.data.name} is not an end host. Pick a PC, laptop, server, phone, printer, or IoT device.`);
      return;
    }
    if (!pingFrom) {
      set({ pingFrom: id, pingTo: null, simResult: null });
      get().log('info', `Source: ${node.data.name}. Now click a destination host.`);
      return;
    }
    if (id === pingFrom) {
      // deselect
      set({ pingFrom: null });
      get().log('info', 'Source cleared. Click a source host.');
      return;
    }
    set({ pingTo: id });
    void get().runPing(pingFrom, id);
  },

  runPing: async (fromId, toId) => {
    const { nodes, edges } = get();
    const from = nodes.find((n) => n.id === fromId);
    const to = nodes.find((n) => n.id === toId);
    if (!from || !to) return;

    set({ running: true, bottomTab: 'console', simResult: null });
    get().log('sim', `> ping ${from.data.name} → ${to.data.name}`);

    const result = simulatePing(nodes, edges, fromId, toId);

    for (const step of result.steps) {
      get().log(step.ok ? 'info' : 'error', `  ${step.ok ? '✓' : '✗'} ${step.label}`);
    }

    // Animate the ICMP request along the cable path, then the echo reply back.
    if (result.path.length > 1) {
      await get().animatePath(result.path, 'icmp', result.success);
    }

    get().log(result.success ? 'ok' : 'error', result.summary);

    set({ simResult: result, lastSim: result, packetSeg: null });
    await sleep(500);
    set({ activePath: [], running: false });
  },

  runConnectivityTest: () => {
    const { nodes, edges } = get();
    const matrix = connectivityMatrix(nodes, edges);
    if (matrix.hosts.length < 2) {
      get().log('error', 'Need at least two end hosts to run a connectivity test.');
      return;
    }
    set({ matrix, showMatrix: true });
    get().log(
      matrix.reachable === matrix.total ? 'ok' : 'info',
      `Connectivity test: ${matrix.reachable}/${matrix.total} host pairs reachable.`
    );
  },

  setShowMatrix: (show) => set({ showMatrix: show }),

  runValidation: () => {
    const issues = validateTopology(get().nodes, get().edges);
    set({ issues, showIssues: true });
    const errs = issues.filter((i) => i.level === 'error').length;
    const warns = issues.length - errs;
    get().log(
      issues.length === 0 ? 'ok' : errs > 0 ? 'error' : 'info',
      issues.length === 0
        ? 'Health check: no problems found.'
        : `Health check: ${errs} error(s), ${warns} warning(s).`
    );
  },

  setShowIssues: (show) => set({ showIssues: show }),

  runScript: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    get().stopScript(nodeId);
    set({ bottomTab: 'console' });

    const name = () => get().nodes.find((n) => n.id === nodeId)?.data.name ?? node.data.name;
    const log = (...args: unknown[]) =>
      get().log(
        'sim',
        `[${name()}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
      );
    const ping = (ip: string) => {
      const dest = get().nodes.find((n) => n.data.interfaces.some((i) => i.ip === ip));
      if (!dest) {
        get().log('error', `[${name()}] ping ${ip}: host not found`);
        return false;
      }
      const r = simulatePing(get().nodes, get().edges, nodeId, dest.id);
      get().log(r.success ? 'ok' : 'error', `[${name()}] ping ${ip}: ${r.success ? 'reply received' : 'no reply'}`);
      return r.success;
    };
    const setInterface = (ifName: string, cfg: { ip?: string; mask?: string; up?: boolean }) => {
      const cur = get().nodes.find((n) => n.id === nodeId);
      if (!cur) return;
      const interfaces = cur.data.interfaces.map((i) =>
        i.name.toLowerCase() === String(ifName).toLowerCase()
          ? {
              ...i,
              ...(cfg.ip !== undefined ? { ip: cfg.ip } : {}),
              ...(cfg.mask !== undefined ? { mask: cfg.mask } : {}),
              ...(cfg.up !== undefined ? { up: !!cfg.up } : {}),
            }
          : i
      );
      get().updateDevice(nodeId, { interfaces });
    };
    const device = {
      name: node.data.name,
      ip: node.data.interfaces.find((i) => i.ip)?.ip ?? '',
      kind: node.data.kind,
    };
    const random = (a = 0, b = 1) => a + Math.random() * (b - a);

    let tickFn: (() => void) | null = null;
    const onTick = (fn: () => void) => {
      tickFn = fn;
    };

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        'device',
        'log',
        'ping',
        'setInterface',
        'onTick',
        'random',
        `"use strict";\n${node.data.script ?? ''}`
      );
      fn(device, log, ping, setInterface, onTick, random);
      get().log('info', `[${name()}] script started`);
      if (typeof tickFn === 'function') {
        let count = 0;
        const id = setInterval(() => {
          count++;
          try {
            tickFn!();
          } catch (e) {
            get().log('error', `[${name()}] tick error: ${(e as Error).message}`);
            get().stopScript(nodeId);
          }
          if (count >= 120) get().stopScript(nodeId);
        }, 1000);
        scriptTimers.set(nodeId, id);
        set({ scriptRunning: { ...get().scriptRunning, [nodeId]: true } });
      }
    } catch (e) {
      get().log('error', `[${name()}] script error: ${(e as Error).message}`);
    }
  },

  stopScript: (nodeId) => {
    const id = scriptTimers.get(nodeId);
    if (id === undefined) return;
    clearInterval(id);
    scriptTimers.delete(nodeId);
    const running = { ...get().scriptRunning };
    delete running[nodeId];
    set({ scriptRunning: running });
    get().log('info', `[${get().nodes.find((n) => n.id === nodeId)?.data.name ?? 'device'}] script stopped`);
  },

  addAnnotation: (type, pos) => {
    const ann: Annotation =
      type === 'label'
        ? { id: newId(), type, x: pos.x, y: pos.y, w: 160, h: 30, text: 'New label', color: '#e2e8f0' }
        : { id: newId(), type, x: pos.x, y: pos.y, w: 260, h: 170, text: 'Zone', color: '#2dd4bf' };
    set({ annotations: [...get().annotations, ann] });
  },

  updateAnnotation: (id, patch) =>
    set({
      annotations: get().annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }),

  removeAnnotation: (id) =>
    set({ annotations: get().annotations.filter((a) => a.id !== id) }),

  autoRoute: () => {
    const { nodes, edges } = get();
    const routeMap = computeAutoRoutes(nodes, edges);
    const routerIds = Object.keys(routeMap);
    if (routerIds.length === 0) {
      get().log('info', 'Auto-route: no routers to configure.');
      return;
    }
    get().pushHistory();
    let total = 0;
    set({
      nodes: nodes.map((n) => {
        if (routeMap[n.id]) {
          total += routeMap[n.id].length;
          return { ...n, data: { ...n.data, routes: routeMap[n.id] } };
        }
        return n;
      }),
    });
    get().log('ok', `Auto-route: installed ${total} static route(s) across ${routerIds.length} router(s).`);
  },

  requestDhcp: () => {
    const { nodes, edges } = get();
    const clients = nodes.filter((n) => n.data.dhcpClient);
    if (clients.length === 0) {
      get().log('error', 'No DHCP clients. Tick "Obtain IP automatically" on a host first.');
      return;
    }
    const { leases, failures } = assignDhcp(nodes, edges);
    if (leases.length > 0) {
      const updated = nodes.map((n) => {
        const lease = leases.find((l) => l.clientId === n.id);
        if (!lease) return n;
        const interfaces = n.data.interfaces.map((itf, i) =>
          i === 0
            ? { ...itf, ip: lease.ip, mask: lease.mask, up: true }
            : itf
        );
        return {
          ...n,
          data: { ...n.data, interfaces, gateway: lease.gateway, dns: lease.dns },
        };
      });
      set({ nodes: updated });
      for (const l of leases) {
        get().log('ok', `DHCP: ${l.clientName} leased ${l.ip} from ${l.serverName} (gw ${l.gateway}).`);
      }
    }
    for (const f of failures) {
      get().log('error', `DHCP: ${f.clientName} failed (${f.reason}).`);
    }
  },

  runNslookup: async (fromId, name) => {
    const { nodes, edges } = get();
    const from = nodes.find((n) => n.id === fromId);
    get().setBottomTab('console');
    get().log('sim', `> ${from?.data.name ?? 'host'} nslookup ${name}`);
    const dnsServer = nodes.find((n) => n.data.services?.dns?.enabled);
    if (dnsServer && dnsServer.id !== fromId) {
      const dpath = simulatePing(nodes, edges, fromId, dnsServer.id).path;
      if (dpath.length > 1) await get().animatePath(dpath, 'dns', true);
    }
    const ip = resolveDns(nodes, name);
    if (ip) get().log('ok', `  ${name} → ${ip}`);
    else get().log('error', `  ${name} → name not found (no DNS record).`);
  },

  runHttpGet: async (fromId, target) => {
    const { nodes, edges } = get();
    const from = nodes.find((n) => n.id === fromId);
    if (!from) return;
    get().setBottomTab('console');
    set({ running: true });
    get().log('sim', `> ${from.data.name} HTTP GET ${target}`);

    let ip = target.trim();
    if (!isValidIp(ip)) {
      // DNS resolution phase: animate the query to a DNS server first.
      const dnsServer = nodes.find((n) => n.data.services?.dns?.enabled);
      if (dnsServer && dnsServer.id !== fromId) {
        const dpath = simulatePing(nodes, edges, fromId, dnsServer.id).path;
        get().log('sim', `  DNS query → ${dnsServer.data.name}`);
        if (dpath.length > 1) await get().animatePath(dpath, 'dns', true);
      }
      const resolved = resolveDns(nodes, ip);
      if (!resolved) {
        get().log('error', `  cannot resolve "${target}"`);
        set({ running: false, activePath: [] });
        return;
      }
      ip = resolved;
      get().log('ok', `  ${target} resolved to ${ip}`);
    }

    const res = httpGet(nodes, edges, fromId, ip);
    const server = nodes.find((n) => n.data.interfaces.some((itf) => itf.ip === ip));
    if (server && server.id !== fromId) {
      const hpath = simulatePing(nodes, edges, fromId, server.id).path;
      get().log('sim', `  HTTP GET → ${server.data.name}`);
      if (hpath.length > 1) await get().animatePath(hpath, 'http', res.ok);
    }
    if (res.ok) {
      get().log('ok', `  ${res.status} from ${res.serverName}`);
      if (res.body) get().log('info', `  ↳ "${res.body}"`);
    } else {
      get().log('error', `  ${res.status}`);
    }
    set({ running: false, activePath: [] });
  },

  animatePath: async (path, kind, withReply) => {
    if (path.length < 2) return;
    const edges = get().edges;
    const durFor = (a: string, b: string) => {
      const e = edges.find(
        (e) =>
          (e.source === a && e.target === b) || (e.source === b && e.target === a)
      );
      const cable = (e?.data?.cable as CableType) ?? 'straight';
      return Math.max(150, Math.round(SEG_MS * (CABLE_SPEED[cable] ?? 1)));
    };
    set({ activePath: path, packetKind: kind });
    for (let i = 0; i < path.length - 1; i++) {
      set({ packetSeg: { from: path[i], to: path[i + 1], ms: durFor(path[i], path[i + 1]) } });
      await sleep(durFor(path[i], path[i + 1]));
    }
    if (withReply) {
      for (let i = path.length - 1; i > 0; i--) {
        set({ packetSeg: { from: path[i], to: path[i - 1], ms: durFor(path[i], path[i - 1]) } });
        await sleep(durFor(path[i], path[i - 1]));
      }
    }
    set({ packetSeg: null });
  },

  pushHistory: () =>
    set((s) => ({
      past: [...s.past.slice(-49), { nodes: s.nodes, edges: s.edges }],
      future: [],
    })),

  undo: () => {
    const { past } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [{ nodes: get().nodes, edges: get().edges }, ...get().future].slice(0, 50),
      selectedId: null,
    });
    get().log('info', 'Undo');
  },

  redo: () => {
    const { future } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      future: future.slice(1),
      past: [...get().past, { nodes: get().nodes, edges: get().edges }].slice(-50),
      selectedId: null,
    });
    get().log('info', 'Redo');
  },

  loadTopology: (nodes, edges) => {
    get().pushHistory();
    set({
      nodes,
      edges,
      selectedId: null,
      simResult: null,
      activePath: [],
      packetSeg: null,
    });
  },

  clearTopology: () => {
    get().pushHistory();
    for (const id of scriptTimers.keys()) clearInterval(scriptTimers.get(id)!);
    scriptTimers.clear();
    set({
      nodes: [],
      edges: [],
      annotations: [],
      selectedId: null,
      scriptRunning: {},
      simResult: null,
      lastSim: null,
      activePath: [],
      packetSeg: null,
      pingFrom: null,
      pingTo: null,
      simMode: false,
      running: false,
      matrix: null,
      showMatrix: false,
    });
  },
}));

// Autosave: debounce-persist the topology to local storage whenever it changes.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((state, prev) => {
  if (
    state.nodes === prev.nodes &&
    state.edges === prev.edges &&
    state.annotations === prev.annotations
  )
    return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nodes: state.nodes,
          edges: state.edges,
          annotations: state.annotations,
        })
      );
    } catch {
      /* storage full or unavailable */
    }
  }, 400);
});
