import type { Node } from '@xyflow/react';
import type { DeviceData } from '../types';
import { useStore } from '../store';
import { portTable, arpTable, routingTable } from '../sim/netinfo';

export function DeviceTables({ node }: { node: Node<DeviceData> }) {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);

  const ports = portTable(node, nodes, edges);
  const arp = arpTable(node, nodes, edges);
  const routes = routingTable(node);

  return (
    <div className="dtables">
      <div className="section-label">Interfaces / ports</div>
      <table className="dtable">
        <thead>
          <tr>
            <th>Port</th>
            <th>IP</th>
            <th>MAC</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.ip || <span className="muted">·</span>}</td>
              <td className="mono">{p.mac}</td>
              <td>
                <span className={`pill ${p.status === 'up/up' ? 'ok' : p.status === 'up/down' ? 'warn' : 'down'}`}>
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-label">Routing table</div>
      {routes.length === 0 ? (
        <div className="dtable-empty">No active routes. Configure an interface IP.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th>Code</th>
              <th>Network</th>
              <th>Via</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r, i) => (
              <tr key={i}>
                <td><span className={`pill ${r.type === 'C' ? 'ok' : 'route'}`}>{r.type}</span></td>
                <td className="mono">{r.network}{r.cidr !== null ? `/${r.cidr}` : ''}</td>
                <td>{r.via}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="section-label">ARP table (known neighbours)</div>
      {arp.length === 0 ? (
        <div className="dtable-empty">
          No neighbours on this network yet. Connect another device on the same subnet.
        </div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th>IP</th>
              <th>MAC</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {arp.map((a, i) => (
              <tr key={i}>
                <td className="mono">{a.ip}</td>
                <td className="mono">{a.mac}</td>
                <td>{a.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
