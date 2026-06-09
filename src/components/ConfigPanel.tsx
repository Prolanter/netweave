import { useState } from 'react';
import { Trash2, Cpu, Settings2, Table2, SlidersHorizontal, Server, TerminalSquare, Play, Square } from 'lucide-react';
import { useStore } from '../store';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { isValidIp, isValidMask, maskToCidr } from '../sim/ip';
import { DeviceTables } from './DeviceTables';
import { ServicesPanel } from './ServicesPanel';
import { CliPanel } from './CliPanel';
import type { NetInterface, DeviceKind } from '../types';

const CLI_KINDS: DeviceKind[] = ['router', 'switch', 'l3switch', 'firewall', 'wifirouter'];

export function ConfigPanel() {
  const node = useStore((s) => s.nodes.find((n) => n.id === s.selectedId));
  const updateDevice = useStore((s) => s.updateDevice);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const requestDhcp = useStore((s) => s.requestDhcp);
  const runNslookup = useStore((s) => s.runNslookup);
  const runHttpGet = useStore((s) => s.runHttpGet);
  const runScript = useStore((s) => s.runScript);
  const stopScript = useStore((s) => s.stopScript);
  const scriptRunning = useStore((s) => (node ? !!s.scriptRunning[node.id] : false));
  const [tab, setTab] = useState<'config' | 'tables' | 'services' | 'cli' | 'script'>('config');
  const [lookup, setLookup] = useState('');
  const [url, setUrl] = useState('');

  if (!node) {
    return (
      <aside className="config">
        <div className="panel-title">Properties</div>
        <div className="config-empty">
          <Settings2 size={32} strokeWidth={1.5} />
          <p>Select a device to configure it.</p>
        </div>
      </aside>
    );
  }

  const d = node.data;
  const def = DEVICE_DEFS[d.kind];

  const setName = (name: string) => updateDevice(node.id, { name });
  const setGateway = (gateway: string) => updateDevice(node.id, { gateway });
  const setDns = (dns: string) => updateDevice(node.id, { dns });
  const setScript = (script: string) => updateDevice(node.id, { script });
  const isHost = def.role === 'host';
  const dhcpClient = !!d.dhcpClient;
  const hasCli = CLI_KINDS.includes(d.kind);

  // Fall back to Config when the remembered tab doesn't exist on this device.
  const tabOk =
    tab === 'config' ||
    tab === 'tables' ||
    (tab === 'services' && !!def.services) ||
    (tab === 'cli' && hasCli) ||
    (tab === 'script' && def.scriptable);
  const activeTab = tabOk ? tab : 'config';

  const patchInterface = (ifId: string, patch: Partial<NetInterface>) => {
    const interfaces = d.interfaces.map((itf) =>
      itf.id === ifId ? { ...itf, ...patch } : itf
    );
    updateDevice(node.id, { interfaces });
  };

  return (
    <aside className="config">
      <div className="panel-title">Properties</div>

      <div className="config-head">
        <div
          className="config-badge"
          style={{ background: def.color + '22', color: def.color }}
        >
          {def.label}
        </div>
        <button className="icon-btn danger" title="Delete device" onClick={deleteSelected}>
          <Trash2 size={16} />
        </button>
      </div>

      <label className="field">
        <span>Name</span>
        <input value={d.name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="tabs">
        <button
          className={activeTab === 'config' ? 'tab active' : 'tab'}
          onClick={() => setTab('config')}
        >
          <SlidersHorizontal size={13} /> Config
        </button>
        <button
          className={activeTab === 'tables' ? 'tab active' : 'tab'}
          onClick={() => setTab('tables')}
        >
          <Table2 size={13} /> Tables
        </button>
        {def.services && (
          <button
            className={activeTab === 'services' ? 'tab active' : 'tab'}
            onClick={() => setTab('services')}
          >
            <Server size={13} /> Services
          </button>
        )}
        {hasCli && (
          <button
            className={activeTab === 'cli' ? 'tab active' : 'tab'}
            onClick={() => setTab('cli')}
          >
            <TerminalSquare size={13} /> CLI
          </button>
        )}
        {def.scriptable && (
          <button
            className={activeTab === 'script' ? 'tab active' : 'tab'}
            onClick={() => setTab('script')}
          >
            <Cpu size={13} /> Script
          </button>
        )}
      </div>

      {activeTab === 'config' && (
        <>
          {isHost && (
            <label className="field check-field">
              <input
                type="checkbox"
                checked={dhcpClient}
                onChange={(e) => updateDevice(node.id, { dhcpClient: e.target.checked })}
              />
              <span>Obtain an IP address automatically (DHCP)</span>
            </label>
          )}

          <div className="section-label">Interfaces</div>
          {d.interfaces.map((itf, idx) => {
            const ipOk = itf.ip === '' || isValidIp(itf.ip);
            const maskOk = isValidMask(itf.mask);
            const cidr = maskOk ? maskToCidr(itf.mask) : null;
            const locked = isHost && dhcpClient && idx === 0;
            return (
              <div className="iface" key={itf.id}>
                <div className="iface-head">
                  <span className="iface-name">
                    {itf.name}
                    {itf.type && <span className={`iface-type ${itf.type}`}>{itf.type}</span>}
                  </span>
                  <label className="iface-toggle">
                    <input
                      type="checkbox"
                      checked={itf.up}
                      onChange={(e) => patchInterface(itf.id, { up: e.target.checked })}
                    />
                    {itf.up ? 'up' : 'down'}
                  </label>
                </div>
                <div className="iface-row">
                  <input
                    className={ipOk ? '' : 'invalid'}
                    placeholder={locked ? 'assigned by DHCP' : 'IP address'}
                    value={itf.ip}
                    disabled={locked}
                    onChange={(e) => patchInterface(itf.id, { ip: e.target.value.trim() })}
                  />
                  <input
                    className={maskOk ? '' : 'invalid'}
                    placeholder="Subnet mask"
                    value={itf.mask}
                    disabled={locked}
                    onChange={(e) => patchInterface(itf.id, { mask: e.target.value.trim() })}
                  />
                </div>
                {cidr !== null && itf.ip && ipOk && (
                  <div className="iface-cidr">/{cidr}</div>
                )}
              </div>
            );
          })}

          {isHost && (
            <>
              <label className="field">
                <span>Default Gateway</span>
                <input
                  className={!d.gateway || isValidIp(d.gateway) ? '' : 'invalid'}
                  placeholder="e.g. 192.168.1.1"
                  value={d.gateway ?? ''}
                  disabled={dhcpClient}
                  onChange={(e) => setGateway(e.target.value.trim())}
                />
              </label>
              <label className="field">
                <span>DNS Server</span>
                <input
                  className={!d.dns || isValidIp(d.dns) ? '' : 'invalid'}
                  placeholder="e.g. 192.168.1.10"
                  value={d.dns ?? ''}
                  disabled={dhcpClient}
                  onChange={(e) => setDns(e.target.value.trim())}
                />
              </label>

              {dhcpClient && (
                <button className="btn primary full-btn" onClick={requestDhcp}>
                  Request IP via DHCP
                </button>
              )}

              <div className="section-label">Network tools</div>
              <div className="tool-row">
                <input
                  placeholder="hostname (e.g. www.lab.local)"
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup && runNslookup(node.id, lookup)}
                />
                <button className="mini-btn" disabled={!lookup} onClick={() => runNslookup(node.id, lookup)}>
                  nslookup
                </button>
              </div>
              <div className="tool-row">
                <input
                  placeholder="URL or IP (e.g. 192.168.1.10)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && url && runHttpGet(node.id, url)}
                />
                <button className="mini-btn" disabled={!url} onClick={() => runHttpGet(node.id, url)}>
                  HTTP GET
                </button>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'tables' && <DeviceTables node={node} />}

      {activeTab === 'services' && def.services && <ServicesPanel node={node} />}

      {activeTab === 'cli' && hasCli && <CliPanel key={node.id} node={node} />}

      {activeTab === 'script' && def.scriptable && (
        <div className="script-editor">
          <div className="section-label">IoT Script (JavaScript sandbox)</div>
          <div className="script-actions">
            {scriptRunning ? (
              <button className="btn danger" onClick={() => stopScript(node.id)}>
                <Square size={13} /> Stop
              </button>
            ) : (
              <button className="btn primary" onClick={() => runScript(node.id)}>
                <Play size={13} /> Run
              </button>
            )}
          </div>
          <textarea
            spellCheck={false}
            value={d.script ?? ''}
            onChange={(e) => setScript(e.target.value)}
          />
          <p className="script-note">
            Scripts run in a JavaScript sandbox on this device. Watch the
            console below for <code>log()</code> output. Use{' '}
            <code>onTick()</code> for repeating behaviour and <code>Stop</code>{' '}
            to halt it.
          </p>
        </div>
      )}
    </aside>
  );
}
