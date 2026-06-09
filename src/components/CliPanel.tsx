import { useState, useRef, useEffect } from 'react';
import type { Node } from '@xyflow/react';
import type { DeviceData, NetInterface, StaticRoute } from '../types';
import { useStore } from '../store';
import { execCli, cliPrompt, initialSession, type CliSession } from '../sim/cli';

export function CliPanel({ node }: { node: Node<DeviceData> }) {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const updateDevice = useStore((s) => s.updateDevice);

  const [lines, setLines] = useState<string[]>(() => [
    `Connected to ${node.data.name} console.`,
    'Type ? for a list of commands. Try: enable',
    '',
  ]);
  const [session, setSession] = useState<CliSession>(initialSession);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  const setName = (name: string) => updateDevice(node.id, { name });
  const patchIface = (ifId: string, patch: Partial<NetInterface>) => {
    const interfaces = node.data.interfaces.map((i) =>
      i.id === ifId ? { ...i, ...patch } : i
    );
    updateDevice(node.id, { interfaces });
  };
  const setRoutes = (routes: StaticRoute[]) => updateDevice(node.id, { routes });

  const submit = () => {
    const prompt = cliPrompt(node.data.name, session);
    const { lines: out, session: ns } = execCli(
      input,
      { node, nodes, edges, setName, patchIface, setRoutes },
      session
    );
    setLines((l) => [...l, `${prompt} ${input}`, ...out]);
    setSession(ns);
    if (input.trim()) setHistory((h) => [...h, input]);
    setHistIdx(-1);
    setInput('');
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) {
        const ni = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
        setHistIdx(ni);
        setInput(history[ni]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx >= 0) {
        const ni = histIdx + 1;
        if (ni >= history.length) {
          setHistIdx(-1);
          setInput('');
        } else {
          setHistIdx(ni);
          setInput(history[ni]);
        }
      }
    }
  };

  return (
    <div className="cli" onClick={() => inputRef.current?.focus()}>
      <div className="cli-body" ref={bodyRef}>
        {lines.map((l, i) => (
          <div className="cli-line" key={i}>
            {l || ' '}
          </div>
        ))}
        <div className="cli-input-row">
          <span className="cli-prompt">{cliPrompt(node.data.name, session)}</span>
          <input
            ref={inputRef}
            className="cli-input"
            value={input}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
          />
        </div>
      </div>
    </div>
  );
}
