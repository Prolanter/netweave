import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  side: 'left' | 'right';
  width: number;
  setWidth: (w: number) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  label: string;
  min?: number;
  max?: number;
  children: ReactNode;
}

export function SidePanel({
  side,
  width,
  setWidth,
  open,
  setOpen,
  label,
  min = 180,
  max = 520,
  children,
}: Props) {
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current;
      const delta = side === 'left' ? dx : -dx;
      setWidth(Math.min(max, Math.max(min, startW.current + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  if (!open) {
    return (
      <button
        className={`side-reopen ${side}`}
        onClick={() => setOpen(true)}
        title={`Show ${label}`}
      >
        {side === 'left' ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        <span className="side-reopen-label">{label}</span>
      </button>
    );
  }

  const resizer = (
    <div
      className="side-resizer"
      onMouseDown={onMouseDown}
      title="Drag to resize"
    />
  );

  return (
    <>
      {side === 'right' && resizer}
      <div className="side-host" style={{ width }}>
        <button
          className={`side-collapse ${side}`}
          onClick={() => setOpen(false)}
          title={`Minimize ${label}`}
        >
          {side === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
        {children}
      </div>
      {side === 'left' && resizer}
    </>
  );
}
