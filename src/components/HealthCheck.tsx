import { X, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';

export function HealthCheck() {
  const show = useStore((s) => s.showIssues);
  const issues = useStore((s) => s.issues);
  const close = useStore((s) => s.setShowIssues);
  const select = useStore((s) => s.select);

  if (!show) return null;

  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;

  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Configuration health check</h3>
          <button className="icon-btn" onClick={() => close(false)} title="Close">
            <X size={16} />
          </button>
        </div>

        {issues.length === 0 ? (
          <div className="health-ok">
            <CheckCircle2 size={20} /> No problems found. The topology looks healthy.
          </div>
        ) : (
          <>
            <p className="modal-sub">
              {errors} error{errors === 1 ? '' : 's'}, {warnings} warning
              {warnings === 1 ? '' : 's'}. Click an item to jump to the device.
            </p>
            <ul className="issue-list">
              {issues.map((it, i) => (
                <li
                  key={i}
                  className={`issue ${it.level}${it.nodeId ? ' clickable' : ''}`}
                  onClick={() => {
                    if (it.nodeId) {
                      select(it.nodeId);
                      close(false);
                    }
                  }}
                >
                  {it.level === 'error' ? (
                    <AlertCircle size={15} className="issue-icon err" />
                  ) : (
                    <AlertTriangle size={15} className="issue-icon warn" />
                  )}
                  <span>{it.message}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
