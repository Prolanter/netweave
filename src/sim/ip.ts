// Minimal IPv4 helpers for the educational simulator.

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let val = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    val = (val << 8) | n;
  }
  return val >>> 0;
}

export function isValidIp(ip: string): boolean {
  return ipToInt(ip) !== null;
}

export function isValidMask(mask: string): boolean {
  const n = ipToInt(mask);
  if (n === null) return false;
  // a valid mask is a run of 1s followed by 0s
  const inverted = ~n >>> 0;
  return ((inverted + 1) & inverted) === 0;
}

export function sameSubnet(
  ipA: string,
  ipB: string,
  mask: string
): boolean {
  const a = ipToInt(ipA);
  const b = ipToInt(ipB);
  const m = ipToInt(mask);
  if (a === null || b === null || m === null) return false;
  return ((a & m) >>> 0) === ((b & m) >>> 0);
}

export function networkAddress(ip: string, mask: string): string | null {
  const a = ipToInt(ip);
  const m = ipToInt(mask);
  if (a === null || m === null) return null;
  const net = (a & m) >>> 0;
  return [
    (net >>> 24) & 255,
    (net >>> 16) & 255,
    (net >>> 8) & 255,
    net & 255,
  ].join('.');
}

export function maskToCidr(mask: string): number | null {
  const m = ipToInt(mask);
  if (m === null) return null;
  let bits = 0;
  let v = m;
  for (let i = 0; i < 32; i++) {
    if (v & 0x80000000) bits++;
    v = (v << 1) >>> 0;
  }
  return bits;
}
