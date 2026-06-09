import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { ConfigPanel } from './components/ConfigPanel';
import { BottomPanel } from './components/BottomPanel';
import { ConnectivityMatrix } from './components/ConnectivityMatrix';
import { HealthCheck } from './components/HealthCheck';
import { SidePanel } from './components/SidePanel';
import { useStore } from './store';
import './App.css';

function usePersisted(key: string, initial: number) {
  const [val, setVal] = useState<number>(() => {
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, String(val));
  }, [key, val]);
  return [val, setVal] as const;
}

export default function App() {
  const [paletteW, setPaletteW] = usePersisted('nw.paletteW', 240);
  const [configW, setConfigW] = usePersisted('nw.configW', 320);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        useStore.getState().undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        useStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <div className="workspace">
          <SidePanel
            side="left"
            label="Devices"
            width={paletteW}
            setWidth={setPaletteW}
            open={paletteOpen}
            setOpen={setPaletteOpen}
          >
            <Palette />
          </SidePanel>

          <div className="center">
            <Canvas />
            <BottomPanel />
          </div>

          <SidePanel
            side="right"
            label="Properties"
            width={configW}
            setWidth={setConfigW}
            open={configOpen}
            setOpen={setConfigOpen}
          >
            <ConfigPanel />
          </SidePanel>
        </div>
        <ConnectivityMatrix />
        <HealthCheck />
      </div>
    </ReactFlowProvider>
  );
}
