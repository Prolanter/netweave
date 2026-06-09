import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { useStore } from '../store';
import { CABLE_DEFS, CABLE_TYPES } from '../data/cables';
import type { CableType } from '../types';

export function DeletableEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const removeEdge = useStore((s) => s.removeEdge);
  const setCableType = useStore((s) => s.setCableType);
  const setEdgeVlan = useStore((s) => s.setEdgeVlan);
  const setEdgeTrunk = useStore((s) => s.setEdgeTrunk);
  const touchesSwitch = useStore((s) =>
    s.nodes.some((n) => (n.id === source || n.id === target) && n.data.kind === 'switch')
  );

  const cable = (data?.cable as CableType | undefined) ?? 'straight';
  const vlan = (data?.vlan as number | undefined) ?? 1;
  const trunk = !!data?.trunk;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const showTag = touchesSwitch && (trunk || vlan !== 1) && !selected;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

      {showTag && (
        <EdgeLabelRenderer>
          <div
            className={`vlan-tag${trunk ? ' trunk' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {trunk ? 'TRUNK' : `VLAN ${vlan}`}
          </div>
        </EdgeLabelRenderer>
      )}

      {selected && (
        <EdgeLabelRenderer>
          <div
            className="edge-toolbar"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <select
              className="edge-cable"
              value={cable}
              title="Cable type"
              onChange={(e) => setCableType(id, e.target.value as CableType)}
            >
              {(CABLE_TYPES.includes(cable) ? CABLE_TYPES : [cable, ...CABLE_TYPES]).map(
                (c) => (
                  <option key={c} value={c}>
                    {CABLE_DEFS[c].short}
                  </option>
                )
              )}
            </select>

            {touchesSwitch && (
              <>
                <label className="edge-trunk" title="Trunk carries all VLANs">
                  <input
                    type="checkbox"
                    checked={trunk}
                    onChange={(e) => setEdgeTrunk(id, e.target.checked)}
                  />
                  Trunk
                </label>
                {!trunk && (
                  <div className="edge-vlan" title="Access VLAN">
                    VLAN
                    <button
                      className="vlan-step"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEdgeVlan(id, Math.max(1, vlan - 1));
                      }}
                    >
                      −
                    </button>
                    <input
                      className="vlan-num"
                      type="text"
                      inputMode="numeric"
                      value={vlan}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                        setEdgeVlan(id, Number.isNaN(n) ? 1 : Math.max(1, Math.min(4094, n)));
                      }}
                    />
                    <button
                      className="vlan-step"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEdgeVlan(id, Math.min(4094, vlan + 1));
                      }}
                    >
                      +
                    </button>
                  </div>
                )}
              </>
            )}

            <button
              className="edge-del-btn"
              onClick={(e) => {
                e.stopPropagation();
                removeEdge(id);
              }}
              title="Remove this link"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
