import type { ReactNode } from 'react';
import type { Node } from '@xyflow/react';
import type { DeviceData, DeviceServices, DnsRecord } from '../types';
import { useStore } from '../store';
import { DEVICE_DEFS } from '../data/deviceDefs';

export function ServicesPanel({ node }: { node: Node<DeviceData> }) {
  const updateDevice = useStore((s) => s.updateDevice);
  const def = DEVICE_DEFS[node.data.kind];
  const services = node.data.services ?? {};
  const available = def.services ?? [];

  const patch = (next: DeviceServices) =>
    updateDevice(node.id, { services: { ...services, ...next } });

  return (
    <div className="services">
      {available.includes('dhcp') && services.dhcp && (
        <ServiceBlock
          title="DHCP server"
          desc="Hands out IP addresses to DHCP clients on this network."
          enabled={services.dhcp.enabled}
          onToggle={(enabled) => patch({ dhcp: { ...services.dhcp!, enabled } })}
        >
          <div className="svc-grid">
            <Field label="Pool start" value={services.dhcp.poolStart}
              onChange={(v) => patch({ dhcp: { ...services.dhcp!, poolStart: v } })} />
            <Field label="Pool end" value={services.dhcp.poolEnd}
              onChange={(v) => patch({ dhcp: { ...services.dhcp!, poolEnd: v } })} />
            <Field label="Subnet mask" value={services.dhcp.mask}
              onChange={(v) => patch({ dhcp: { ...services.dhcp!, mask: v } })} />
            <Field label="Gateway" value={services.dhcp.gateway}
              onChange={(v) => patch({ dhcp: { ...services.dhcp!, gateway: v } })} />
            <Field label="DNS server" value={services.dhcp.dns}
              onChange={(v) => patch({ dhcp: { ...services.dhcp!, dns: v } })} />
          </div>
        </ServiceBlock>
      )}

      {available.includes('dns') && services.dns && (
        <ServiceBlock
          title="DNS server"
          desc="Resolves hostnames to IP addresses."
          enabled={services.dns.enabled}
          onToggle={(enabled) => patch({ dns: { ...services.dns!, enabled } })}
        >
          <DnsRecords
            records={services.dns.records}
            onChange={(records) => patch({ dns: { ...services.dns!, records } })}
          />
        </ServiceBlock>
      )}

      {available.includes('http') && services.http && (
        <ServiceBlock
          title="HTTP / web server"
          desc="Serves a page to clients that browse this host."
          enabled={services.http.enabled}
          onToggle={(enabled) => patch({ http: { ...services.http!, enabled } })}
        >
          <label className="field">
            <span>Page content</span>
            <textarea
              className="svc-page"
              value={services.http.page}
              spellCheck={false}
              onChange={(e) => patch({ http: { ...services.http!, page: e.target.value } })}
            />
          </label>
        </ServiceBlock>
      )}
    </div>
  );
}

function ServiceBlock({
  title,
  desc,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={`svc-block ${enabled ? 'on' : ''}`}>
      <div className="svc-head">
        <div>
          <div className="svc-title">{title}</div>
          <div className="svc-desc">{desc}</div>
        </div>
        <label className="svc-switch" title={enabled ? 'On' : 'Off'}>
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          <span className="svc-slider" />
        </label>
      </div>
      {enabled && <div className="svc-body">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="svc-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value.trim())} />
    </label>
  );
}

function DnsRecords({ records, onChange }: { records: DnsRecord[]; onChange: (r: DnsRecord[]) => void }) {
  const set = (i: number, patch: Partial<DnsRecord>) =>
    onChange(records.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...records, { name: '', ip: '' }]);
  const remove = (i: number) => onChange(records.filter((_, j) => j !== i));

  return (
    <div className="dns-records">
      <div className="dns-row dns-row-head">
        <span>Name</span>
        <span>IP address</span>
        <span />
      </div>
      {records.map((r, i) => (
        <div className="dns-row" key={i}>
          <input placeholder="www.lab.local" value={r.name} onChange={(e) => set(i, { name: e.target.value.trim() })} />
          <input placeholder="192.168.1.10" value={r.ip} onChange={(e) => set(i, { ip: e.target.value.trim() })} />
          <button className="dns-del" onClick={() => remove(i)} title="Remove record">×</button>
        </div>
      ))}
      <button className="mini-btn" onClick={add}>+ Add record</button>
    </div>
  );
}
