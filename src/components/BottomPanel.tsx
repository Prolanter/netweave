import { useState, useRef, useEffect } from 'react';
import { Terminal, GraduationCap, CheckCircle2, Circle, Lightbulb, Eraser, Network } from 'lucide-react';
import { useStore } from '../store';
import { LABS } from '../data/labs';
import { checkObjective } from '../sim/labCheck';

export function BottomPanel() {
  const tab = useStore((s) => s.bottomTab);
  const setTab = useStore((s) => s.setBottomTab);
  return (
    <div className="bottom">
      <div className="bottom-tabs">
        <button
          className={tab === 'console' ? 'btab active' : 'btab'}
          onClick={() => setTab('console')}
        >
          <Terminal size={14} /> Console
        </button>
        <button
          className={tab === 'packets' ? 'btab active' : 'btab'}
          onClick={() => setTab('packets')}
        >
          <Network size={14} /> Packets
        </button>
        <button
          className={tab === 'labs' ? 'btab active' : 'btab'}
          onClick={() => setTab('labs')}
        >
          <GraduationCap size={14} /> Labs
        </button>
      </div>
      {tab === 'console' ? <ConsoleView /> : tab === 'packets' ? <PacketView /> : <LabsView />}
    </div>
  );
}

function PacketView() {
  const sim = useStore((s) => s.lastSim);

  if (!sim || !sim.hops || sim.path.length === 0) {
    return (
      <div className="packets-view empty">
        Run a ping in <strong>Simulate</strong> mode to inspect the route and packets here.
      </div>
    );
  }

  return (
    <div className="packets-view">
      <div className="pv-section-title">Traceroute</div>
      <table className="pv-table">
        <thead>
          <tr>
            <th>Hop</th>
            <th>Device</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {sim.hops.map((h) => (
            <tr key={h.ttl}>
              <td>{h.ttl}</td>
              <td>{h.name}</td>
              <td className="mono">{h.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pv-section-title">Packet inspection (per Layer-2 segment)</div>
      <div className="pv-hint">
        Notice the <strong>IP</strong> addresses stay the same end-to-end, while the
        <strong> MAC</strong> addresses are rewritten at each router hop.
      </div>
      <div className="pv-segments">
        {sim.packets?.map((p, i) => (
          <div key={i} className="pv-seg">
            <div className="pv-seg-head">
              {p.fromName} <span className="pv-arrow">→</span> {p.toName}
              {p.via.length > 0 && <span className="pv-via">{p.note}</span>}
            </div>
            <div className="pv-layers">
              <div className="pv-layer">
                <span className="pv-l3">L3</span>
                <span className="mono">{p.l3src}</span>
                <span className="pv-arrow">→</span>
                <span className="mono">{p.l3dst}</span>
              </div>
              <div className="pv-layer">
                <span className="pv-l2">L2</span>
                <span className="mono">{p.l2src}</span>
                <span className="pv-arrow">→</span>
                <span className="mono">{p.l2dst}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsoleView() {
  const lines = useStore((s) => s.console);
  const clearConsole = useStore((s) => s.clearConsole);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  return (
    <div className="console">
      <div className="console-toolbar">
        <button className="mini-btn" onClick={clearConsole}>
          <Eraser size={12} /> Clear
        </button>
      </div>
      <div className="console-body" ref={bodyRef}>
        {lines.map((l) => (
          <div key={l.id} className={`cline ${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function LabsView() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const activeLabId = useStore((s) => s.activeLabId);
  const setActiveLab = useStore((s) => s.setActiveLab);
  const [showHints, setShowHints] = useState(false);

  const lab = LABS.find((l) => l.id === activeLabId) ?? null;

  if (!lab) {
    return (
      <div className="labs">
        <div className="labs-list">
          {LABS.map((l) => (
            <button
              key={l.id}
              className="lab-card"
              onClick={() => {
                setActiveLab(l.id);
                setShowHints(false);
              }}
            >
              <div className="lab-card-head">
                <span className="lab-title">{l.title}</span>
                <span className={`lab-diff ${l.difficulty.toLowerCase()}`}>
                  {l.difficulty}
                </span>
              </div>
              <p className="lab-desc">{l.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const done = lab.objectives.filter((o) =>
    checkObjective(o.check, nodes, edges)
  ).length;
  const allDone = done === lab.objectives.length;

  return (
    <div className="labs">
      <div className="lab-detail">
        <button className="link-btn" onClick={() => setActiveLab(null)}>
          ← All labs
        </button>
        <div className="lab-detail-head">
          <h3>{lab.title}</h3>
          <span className={`lab-diff ${lab.difficulty.toLowerCase()}`}>
            {lab.difficulty}
          </span>
        </div>
        <p className="lab-desc">{lab.description}</p>

        <div className="lab-progress">
          <div className="lab-progress-bar">
            <div
              className="lab-progress-fill"
              style={{ width: `${(done / lab.objectives.length) * 100}%` }}
            />
          </div>
          <span>
            {done}/{lab.objectives.length}
          </span>
        </div>

        <ul className="objectives">
          {lab.objectives.map((o) => {
            const ok = checkObjective(o.check, nodes, edges);
            return (
              <li key={o.id} className={ok ? 'obj done' : 'obj'}>
                {ok ? (
                  <CheckCircle2 size={16} className="obj-icon ok" />
                ) : (
                  <Circle size={16} className="obj-icon" />
                )}
                <span>{o.text}</span>
              </li>
            );
          })}
        </ul>

        {allDone && (
          <div className="lab-complete">🎉 Lab complete. Nicely done!</div>
        )}

        <button className="mini-btn" onClick={() => setShowHints((v) => !v)}>
          <Lightbulb size={12} /> {showHints ? 'Hide' : 'Show'} hints
        </button>
        {showHints && (
          <ol className="hints">
            {lab.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
