import { useState } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import { X } from 'lucide-react';
import type { Annotation } from '../types';
import { useStore } from '../store';

const COLORS = ['#2dd4bf', '#60a5fa', '#f59e0b', '#f472b6', '#a3e635', '#e2e8f0'];

export function Annotations() {
  const annotations = useStore((s) => s.annotations);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <ViewportPortal>
      <div className="annotation-layer">
        {annotations.map((a) => (
          <AnnotationItem
            key={a.id}
            ann={a}
            selected={selected === a.id}
            editing={editing === a.id}
            onSelect={() => setSelected(a.id)}
            onDeselect={() => setSelected((s) => (s === a.id ? null : s))}
            onEdit={(v) => setEditing(v ? a.id : null)}
          />
        ))}
      </div>
    </ViewportPortal>
  );
}

function AnnotationItem({
  ann,
  selected,
  editing,
  onSelect,
  onDeselect,
  onEdit,
}: {
  ann: Annotation;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onEdit: (v: boolean) => void;
}) {
  const rf = useReactFlow();
  const update = useStore((s) => s.updateAnnotation);
  const remove = useStore((s) => s.removeAnnotation);
  const isZone = ann.type === 'zone';

  const startDrag = (e: React.MouseEvent) => {
    if (editing) return;
    e.stopPropagation();
    onSelect();
    const sx = e.clientX;
    const sy = e.clientY;
    const { x, y } = ann;
    const move = (ev: MouseEvent) => {
      const zoom = rf.getViewport().zoom || 1;
      update(ann.id, { x: x + (ev.clientX - sx) / zoom, y: y + (ev.clientY - sy) / zoom });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const { w, h } = ann;
    const move = (ev: MouseEvent) => {
      const zoom = rf.getViewport().zoom || 1;
      update(ann.id, {
        w: Math.max(80, w + (ev.clientX - sx) / zoom),
        h: Math.max(48, h + (ev.clientY - sy) / zoom),
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    transform: `translate(${ann.x}px, ${ann.y}px)`,
  };

  return (
    <div
      className={`annotation ${ann.type}${selected ? ' selected' : ''}`}
      style={
        isZone
          ? {
              ...baseStyle,
              width: ann.w,
              height: ann.h,
              borderColor: ann.color,
              background: `${ann.color}14`,
            }
          : baseStyle
      }
      onMouseDown={startDrag}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit(true);
      }}
    >
      {editing ? (
        <input
          className="annotation-input"
          autoFocus
          value={ann.text}
          style={isZone ? undefined : { color: ann.color }}
          onChange={(e) => update(ann.id, { text: e.target.value })}
          onBlur={() => onEdit(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEdit(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : isZone ? (
        <span className="zone-title" style={{ color: ann.color }}>
          {ann.text}
        </span>
      ) : (
        <span className="label-text" style={{ color: ann.color }}>
          {ann.text}
        </span>
      )}

      {selected && (
        <>
          <div className="annotation-toolbar" onMouseDown={(e) => e.stopPropagation()}>
            <div className="annotation-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className="color-dot"
                  style={{ background: c }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    update(ann.id, { color: c });
                  }}
                />
              ))}
            </div>
            <button
              className="annotation-del"
              title="Delete annotation"
              onMouseDown={(e) => {
                e.stopPropagation();
                remove(ann.id);
                onDeselect();
              }}
            >
              <X size={12} />
            </button>
          </div>
          {isZone && <div className="annotation-resize" onMouseDown={startResize} />}
        </>
      )}
    </div>
  );
}
