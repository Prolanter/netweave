import { X } from 'lucide-react';
import { useStore } from '../store';

export function ConnectivityMatrix() {
  const show = useStore((s) => s.showMatrix);
  const matrix = useStore((s) => s.matrix);
  const close = useStore((s) => s.setShowMatrix);

  if (!show || !matrix) return null;

  const { hosts, cell, reachable, total } = matrix;
  const allOk = reachable === total;

  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div className="modal matrix-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Connectivity test</h3>
            <span className={`matrix-score ${allOk ? 'ok' : 'warn'}`}>
              {reachable}/{total} host pairs reachable
            </span>
          </div>
          <button className="icon-btn" onClick={() => close(false)} title="Close">
            <X size={16} />
          </button>
        </div>

        <p className="modal-sub">
          Each cell shows whether the row device can ping the column device.
        </p>

        <div className="matrix-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="corner">from \ to</th>
                {hosts.map((h) => (
                  <th key={h.id}>{h.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hosts.map((row, i) => (
                <tr key={row.id}>
                  <th className="row-head">{row.name}</th>
                  {hosts.map((col, j) => {
                    const v = cell[i][j];
                    return (
                      <td
                        key={col.id}
                        className={
                          v === null ? 'self' : v ? 'pass' : 'fail'
                        }
                        title={
                          v === null
                            ? ''
                            : `${row.name} → ${col.name}: ${v ? 'reachable' : 'unreachable'}`
                        }
                      >
                        {v === null ? '·' : v ? '✓' : '✕'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
