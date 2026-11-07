// Illustrated shop interior. Shelves fill in as product categories are signed.
import { memo } from 'react';
import type { ProductId } from '../game/content/products';

interface Props {
  products: Record<ProductId, number>;
  staff: number;
  displays: number;
  customers: number;
  rush: boolean;
  online: boolean;
  serveFlash: number;
}

const Deck = ({ x, y, c1, c2, r = 0 }: { x: number; y: number; c1: string; c2: string; r?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}>
    <rect x={-11} y={0} width={22} height={86} rx={11} fill={c1} stroke="#000" strokeWidth={2} />
    <path d={`M-9 30 L9 22 L9 40 L-9 48 Z`} fill={c2} opacity={0.9} />
    <circle cx={0} cy={62} r={5} fill={c2} />
  </g>
);

function ShopSceneInner({ products: p, staff, displays, customers, rush, online, serveFlash }: Props) {
  const has = (id: ProductId) => (p[id] ?? 0) > 0;
  const lv = (id: ProductId) => p[id] ?? 0;
  const custCount = Math.min(7, customers);
  return (
    <svg className="scene" viewBox="0 0 800 380" role="img" aria-label="Your skate shop. Shelves fill up as you sign new supplier contracts.">
      <defs>
        <pattern id="brick" width="40" height="20" patternUnits="userSpaceOnUse">
          <rect width="40" height="20" fill="#5a3a2c" />
          <path d="M0 0 H40 M0 10 H40 M20 0 V10 M0 10 V20 M40 10 V20" stroke="#3e271d" strokeWidth="2" />
        </pattern>
        <pattern id="floor" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill="#3b3b42" />
          <rect width="30" height="30" fill="#34343a" />
          <rect x="30" y="30" width="30" height="30" fill="#34343a" />
        </pattern>
      </defs>
      {/* back wall */}
      <rect x={0} y={0} width={800} height={270} fill="url(#brick)" />
      <rect x={0} y={270} width={800} height={110} fill="url(#floor)" />
      <rect x={0} y={262} width={800} height={10} fill="#1a1a1a" />
      {/* sign */}
      <g transform="translate(300 14) rotate(-2)">
        <rect width={200} height={40} fill="#c6ff3d" stroke="#000" strokeWidth={3} />
        <text x={100} y={28} textAnchor="middle" fontFamily="Bungee, Impact, sans-serif" fontSize={20} fill="#111">
          SKATE SHOP
        </text>
      </g>
      {/* window */}
      <g>
        <rect x={20} y={60} width={150} height={120} fill="#7fb3d5" stroke="#000" strokeWidth={4} />
        <path d="M20 150 L60 120 L95 140 L130 110 L170 140 L170 180 L20 180 Z" fill="#4c6b80" />
        <line x1={95} y1={60} x2={95} y2={180} stroke="#000" strokeWidth={3} />
        <text x={95} y={200} textAnchor="middle" fontFamily="Permanent Marker, cursive" fontSize={13} fill="#f3ead7">
          OPEN 7 DAYS
        </text>
      </g>
      {/* stickers on wall */}
      <g opacity={0.95}>
        <rect x={185} y={70} width={34} height={22} fill="#ff4fa3" stroke="#000" strokeWidth={2} transform="rotate(-8 200 80)" />
        <circle cx={240} cy={110} r={13} fill="#ffd23d" stroke="#000" strokeWidth={2} />
        <rect x={190} y={130} width={40} height={16} fill="#3dc6ff" stroke="#000" strokeWidth={2} transform="rotate(6 210 138)" />
      </g>

      {/* Bushings bin (always) */}
      <g transform="translate(205 205)">
        <rect width={70} height={50} fill="#6b4a2a" stroke="#000" strokeWidth={3} />
        {Array.from({ length: Math.min(14, 3 + Math.floor(lv('bushings') / 8)) }).map((_, i) => (
          <circle key={i} cx={10 + (i % 7) * 8.5} cy={8 - Math.floor(i / 7) * 7} r={5} fill={['#ff4fa3', '#ffd23d', '#3dc6ff', '#c6ff3d'][i % 4]} stroke="#000" strokeWidth={1.5} />
        ))}
        <text x={35} y={34} textAnchor="middle" fontFamily="Permanent Marker, cursive" fontSize={11} fill="#f3ead7">
          BUSHINGS
        </text>
      </g>
      {/* Bearings tubes */}
      {has('bearings') && (
        <g transform="translate(290 190)">
          <rect width={60} height={65} fill="#22222a" stroke="#000" strokeWidth={3} />
          {Array.from({ length: Math.min(6, 2 + Math.floor(lv('bearings') / 15)) }).map((_, i) => (
            <rect key={i} x={6 + i * 9} y={10} width={6} height={44} rx={3} fill="#3dc6ff" stroke="#000" strokeWidth={1.2} />
          ))}
        </g>
      )}
      {/* Grip tape sheets */}
      {has('grip') && (
        <g transform="translate(365 150)">
          {Array.from({ length: Math.min(5, 2 + Math.floor(lv('grip') / 20)) }).map((_, i) => (
            <rect key={i} x={i * 7} y={i * 3} width={36} height={100} fill="#111" stroke="#c6ff3d" strokeWidth={2} />
          ))}
        </g>
      )}
      {/* Wheels stacks */}
      {has('wheels') && (
        <g transform="translate(430 200)">
          {Array.from({ length: Math.min(4, 1 + Math.floor(lv('wheels') / 20)) }).map((_, col) =>
            Array.from({ length: 4 }).map((__, row) => (
              <ellipse key={`${col}-${row}`} cx={12 + col * 22} cy={48 - row * 12} rx={10} ry={6} fill={['#ffd23d', '#f3ead7', '#ff6b1a', '#3dffb0'][col % 4]} stroke="#000" strokeWidth={1.5} />
            )),
          )}
        </g>
      )}
      {/* Trucks pegboard */}
      {has('trucks') && (
        <g transform="translate(225 80)">
          <rect width={120} height={90} fill="#c8a878" stroke="#000" strokeWidth={3} />
          {Array.from({ length: Math.min(6, 2 + Math.floor(lv('trucks') / 15)) }).map((_, i) => (
            <g key={i} transform={`translate(${14 + (i % 3) * 36} ${18 + Math.floor(i / 3) * 40})`}>
              <rect x={-12} y={8} width={24} height={6} fill="#b8c0cc" stroke="#000" strokeWidth={1.5} />
              <path d="M-6 8 L0 0 L6 8 Z" fill="#8a929e" stroke="#000" strokeWidth={1.5} />
            </g>
          ))}
        </g>
      )}
      {/* Deck wall */}
      {has('decks') && (
        <g transform="translate(520 60)">
          {Array.from({ length: Math.min(8, 3 + Math.floor(lv('decks') / 12)) }).map((_, i) => (
            <Deck key={i} x={14 + i * 30} y={0} c1={['#ff6b1a', '#3dc6ff', '#ff4fa3', '#c6ff3d', '#9b6bff', '#ffd23d', '#f3ead7', '#3dffb0'][i]} c2={['#111', '#ffd23d', '#111', '#ff4fa3', '#c6ff3d', '#111', '#ff3d5a', '#111'][i]} />
          ))}
        </g>
      )}
      {/* Completes stand */}
      {has('completes') && (
        <g transform="translate(560 175)">
          <rect x={0} y={60} width={110} height={12} fill="#444" stroke="#000" strokeWidth={2} />
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${10 + i * 52} 18) rotate(-12)`}>
              <rect width={44} height={10} rx={5} fill={i ? '#9b6bff' : '#ff6b1a'} stroke="#000" strokeWidth={2} />
              <circle cx={9} cy={14} r={5} fill="#f3ead7" stroke="#000" strokeWidth={1.5} />
              <circle cx={35} cy={14} r={5} fill="#f3ead7" stroke="#000" strokeWidth={1.5} />
            </g>
          ))}
        </g>
      )}
      {/* Shoe wall */}
      {has('shoes') && (
        <g transform="translate(690 150)">
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i} transform={`translate(${(i % 2) * 48} ${Math.floor(i / 2) * 32})`} d="M0 20 L6 6 L26 8 L40 16 L42 22 L0 22 Z" fill={['#3dffb0', '#111', '#ff3d5a', '#f3ead7', '#3dc6ff', '#ffd23d'][i]} stroke="#000" strokeWidth={2} />
          ))}
        </g>
      )}
      {/* Apparel rack */}
      {has('apparel') && (
        <g transform="translate(20 225)">
          <line x1={0} y1={0} x2={150} y2={0} stroke="#999" strokeWidth={4} />
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i} transform={`translate(${6 + i * 24} 2)`} d="M0 6 L6 0 L14 0 L20 6 L17 10 L16 40 L4 40 L3 10 Z" fill={['#ff3d5a', '#111', '#c6ff3d', '#ff6b1a', '#f3ead7', '#3dc6ff'][i]} stroke="#000" strokeWidth={1.5} />
          ))}
        </g>
      )}
      {/* Display upgrades: glass case */}
      {displays > 0 && (
        <g transform="translate(20 300)">
          <rect width={120} height={50} fill="#9fd8ff" opacity={0.35} stroke="#000" strokeWidth={3} />
          <text x={60} y={30} textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize={10} fill="#f3ead7">
            DISPLAY ×{displays}
          </text>
        </g>
      )}
      {/* Online station */}
      {online && (
        <g transform="translate(150 300)">
          <rect width={60} height={40} fill="#222" stroke="#000" strokeWidth={3} />
          <rect x={6} y={5} width={48} height={24} fill="#3dc6ff" />
          <rect x={64} y={14} width={34} height={26} fill="#c8a878" stroke="#000" strokeWidth={2} />
          <text x={30} y={22} textAnchor="middle" fontSize={9} fontFamily="Bungee, sans-serif" fill="#111">
            WEB
          </text>
        </g>
      )}
      {/* Counter + register */}
      <g transform="translate(320 270)">
        <rect width={230} height={80} fill="#7a5230" stroke="#000" strokeWidth={4} />
        <rect x={0} y={0} width={230} height={14} fill="#a8743f" stroke="#000" strokeWidth={3} />
        <g transform={`translate(160 -34) ${serveFlash % 2 ? 'translate(0 -2)' : ''}`}>
          <rect width={56} height={36} fill="#333" stroke="#000" strokeWidth={3} />
          <rect x={6} y={5} width={44} height={12} fill={serveFlash % 2 ? '#c6ff3d' : '#7ec850'} />
        </g>
        <text x={80} y={52} textAnchor="middle" fontFamily="Permanent Marker, cursive" fontSize={16} fill="#f3ead7">
          PAY HERE
        </text>
      </g>
      {/* Staff behind counter */}
      {Array.from({ length: Math.min(3, staff) }).map((_, i) => (
        <g key={i} transform={`translate(${360 + i * 50} 222)`}>
          <circle cx={0} cy={0} r={14} fill={['#e8c19a', '#7a4a2e', '#c68a5a'][i]} stroke="#000" strokeWidth={2} />
          <rect x={-14} y={14} width={28} height={36} rx={6} fill={['#ff6b1a', '#3dc6ff', '#ff4fa3'][i]} stroke="#000" strokeWidth={2} />
          <rect x={-16} y={-14} width={32} height={8} fill="#111" />
        </g>
      ))}
      {/* Customers */}
      {Array.from({ length: custCount }).map((_, i) => (
        <g key={i} transform={`translate(${[600, 650, 700, 750, 250, 290, 620][i]} ${[305, 318, 305, 318, 312, 300, 340][i]})`}>
          <circle cx={0} cy={0} r={13} fill={['#f1d0b0', '#5a3420', '#c68a5a', '#e8c19a', '#9a6440', '#f4d4bc', '#4a2a18'][i]} stroke="#000" strokeWidth={2} />
          <rect x={-13} y={13} width={26} height={34} rx={6} fill={['#2d2d2d', '#ff3d5a', '#c6ff3d', '#3dc6ff', '#ffd23d', '#9b6bff', '#f3ead7'][i]} stroke="#000" strokeWidth={2} />
        </g>
      ))}
      {rush && (
        <g transform="translate(560 20) rotate(4)">
          <rect width={170} height={40} fill="#ff4fa3" stroke="#000" strokeWidth={3} />
          <text x={85} y={27} textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize={16} fill="#111">
            RUSH HOUR!
          </text>
        </g>
      )}
    </svg>
  );
}

export const ShopScene = memo(ShopSceneInner);
