import { toPng, toJpeg, toSvg } from 'html-to-image';
import {
  getNodesBounds,
  getViewportForBounds,
  type ReactFlowInstance,
} from '@xyflow/react';

export type ExportFormat = 'png' | 'svg' | 'jpeg';
export type ExportBackground = 'dark' | 'white' | 'transparent';

export interface ExportOptions {
  format: ExportFormat;
  scale: number; // pixel ratio for raster formats (PNG/JPEG)
  background: ExportBackground;
  hideHandles: boolean;
}

const BG_COLORS: Record<ExportBackground, string | undefined> = {
  dark: '#0b1120',
  white: '#ffffff',
  transparent: undefined,
};

// Exclude connection handles (and other chrome) from the exported figure.
function makeFilter(hideHandles: boolean) {
  return (node: HTMLElement) => {
    if (!node.classList) return true;
    if (
      node.classList.contains('react-flow__controls') ||
      node.classList.contains('react-flow__minimap') ||
      node.classList.contains('react-flow__background') ||
      node.classList.contains('react-flow__attribution')
    ) {
      return false;
    }
    if (hideHandles && node.classList.contains('react-flow__handle')) return false;
    return true;
  };
}

export async function exportFigure(
  rf: ReactFlowInstance,
  opts: ExportOptions
): Promise<void> {
  const nodes = rf.getNodes();
  if (nodes.length === 0) {
    throw new Error('Nothing to export. The canvas is empty.');
  }

  const pad = 48;
  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + pad * 2);
  const height = Math.ceil(bounds.height + pad * 2);
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 4, 0.12);

  const viewportEl = document.querySelector(
    '.react-flow__viewport'
  ) as HTMLElement | null;
  if (!viewportEl) throw new Error('Canvas not found.');

  const bg = BG_COLORS[opts.background];
  const style = {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
  };
  const filter = makeFilter(opts.hideHandles);

  let dataUrl: string;
  if (opts.format === 'png') {
    dataUrl = await toPng(viewportEl, {
      width,
      height,
      style,
      backgroundColor: bg,
      pixelRatio: opts.scale,
      filter,
    });
  } else if (opts.format === 'jpeg') {
    dataUrl = await toJpeg(viewportEl, {
      width,
      height,
      style,
      backgroundColor: bg ?? '#ffffff',
      pixelRatio: opts.scale,
      quality: 0.96,
      filter,
    });
  } else {
    // SVG: resolution-independent vector output
    dataUrl = await toSvg(viewportEl, {
      width,
      height,
      style,
      backgroundColor: bg,
      filter,
    });
  }

  const ext = opts.format === 'jpeg' ? 'jpg' : opts.format;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `netweave-figure.${ext}`;
  a.click();
}
