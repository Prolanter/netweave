import { useState, useRef, useEffect } from 'react';
import {
  MousePointerClick,
  Trash2,
  Save,
  FolderOpen,
  Radio,
  Image as ImageIcon,
  Grid3x3,
  HelpCircle,
  Undo2,
  Redo2,
  LayoutTemplate,
  Waypoints,
  ShieldCheck,
  StickyNote,
  Type,
  Square,
  X,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useStore } from '../store';
import { Glossary } from './Glossary';
import { TEMPLATES } from '../data/templates';
import {
  exportFigure,
  type ExportFormat,
  type ExportBackground,
} from '../sim/exportFigure';

export function Toolbar() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const annotations = useStore((s) => s.annotations);
  const simMode = useStore((s) => s.simMode);
  const setSimMode = useStore((s) => s.setSimMode);
  const runConnectivityTest = useStore((s) => s.runConnectivityTest);
  const autoRoute = useStore((s) => s.autoRoute);
  const runValidation = useStore((s) => s.runValidation);
  const log = useStore((s) => s.log);
  const clearTopology = useStore((s) => s.clearTopology);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [showGlossary, setShowGlossary] = useState(false);

  const save = () => {
    const data = JSON.stringify({ nodes, edges, annotations }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topology.netweave.json';
    a.click();
    URL.revokeObjectURL(url);
    log('info', 'Topology exported to topology.netweave.json');
  };

  const load = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        useStore.getState().loadTopology(parsed.nodes ?? [], parsed.edges ?? []);
        useStore.setState({ annotations: parsed.annotations ?? [] });
        log('ok', `Loaded topology from ${file.name}`);
      } catch {
        log('error', 'Failed to parse topology file.');
      }
    };
    input.click();
  };

  return (
    <div className="toolbar">
      <div className="brand">
        <Radio size={18} />
        <span>NetWeave</span>
        <span className="brand-tag">network lab</span>
      </div>

      <button
        className={`btn ${simMode ? 'sim-active' : 'primary'}`}
        onClick={() => setSimMode(!simMode)}
        title="Click two hosts on the canvas to run a ping test"
      >
        <MousePointerClick size={15} />
        {simMode ? 'Exit Simulate' : 'Simulate'}
      </button>

      <button
        className="btn"
        onClick={runConnectivityTest}
        title="Ping every host pair and show a reachability grid"
      >
        <Grid3x3 size={15} /> Test All
      </button>

      <button
        className="btn"
        onClick={autoRoute}
        title="Auto-configure static routes so every subnet is reachable"
      >
        <Waypoints size={15} /> Auto-route
      </button>

      <button
        className="btn"
        onClick={runValidation}
        title="Scan the topology for configuration mistakes"
      >
        <ShieldCheck size={15} /> Check
      </button>

      <TemplatesMenu />

      <div className="toolbar-icons">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={16} />
        </button>
      </div>

      <div className="toolbar-actions">
        <button
          className="btn"
          onClick={() => setShowGlossary(true)}
          title="Networking glossary: what the terms mean"
        >
          <HelpCircle size={15} /> Help
        </button>
        {showGlossary && <Glossary onClose={() => setShowGlossary(false)} />}
        <AnnotateMenu />
        <ExportMenu />
        <button className="btn" onClick={save} title="Export topology as a file">
          <Save size={15} /> Save
        </button>
        <button className="btn" onClick={load} title="Import topology">
          <FolderOpen size={15} /> Open
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Clear the entire topology?')) clearTopology();
          }}
          title="Clear canvas"
        >
          <Trash2 size={15} /> Clear
        </button>
      </div>
    </div>
  );
}

function TemplatesMenu() {
  const loadTopology = useStore((s) => s.loadTopology);
  const log = useStore((s) => s.log);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="export-wrap" ref={ref}>
      <button
        className="btn"
        onClick={() => setOpen((v) => !v)}
        title="Load a ready-made example topology"
      >
        <LayoutTemplate size={15} /> Templates
      </button>
      {open && (
        <div className="export-pop templates-pop">
          <div className="export-head">
            <span>Example topologies</span>
          </div>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="template-item"
              onClick={() => {
                const { nodes, edges } = t.build();
                loadTopology(nodes, edges);
                log('ok', `Loaded template: ${t.name}`);
                setOpen(false);
              }}
            >
              <span className="template-name">{t.name}</span>
              <span className="template-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnotateMenu() {
  const rf = useReactFlow();
  const addAnnotation = useStore((s) => s.addAnnotation);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const center = () => {
    const el = document.querySelector('.react-flow');
    const r = el?.getBoundingClientRect();
    const cx = r ? r.x + r.width / 2 : window.innerWidth / 2;
    const cy = r ? r.y + r.height / 2 : window.innerHeight / 2;
    return rf.screenToFlowPosition({ x: cx, y: cy });
  };
  const add = (type: 'label' | 'zone') => {
    addAnnotation(type, center());
    setOpen(false);
  };

  return (
    <div className="export-wrap" ref={ref}>
      <button className="btn" onClick={() => setOpen((v) => !v)} title="Add a text label or zone box">
        <StickyNote size={15} /> Annotate
      </button>
      {open && (
        <div className="export-pop annotate-pop">
          <button className="annotate-opt" onClick={() => add('label')}>
            <Type size={14} /> Text label
          </button>
          <button className="annotate-opt" onClick={() => add('zone')}>
            <Square size={14} /> Zone box
          </button>
        </div>
      )}
    </div>
  );
}

function ExportMenu() {
  const rf = useReactFlow();
  const log = useStore((s) => s.log);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(2);
  const [background, setBackground] = useState<ExportBackground>('dark');
  const [hideHandles, setHideHandles] = useState(true);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const doExport = async () => {
    setBusy(true);
    try {
      await exportFigure(rf, { format, scale, background, hideHandles });
      log('ok', `Exported figure as ${format.toUpperCase()}.`);
      setOpen(false);
    } catch (e) {
      log('error', e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const isRaster = format !== 'svg';

  return (
    <div className="export-wrap" ref={ref}>
      <button className="btn" onClick={() => setOpen((v) => !v)} title="Export the diagram as a figure">
        <ImageIcon size={15} /> Export
      </button>
      {open && (
        <div className="export-pop">
          <div className="export-head">
            <span>Export figure</span>
            <button className="export-x" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <div className="export-field">
            <label>Format</label>
            <div className="seg">
              {(['png', 'svg', 'jpeg'] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  className={format === f ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="export-hint">
              {format === 'svg'
                ? 'Vector: infinite resolution, ideal for papers and print.'
                : format === 'png'
                ? 'Raster with transparency support.'
                : 'Raster, smaller files, no transparency.'}
            </p>
          </div>

          {isRaster && (
            <div className="export-field">
              <label>Resolution</label>
              <div className="seg">
                {[1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    className={scale === s ? 'seg-btn active' : 'seg-btn'}
                    onClick={() => setScale(s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="export-field">
            <label>Background</label>
            <div className="seg">
              {(['dark', 'white', 'transparent'] as ExportBackground[]).map((b) => (
                <button
                  key={b}
                  className={background === b ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => setBackground(b)}
                  disabled={b === 'transparent' && format === 'jpeg'}
                >
                  {b[0].toUpperCase() + b.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <label className="export-check">
            <input
              type="checkbox"
              checked={hideHandles}
              onChange={(e) => setHideHandles(e.target.checked)}
            />
            Hide connection dots (cleaner figure)
          </label>

          <button className="btn primary export-go" onClick={doExport} disabled={busy}>
            {busy ? 'Rendering…' : 'Download figure'}
          </button>
        </div>
      )}
    </div>
  );
}
