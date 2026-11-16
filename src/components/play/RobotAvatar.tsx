import type { RobotMood } from '../../features/play/robot';
import { t } from '../../i18n';

interface RobotAvatarProps {
  mood: RobotMood;
  /** Sta parlando: la bocca si muove. */
  speaking?: boolean;
  /** Saluta con la mano (inizio partita, complimenti). */
  waving?: boolean;
  /** Cambiandolo il saluto riparte da capo. */
  waveKey?: number;
  className?: string;
}

const LINE = '#1c3a7a';
const SHELL = '#ffffff';
const BLUE = '#3b7be0';
const SCREEN = '#16234a';
const GLOW = '#5ff3ec';
const BLUSH = '#ff8fb8';
const BG = '#d7e9fb';

// Centri degli occhi (grandi) sullo schermo-faccia.
const LX = 41;
const RX = 79;
const EY = 53;

/** Occhio luminoso pieno, con riflesso. */
function Eye({ cx, cy = EY, rx = 11, ry = 13.5 }: { cx: number; cy?: number; rx?: number; ry?: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={GLOW} />
      <circle cx={cx + rx * 0.35} cy={cy - ry * 0.4} r={Math.min(rx, ry) * 0.32} fill="#fff" />
    </g>
  );
}

const browStroke = { fill: 'none', stroke: GLOW, strokeWidth: 3.6, strokeLinecap: 'round' as const };

/** Occhi e sopracciglia secondo l'umore. */
function Eyes({ mood }: { mood: RobotMood }) {
  switch (mood) {
    case 'happy':
      // occhi chiusi a mezzaluna «^ ^», sopracciglia alte
      return (
        <g>
          <g fill="none" stroke={GLOW} strokeWidth="5.5" strokeLinecap="round">
            <path d={`M${LX - 10} ${EY + 4} q10 -17 20 0`} />
            <path d={`M${RX - 10} ${EY + 4} q10 -17 20 0`} />
          </g>
          <g {...browStroke}>
            <path d={`M${LX - 9} 33 q9 -5 18 0`} />
            <path d={`M${RX - 9} 33 q9 -5 18 0`} />
          </g>
        </g>
      );
    case 'wow':
      // occhi tondi spalancati, sopracciglia altissime
      return (
        <g>
          <Eye cx={LX} rx={13} ry={14.5} />
          <Eye cx={RX} rx={13} ry={14.5} />
          <g {...browStroke}>
            <path d={`M${LX - 10} 32 q10 -7 20 0`} />
            <path d={`M${RX - 10} 32 q10 -7 20 0`} />
          </g>
        </g>
      );
    case 'thinking':
      // guarda in alto a destra, un sopracciglio alzato
      return (
        <g>
          <Eye cx={LX + 3} cy={EY - 2} rx={10} ry={12} />
          <Eye cx={RX + 3} cy={EY - 2} rx={10} ry={12} />
          <path d={`M${LX - 8} ${EY + 6} h22 v10 h-22 z`} fill={SCREEN} />
          <path d={`M${RX - 8} ${EY + 6} h22 v10 h-22 z`} fill={SCREEN} />
          <g {...browStroke}>
            <path d={`M${LX - 8} 37 h18`} />
            <path d={`M${RX - 8} 34 q9 -7 18 -2`} />
          </g>
        </g>
      );
    case 'worried':
      // occhi un po' più piccoli, sopracciglia all'insù verso il centro
      return (
        <g>
          <Eye cx={LX} cy={EY + 1} rx={10} ry={12} />
          <Eye cx={RX} cy={EY + 1} rx={10} ry={12} />
          <g {...browStroke}>
            <path d={`M${LX - 10} 38 L${LX + 9} 32`} />
            <path d={`M${RX + 10} 38 L${RX - 9} 32`} />
          </g>
        </g>
      );
    case 'sad':
      // palpebre cadenti verso l'esterno, lacrima
      return (
        <g>
          <Eye cx={LX} cy={EY + 2} rx={10.5} ry={12.5} />
          <Eye cx={RX} cy={EY + 2} rx={10.5} ry={12.5} />
          <path d={`M${LX - 14} ${EY - 14} H${LX + 14} V${EY - 8} L${LX - 14} ${EY + 2} z`} fill={SCREEN} />
          <path d={`M${RX + 14} ${EY - 14} H${RX - 14} V${EY - 8} L${RX + 14} ${EY + 2} z`} fill={SCREEN} />
          <g {...browStroke}>
            <path d={`M${LX - 10} 37 L${LX + 9} 31`} />
            <path d={`M${RX + 10} 37 L${RX - 9} 31`} />
          </g>
          <path d={`M${LX - 9} ${EY + 13} q-3.5 5.5 0 8 q3.5 -2.5 0 -8 z`} fill="#9fd8ff" />
        </g>
      );
    default:
      return (
        <g>
          <Eye cx={LX} />
          <Eye cx={RX} />
          <g {...browStroke}>
            <path d={`M${LX - 8} 35 q8 -3 16 0`} />
            <path d={`M${RX - 8} 35 q8 -3 16 0`} />
          </g>
        </g>
      );
  }
}

function Mouth({ mood, speaking }: { mood: RobotMood; speaking: boolean }) {
  if (speaking) return <ellipse className="robot-mouth-talk" cx="60" cy="76" rx="7" ry="4.5" fill={GLOW} />;
  const stroke = { fill: 'none', stroke: GLOW, strokeWidth: 3.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (mood) {
    case 'wow':
      return <ellipse cx="60" cy="77" rx="5" ry="6" fill={GLOW} />;
    case 'thinking':
      return <path d="M58 77 q4 -3 8 0 t7 -1" {...stroke} />;
    case 'worried':
      return <path d="M50 78 l4 -3 l4 3 l4 -3 l4 3 l4 -3" {...stroke} />;
    case 'sad':
      return <path d="M51 80 q9 -8 18 0" {...stroke} />;
    case 'happy':
      return (
        <g>
          <path d="M47 71 h26 q0 13 -13 13 t-13 -13 z" fill={GLOW} />
          <path d="M53 80.5 q7 -5 14 0 q-3 3.5 -7 3.5 t-7 -3.5 z" fill={BLUSH} />
        </g>
      );
    default:
      return <path d="M51 74 q9 8 18 0" {...stroke} />;
  }
}

/**
 * Benbot: robottino dalla testa grande e dalla faccia-schermo con occhi
 * enormi. Disegno piatto e semplice (contorno unico, pochi colori) così che
 * le espressioni si leggano bene anche in piccolo. Fluttua, sbatte gli occhi,
 * saluta e parla.
 */
export function RobotAvatar({ mood, speaking = false, waving = false, waveKey, className = '' }: RobotAvatarProps) {
  const cheeks = mood === 'happy' || mood === 'wow' || speaking;
  const outline = { stroke: LINE, strokeWidth: 2.6, strokeLinejoin: 'round' as const };

  return (
    <svg
      viewBox="0 0 120 150"
      role="img"
      aria-label={t.play.robot.alt(t.play.robot.moods[mood] ?? '')}
      data-mood={mood}
      data-speaking={speaking ? 'true' : 'false'}
      className={`robot ${className}`}
    >
      <circle cx="60" cy="80" r="58" fill={BG} />
      <ellipse className="robot-shadow" cx="60" cy="143" rx="22" ry="3.6" fill={LINE} opacity="0.2" />

      <g className="robot-float">
        {/* braccio sinistro, corto */}
        <g>
          <path d="M42 106 L30 117" stroke={LINE} strokeWidth="10" strokeLinecap="round" />
          <path d="M42 106 L30 117" stroke={SHELL} strokeWidth="5" strokeLinecap="round" />
          <circle cx="28" cy="119" r="5.5" fill={BLUE} {...outline} />
        </g>

        {/* braccio destro: saluta */}
        <g className={waving ? 'robot-arm robot-arm-wave' : 'robot-arm'} key={waveKey}>
          <path d="M78 106 L92 93" stroke={LINE} strokeWidth="10" strokeLinecap="round" />
          <path d="M78 106 L92 93" stroke={SHELL} strokeWidth="5" strokeLinecap="round" />
          <circle cx="94" cy="90" r="5.5" fill={BLUE} {...outline} />
        </g>

        {/* piedini */}
        <rect x="44" y="122" width="13" height="10" rx="5" fill={BLUE} {...outline} />
        <rect x="63" y="122" width="13" height="10" rx="5" fill={BLUE} {...outline} />

        {/* corpo piccolo con cuore luminoso */}
        <rect x="39" y="92" width="42" height="34" rx="15" fill={SHELL} {...outline} />
        <circle cx="60" cy="111" r="6" fill={SCREEN} />
        <path className="robot-core" d="M60 108.2 q3 -3 4.3 0 q0.6 2 -4.3 5.8 q-4.9 -3.8 -4.3 -5.8 q1.3 -3 4.3 0 z" fill={GLOW} />

        {/* antenna */}
        <path d="M60 14 V6" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" />
        <circle className="robot-antenna" cx="60" cy="4.5" r="4.5" fill="#ffc93c" {...outline} />

        {/* orecchie */}
        <rect x="2" y="44" width="12" height="22" rx="6" fill={BLUE} {...outline} />
        <rect x="106" y="44" width="12" height="22" rx="6" fill={BLUE} {...outline} />

        {/* testa grande */}
        <rect x="9" y="13" width="102" height="84" rx="36" fill={SHELL} {...outline} />
        <path d="M24 30 q4 -9 14 -12" fill="none" stroke={BG} strokeWidth="3.2" strokeLinecap="round" />

        {/* faccia-schermo */}
        <rect x="17" y="24" width="86" height="64" rx="27" fill={SCREEN} />
        <path d="M30 31 q8 -3.5 16 -3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.18" />
        {cheeks && (
          <g fill={BLUSH} opacity="0.75">
            <ellipse cx="27" cy="71" rx="5.5" ry="3" />
            <ellipse cx="93" cy="71" rx="5.5" ry="3" />
          </g>
        )}
        <g className={mood === 'thinking' ? 'robot-eyes robot-eyes-think' : 'robot-eyes'}>
          <Eyes mood={mood} />
        </g>
        <Mouth mood={mood} speaking={speaking} />

        {/* puntini «sto pensando» */}
        {mood === 'thinking' && (
          <g className="robot-dots" fill="#ffffff" stroke={LINE} strokeWidth="1.2">
            <circle cx="100" cy="11" r="2.2" />
            <circle cx="106.5" cy="6.5" r="2.8" />
            <circle cx="114.5" cy="4" r="3.4" />
          </g>
        )}
      </g>
    </svg>
  );
}
