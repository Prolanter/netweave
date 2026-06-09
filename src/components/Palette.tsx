import type { DeviceKind } from '../types';
import { DEVICE_DEFS, PALETTE_CATEGORIES } from '../data/deviceDefs';
import { DEVICE_ICONS } from '../data/deviceIcons';

export function Palette() {
  const onDragStart = (e: React.DragEvent, kind: DeviceKind) => {
    e.dataTransfer.setData('application/netweave-device', kind);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="palette">
      <div className="panel-title">Devices</div>
      <div className="palette-hint">Drag onto the canvas</div>
      <div className="palette-list">
        {PALETTE_CATEGORIES.map(({ category, kinds }) => (
          <div key={category} className="palette-group">
            <div className="palette-group-title">{category}</div>
            {kinds.map((kind) => {
              const def = DEVICE_DEFS[kind];
              const Icon = DEVICE_ICONS[kind];
              return (
                <div
                  key={kind}
                  className="palette-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, kind)}
                  title={def.description}
                >
                  <div
                    className="palette-icon"
                    style={{ background: def.color + '22', color: def.color }}
                  >
                    <Icon size={19} strokeWidth={1.75} />
                  </div>
                  <div className="palette-label">
                    <div className="palette-name">{def.label}</div>
                    <div className="palette-desc">{def.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
