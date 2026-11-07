import { useGame, LocHead } from './kit';
import { LOCATIONS, locationLock, type LocationId } from '../game/unlocks';

interface Bld {
  id: LocationId;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  roof: string;
  draw: (w: number, h: number) => JSX.Element;
}

const sign = (w: number, text: string, bg: string) => (
  <g transform={`translate(${w / 2 - 60} -14)`}>
    <rect width={120} height={26} fill={bg} stroke="#000" strokeWidth={3} />
    <text x={60} y={19} textAnchor="middle" fontFamily="Bungee, Impact, sans-serif" fontSize={13} fill="#111">
      {text}
    </text>
  </g>
);

const BUILDINGS: Bld[] = [
  {
    id: 'shop', x: 330, y: 170, w: 170, h: 120, color: '#5a3a2c', roof: '#c6ff3d',
    draw: (w, h) => (
      <>
        <rect x={20} y={40} width={60} height={50} fill="#7fb3d5" stroke="#000" strokeWidth={3} />
        <rect x={100} y={50} width={44} height={h - 50} fill="#2d2d2d" stroke="#000" strokeWidth={3} />
        {sign(w, 'SKATE SHOP', '#c6ff3d')}
      </>
    ),
  },
  {
    id: 'team', x: 560, y: 150, w: 150, h: 140, color: '#2a3a4a', roof: '#3dc6ff',
    draw: (w, h) => (
      <>
        <rect x={20} y={30} width={40} height={30} fill="#ffd23d" stroke="#000" strokeWidth={2} />
        <rect x={90} y={30} width={40} height={30} fill="#ffd23d" stroke="#000" strokeWidth={2} />
        <rect x={55} y={h - 50} width={40} height={50} fill="#111" stroke="#000" strokeWidth={3} />
        {sign(w, 'TEAM HQ', '#3dc6ff')}
      </>
    ),
  },
  {
    id: 'spot', x: 90, y: 320, w: 200, h: 90, color: '#6d6d72', roof: '#8a8a90',
    draw: (w) => (
      <>
        <path d="M10 80 L80 80 L150 30 L190 30" stroke="#ddd" strokeWidth={6} fill="none" />
        <rect x={20} y={55} width={70} height={14} fill="#999" stroke="#000" strokeWidth={2} />
        <path d="M110 30 L180 30" stroke="#ffd23d" strokeWidth={4} />
        {sign(w, 'THE SPOT', '#ffd23d')}
      </>
    ),
  },
  {
    id: 'venue', x: 560, y: 340, w: 210, h: 100, color: '#3a2a4a', roof: '#ff4fa3',
    draw: (w, h) => (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <rect key={i} x={10 + i * 33} y={h - 20 - i * 6} width={30} height={20 + i * 6} fill="#555" stroke="#000" strokeWidth={2} />
        ))}
        {sign(w, 'VENUE', '#ff4fa3')}
      </>
    ),
  },
  {
    id: 'workshop', x: 120, y: 160, w: 150, h: 110, color: '#4a3a20', roof: '#ff6b1a',
    draw: (w, h) => (
      <>
        <rect x={20} y={h - 60} width={110} height={60} fill="#777" stroke="#000" strokeWidth={3} />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={20} y1={h - 60 + i * 15} x2={130} y2={h - 60 + i * 15} stroke="#555" strokeWidth={2} />
        ))}
        {sign(w, 'WORKSHOP', '#ff6b1a')}
      </>
    ),
  },
  {
    id: 'park', x: 330, y: 340, w: 200, h: 100, color: '#4d5a4d', roof: '#3dffb0',
    draw: (w, h) => (
      <>
        <path d={`M10 ${h} Q10 30 60 30 L140 30 Q190 30 190 ${h}`} fill="#b7b7b0" stroke="#000" strokeWidth={3} />
        <path d={`M40 ${h} Q40 55 70 55 L130 55 Q160 55 160 ${h}`} fill="#8a8a85" stroke="#000" strokeWidth={2} />
        {sign(w, 'SKATEPARK', '#3dffb0')}
      </>
    ),
  },
  {
    id: 'warehouse', x: 760, y: 170, w: 170, h: 120, color: '#5a4a3a', roof: '#ffd23d',
    draw: (w, h) => (
      <>
        <rect x={20} y={h - 70} width={60} height={70} fill="#888" stroke="#000" strokeWidth={3} />
        <rect x={90} y={h - 70} width={60} height={70} fill="#888" stroke="#000" strokeWidth={3} />
        {sign(w, 'WAREHOUSE', '#ffd23d')}
      </>
    ),
  },
  {
    id: 'factory', x: 790, y: 330, w: 170, h: 110, color: '#3a3a44', roof: '#9b6bff',
    draw: (w, h) => (
      <>
        <rect x={110} y={-40} width={22} height={60} fill="#555" stroke="#000" strokeWidth={3} />
        <path d={`M10 ${h} L10 40 L50 20 L50 40 L90 20 L90 40 L160 40 L160 ${h} Z`} fill="#666" stroke="#000" strokeWidth={3} />
        {sign(w, 'FACTORY', '#9b6bff')}
      </>
    ),
  },
  {
    id: 'hq', x: 420, y: 20, w: 150, h: 130, color: '#1e2a3a', roof: '#3dffb0',
    draw: (w, h) => (
      <>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={30 + (i % 3) * 32} y={15 + Math.floor(i / 3) * 28} width={24} height={18} fill="#3dc6ff" opacity={0.7} stroke="#000" strokeWidth={1.5} />
        ))}
        <rect x={60} y={h - 20} width={30} height={20} fill="#111" />
        {sign(w, 'EMPIRE HQ', '#3dffb0')}
      </>
    ),
  },
  {
    id: 'legacy', x: 30, y: 30, w: 140, h: 100, color: '#3a2a1a', roof: '#ffd23d',
    draw: (w) => (
      <>
        <path d="M40 30 L100 30 L95 60 Q70 80 45 60 Z" fill="#ffd23d" stroke="#000" strokeWidth={3} />
        <rect x={60} y={68} width={20} height={20} fill="#ffd23d" stroke="#000" strokeWidth={2} />
        {sign(w, 'HALL OF FAME', '#ffd23d')}
      </>
    ),
  },
];

const shortLock = (lock: string) => {
  const m = lock.match(/(\d)(st|nd|rd|th) Legacy/);
  if (m) return `After Legacy ${m[1]}`;
  return lock.replace(' this run', '');
};

export function District({ go }: { go: (id: LocationId) => void }) {
  const [s] = useGame();
  return (
    <div className="district">
      <LocHead title="The District" blurb="Your corner of town. Click a location to go there. Locked places show what opens them." />
      <svg viewBox="0 0 1000 470" role="group" aria-label="District map">
        <rect width={1000} height={470} fill="#2c3b2c" />
        <rect y={300} width={1000} height={30} fill="#3a3a40" />
        <rect x={300} y={0} width={24} height={470} fill="#3a3a40" />
        <rect x={530} y={0} width={24} height={470} fill="#3a3a40" />
        <path d="M0 315 H1000" stroke="#ffd23d" strokeWidth={2} strokeDasharray="18 14" />
        {Array.from({ length: 18 }).map((_, i) => (
          <circle key={i} cx={(i * 137) % 1000} cy={(i * 89) % 470} r={8 + (i % 3) * 4} fill="#3d5a3a" />
        ))}
        {BUILDINGS.map((b) => {
          const lock = locationLock(s, b.id);
          const info = LOCATIONS.find((l) => l.id === b.id)!;
          const label = lock ? `${info.name} (locked: ${lock})` : `${info.name}: ${info.blurb}`;
          return (
            <g
              key={b.id}
              className={`bld ${lock ? 'locked' : ''}`}
              transform={`translate(${b.x} ${b.y})`}
              tabIndex={0}
              role="button"
              aria-label={label}
              onClick={() => go(b.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go(b.id))}
            >
              <title>{label}</title>
              <g style={lock ? { filter: 'grayscale(0.9) brightness(0.55)' } : undefined}>
                <rect className="frame" width={b.w} height={b.h} fill={b.color} stroke="#000" strokeWidth={4} />
                <rect y={-6} width={b.w} height={10} fill={b.roof} stroke="#000" strokeWidth={3} />
                {b.draw(b.w, b.h)}
              </g>
              {lock && (
                <g transform={`translate(${b.w / 2} ${b.h / 2 + 8})`}>
                  <rect x={-b.w / 2 + 6} y={-16} width={b.w - 12} height={32} fill="#f3ead7" stroke="#000" strokeWidth={2} transform="rotate(-3)" />
                  <text textAnchor="middle" y={5} fontFamily="Permanent Marker, cursive" fontSize={11} fill="#2a2520" transform="rotate(-3)">
                    🔒 {shortLock(lock)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
