import { useCallback, useRef, useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Map as MapIcon, Plus, Minus, Maximize2 } from 'lucide-react';
import {
  ReactFlow,
  Background,
  MiniMap,
  ViewportPortal,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store';
import { DeviceNode } from './DeviceNode';
import { DeletableEdge } from './DeletableEdge';
import { Annotations } from './Annotations';
import type { DeviceKind, CableType } from '../types';
import { DEVICE_DEFS } from '../data/deviceDefs';
import { cableStyle } from '../data/cables';

const nodeTypes: NodeTypes = { device: DeviceNode };
const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

export function Canvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [showMap, setShowMap] = useState(false);

  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const onReconnect = useStore((s) => s.onReconnect);
  const addDevice = useStore((s) => s.addDevice);
  const select = useStore((s) => s.select);
  const activePath = useStore((s) => s.activePath);
  const simMode = useStore((s) => s.simMode);
  const handleNodeClick = useStore((s) => s.handleNodeClick);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(
        'application/netweave-device'
      ) as DeviceKind;
      if (!kind || !DEVICE_DEFS[kind]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addDevice(kind, position);
    },
    [screenToFlowPosition, addDevice]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      select(params.nodes[0]?.id ?? null);
    },
    [select]
  );

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: { id: string }) => {
      if (useStore.getState().simMode) handleNodeClick(node.id);
    },
    [handleNodeClick]
  );

  const edgesStyled = edges.map((e) => {
    const active =
      activePath.includes(e.source) && activePath.includes(e.target);
    const cable = (e.data?.cable as CableType | undefined) ?? 'straight';
    return {
      ...e,
      type: 'deletable',
      animated: false,
      style: cableStyle(cable, active),
    };
  });

  return (
    <div
      className={`canvas-wrap${simMode ? ' sim-mode' : ''}`}
      ref={wrapper}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edgesStyled}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        nodesDraggable={!simMode}
        nodesConnectable={!simMode}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'deletable' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Annotations />
        {showMap && (
          <MiniMap
            position="bottom-right"
            style={{ width: 168, height: 112 }}
            nodeColor={(n) => DEVICE_DEFS[(n.data as { kind: DeviceKind }).kind]?.color ?? '#64748b'}
            maskColor="rgba(2,6,23,0.6)"
            pannable
            zoomable
          />
        )}
        <PacketLayer />
      </ReactFlow>

      <CanvasControls showMap={showMap} setShowMap={setShowMap} />
      {nodes.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty-title">Empty canvas</div>
          <div className="canvas-empty-sub">
            Drag a device from the left panel to start building your network.
          </div>
        </div>
      )}

      <SimOverlays />
    </div>
  );
}

function PacketLayer() {
  const seg = useStore((s) => s.packetSeg);
  const kind = useStore((s) => s.packetKind);
  const rf = useReactFlow();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!seg) {
      el.style.opacity = '0';
      return;
    }
    const { from, to, ms } = seg;
    const a = rf.getNode(from);
    const b = rf.getNode(to);
    if (!a || !b) return;

    const center = (n: typeof a) => ({
      x: n!.position.x + (n!.measured?.width ?? 92) / 2,
      y: n!.position.y + (n!.measured?.height ?? 54) / 2,
    });
    const pa = center(a);
    const pb = center(b);

    // Find the edge so the packet can follow the actual (bent) cable path.
    const edge = useStore
      .getState()
      .edges.find(
        (e) =>
          (e.source === from && e.target === to) ||
          (e.source === to && e.target === from)
      );
    const wireless = (edge?.data?.cable as string | undefined) === 'wireless';
    const pathEl = edge
      ? (document.querySelector(
          `.react-flow__edge[data-id="${edge.id}"] path.react-flow__edge-path`
        ) as SVGPathElement | null)
      : null;
    const forward = edge ? edge.source === from : true;
    let total = 0;
    if (pathEl && !wireless) {
      try {
        total = pathEl.getTotalLength();
      } catch {
        total = 0;
      }
    }

    el.style.opacity = '1';
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const k = Math.min(1, (t - start) / ms);
      let x: number;
      let y: number;
      if (pathEl && !wireless && total > 0) {
        const p = pathEl.getPointAtLength(forward ? k * total : (1 - k) * total);
        x = p.x;
        y = p.y;
      } else {
        x = pa.x + (pb.x - pa.x) * k;
        y = pa.y + (pb.y - pa.y) * k;
      }
      el.style.transform = `translate(${x}px, ${y}px)`;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seg, rf]);

  return (
    <ViewportPortal>
      <div ref={ref} className={`packet-dot kind-${kind}`} style={{ opacity: 0 }} />
    </ViewportPortal>
  );
}

function CanvasControls({
  showMap,
  setShowMap,
}: {
  showMap: boolean;
  setShowMap: Dispatch<SetStateAction<boolean>>;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="nav-controls">
      <button className="nav-btn" onClick={() => zoomIn({ duration: 150 })} title="Zoom in">
        <Plus size={16} />
      </button>
      <button className="nav-btn" onClick={() => zoomOut({ duration: 150 })} title="Zoom out">
        <Minus size={16} />
      </button>
      <button
        className="nav-btn"
        onClick={() => fitView({ padding: 0.2, duration: 250 })}
        title="Fit topology to view"
      >
        <Maximize2 size={15} />
      </button>
      <span className="nav-sep" />
      <button
        className={`nav-btn ${showMap ? 'active' : ''}`}
        onClick={() => setShowMap((v) => !v)}
        title={showMap ? 'Hide overview map' : 'Show overview map'}
      >
        <MapIcon size={15} />
      </button>
    </div>
  );
}

function SimOverlays() {
  const simMode = useStore((s) => s.simMode);
  const pingFrom = useStore((s) => s.pingFrom);
  const running = useStore((s) => s.running);
  const simResult = useStore((s) => s.simResult);
  const setSimResult = useStore((s) => s.setSimResult);
  const nodes = useStore((s) => s.nodes);

  const fromName = nodes.find((n) => n.id === pingFrom)?.data.name;

  return (
    <>
      {simMode && (
        <div className="sim-banner">
          <span className="sim-dot" />
          {running
            ? 'Simulating…'
            : !pingFrom
            ? 'Simulate mode: click a SOURCE host (PC, laptop, server, phone, printer, IoT).'
            : `Source ${fromName} selected. Now click a DESTINATION host.`}
        </div>
      )}

      {simResult && (
        <div className={`result-banner ${simResult.success ? 'ok' : 'fail'}`}>
          <div className="result-icon">{simResult.success ? '✓' : '✕'}</div>
          <div className="result-text">
            <strong>{simResult.success ? 'Ping successful' : 'Ping failed'}</strong>
            <span>{simResult.summary}</span>
          </div>
          <button className="result-close" onClick={() => setSimResult(null)}>
            ✕
          </button>
        </div>
      )}
    </>
  );
}
