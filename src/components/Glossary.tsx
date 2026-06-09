import { X } from 'lucide-react';

interface Term {
  term: string;
  short: string;
  detail: string;
}

const TERMS: Term[] = [
  {
    term: 'Interface / port',
    short: 'A network port on the device.',
    detail:
      'An interface is the socket a cable plugs into. PCs usually have one; routers have several (one per network they connect). NetWeave uses Cisco-style names like FastEthernet0 or GigabitEthernet0/0, where "0/0" identifies the slot and port.',
  },
  {
    term: 'IP address',
    short: 'The device’s address on the network.',
    detail:
      'Like a postal address (e.g. 192.168.1.20). It must be unique on its network so packets can be delivered to the right device.',
  },
  {
    term: 'Subnet mask',
    short: 'Splits an IP into network + host parts.',
    detail:
      '255.255.255.0 means the first three numbers identify the network and the last identifies the host. Two devices can talk directly only if they share the same network portion.',
  },
  {
    term: 'CIDR (/24)',
    short: 'Shorthand for the subnet mask.',
    detail:
      '/24 = 255.255.255.0 (24 network bits). /16 = 255.255.0.0, /8 = 255.0.0.0. It just counts how many leading bits are the network part.',
  },
  {
    term: 'Default gateway',
    short: 'The exit door to other networks.',
    detail:
      'When a device needs to reach an IP on a different subnet, it hands the packet to its gateway, usually the router’s interface on that subnet. Without a gateway, off-network pings fail.',
  },
  {
    term: 'MAC address',
    short: 'The hardware address of an interface.',
    detail:
      'A factory-burned 48-bit ID (e.g. 02:1A:2B:3C:4D:5E). Used for delivery within a single network (Layer 2). Routers rewrite MAC addresses at each hop, while the IP addresses stay the same end-to-end.',
  },
  {
    term: 'ARP table',
    short: 'Maps IP addresses → MAC addresses.',
    detail:
      'Before a device can send a frame on the local wire, it needs the destination’s MAC. ARP (Address Resolution Protocol) discovers it and caches the IP↔MAC pair in this table.',
  },
  {
    term: 'Routing table',
    short: 'How a device decides where to send packets.',
    detail:
      'A list of known networks and how to reach each one. "C" = directly connected (an interface is on that network). "S*" = the default route, used for everything not listed (typically via the gateway).',
  },
  {
    term: 'Ping / ICMP',
    short: 'A reachability test.',
    detail:
      'Ping sends an ICMP "echo request" and waits for an "echo reply". Success means a full round-trip path exists and both ends are configured correctly.',
  },
  {
    term: 'Traceroute',
    short: 'Lists every router on the way.',
    detail:
      'Reveals the Layer-3 hops between source and destination by counting TTL. Useful for seeing exactly where a path breaks.',
  },
];

export function Glossary({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glossary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Networking glossary</h3>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        <p className="modal-sub">Plain-language definitions for the terms used in this app.</p>
        <div className="glossary-list">
          {TERMS.map((t) => (
            <div key={t.term} className="glossary-item">
              <div className="glossary-term">{t.term}</div>
              <div className="glossary-short">{t.short}</div>
              <div className="glossary-detail">{t.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
