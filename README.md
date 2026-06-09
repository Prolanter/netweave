# NetWeave

A modern, approachable alternative to Cisco Packet Tracer for **studying network
topologies, protocols, VLANs, routing, and IoT scripting**, built with a clean
drag-and-drop interface and an educational simulation engine.

NetWeave runs as a desktop app on Windows (via Electron) and as a web app in any
modern browser.

> Educational simulator: the protocol behaviour is visual/teaching-grade, not an
> RFC-accurate implementation.

## Features

- **Drag-and-drop canvas** with 14 device types (routers, switches, L3 switches,
  firewalls, hubs, access points, wireless routers, PCs, laptops, servers,
  phones, printers, IoT devices, and a WAN cloud).
- **Accurate routing simulation** driven by per-device routing tables
  (connected + static + default routes), with longest-prefix matching, so
  multi-router topologies behave correctly. One-click **Auto-route** configures
  static routes for you.
- **VLANs** - per-link access VLANs and trunks, with VLAN-aware Layer-2
  forwarding and inter-VLAN routing.
- **Cable types** - straight-through, crossover, fiber, serial, and wireless,
  auto-selected and adjustable, with packets that animate along the real path at
  cable-dependent speed.
- **Click-to-simulate**: pick two hosts and watch ICMP/DNS/HTTP packets travel,
  with a hop-by-hop console, traceroute, and packet (OSI-layer) inspection.
- **IOS-style CLI** on managed devices (`enable`, `configure terminal`,
  `interface`, `ip address`, `ip route`, `show ip route`, `show ip interface
  brief`, `ping`, and more).
- **Device tables** - live ARP, routing, and interface/port tables.
- **Services** - DHCP, DNS, and HTTP on servers/routers.
- **IoT scripting** - a JavaScript sandbox per device (`log`, `ping`,
  `setInterface`, `onTick`, ...).
- **Guided labs**, a **connectivity matrix** (test every host pair), and a
  **config health-check** that flags common mistakes (duplicate IPs, bad
  gateways, isolated devices...).
- **Annotations** (text labels and zone boxes) and **figure export** to
  PNG / SVG / JPEG for papers and reports.
- **Autosave**, **undo/redo**, and **example templates**.

## Run from source

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev          # start the web app at http://localhost:5173
```

## Build the desktop app (Windows installer)

```bash
npm run electron:build
```

The installer is produced in the `release/` folder
(`NetWeave-Setup-<version>.exe`). Run it to install NetWeave like any other
Windows program - it adds Start Menu and desktop shortcuts and works fully
offline.

To run the desktop app against the live dev server while developing:

```bash
npm run electron:dev
```

## Tech stack

React 19 . TypeScript . Vite . [@xyflow/react](https://reactflow.dev) .
Zustand . Electron . electron-builder.

## License

MIT
