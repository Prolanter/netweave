import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DeviceData } from '../types';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { DEVICE_ICONS } from '../data/deviceIcons';
import { useStore } from '../store';

function DeviceNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as DeviceData;
  const def = DEVICE_DEFS[d.kind];
  const Icon = DEVICE_ICONS[d.kind];
  const activePath = useStore((s) => s.activePath);
  const simMode = useStore((s) => s.simMode);
  const pingFrom = useStore((s) => s.pingFrom);
  const pingTo = useStore((s) => s.pingTo);
  const isActive = activePath.includes(id);
  const isSource = pingFrom === id;
  const isDest = pingTo === id;
  const primaryIp = d.interfaces.find((i) => i.ip)?.ip ?? '';

  const cls = [
    'device-node',
    selected ? 'selected' : '',
    isActive ? 'active' : '',
    isSource ? 'src' : '',
    isDest ? 'dst' : '',
    simMode && def.role === 'host' ? 'pickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} style={{ borderColor: selected ? def.color : undefined }}>
      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="target" position={Position.Top} id="tt" />
      <Handle type="target" position={Position.Right} id="rt" />
      <Handle type="target" position={Position.Bottom} id="bt" />
      <Handle type="target" position={Position.Left} id="lt" />

      {(isSource || isDest) && (
        <span className={`node-tag ${isSource ? 'src' : 'dst'}`}>
          {isSource ? 'SRC' : 'DST'}
        </span>
      )}

      <div className="device-icon" style={{ background: def.color + '22', color: def.color }}>
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <div className="device-meta">
        <div className="device-name">{d.name}</div>
        <div className="device-sub">{primaryIp ? primaryIp : def.label}</div>
      </div>
    </div>
  );
}

export const DeviceNode = memo(DeviceNodeImpl);
