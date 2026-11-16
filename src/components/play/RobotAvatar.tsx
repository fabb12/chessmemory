import { useId } from 'react';
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

const SHELL_EDGE = '#c4d0e3';
const BLUE_DARK = '#1c4594';
const GLOW = '#5ff3ec';
const BLUSH = '#ff9ec0';

/** Occhi secondo l'umore (dentro la visiera). */
function Eyes({ mood }: { mood: RobotMood }) {
  switch (mood) {
    case 'happy':
      return (
        <g fill="none" stroke={GLOW} strokeWidth="3.4" strokeLinecap="round">
          <path d="M42 46 q6 -8 12 0" />
          <path d="M66 46 q6 -8 12 0" />
        </g>
      );
    case 'wow':
      return (
        <g>
          <circle cx="48" cy="43" r="7" fill={GLOW} />
          <circle cx="72" cy="43" r="7" fill={GLOW} />
          <circle cx="50.5" cy="40.5" r="2.4" fill="#fff" />
          <circle cx="74.5" cy="40.5" r="2.4" fill="#fff" />
          <circle cx="46" cy="45.5" r="1.1" fill="#fff" opacity="0.8" />
          <circle cx="70" cy="45.5" r="1.1" fill="#fff" opacity="0.8" />
        </g>
      );
    case 'thinking':
      return (
        <g>
          <ellipse cx="51" cy="40" rx="4.8" ry="5.8" fill={GLOW} />
          <ellipse cx="75" cy="40" rx="4.8" ry="5.8" fill={GLOW} />
          <circle cx="52.5" cy="38" r="1.6" fill="#fff" />
          <circle cx="76.5" cy="38" r="1.6" fill="#fff" />
        </g>
      );
    case 'worried':
      return (
        <g>
          <ellipse cx="48" cy="45" rx="4.8" ry="5.4" fill={GLOW} />
          <ellipse cx="72" cy="45" rx="4.8" ry="5.4" fill={GLOW} />
          <circle cx="49.5" cy="43" r="1.5" fill="#fff" />
          <circle cx="73.5" cy="43" r="1.5" fill="#fff" />
          <g fill="none" stroke={GLOW} strokeWidth="2.4" strokeLinecap="round">
            <path d="M42 37 l9 -3" />
            <path d="M78 37 l-9 -3" />
          </g>
        </g>
      );
    case 'sad':
      return (
        <g>
          <g fill="none" stroke={GLOW} strokeWidth="3.4" strokeLinecap="round">
            <path d="M42 42 q6 7 12 0" />
            <path d="M66 42 q6 7 12 0" />
          </g>
          <path d="M44 49 q-2.6 4.2 0 6 q2.6 -1.8 0 -6 z" fill="#9fd8ff" opacity="0.95" />
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx="48" cy="44" rx="5" ry="6.4" fill={GLOW} />
          <ellipse cx="72" cy="44" rx="5" ry="6.4" fill={GLOW} />
          <circle cx="49.8" cy="41.6" r="1.8" fill="#fff" />
          <circle cx="73.8" cy="41.6" r="1.8" fill="#fff" />
        </g>
      );
  }
}

function Mouth({ mood, speaking }: { mood: RobotMood; speaking: boolean }) {
  if (speaking) return <ellipse className="robot-mouth-talk" cx="60" cy="56.5" rx="5" ry="3.2" fill={GLOW} />;
  const stroke = { fill: 'none', stroke: GLOW, strokeWidth: 2.6, strokeLinecap: 'round' as const };
  switch (mood) {
    case 'wow':
      return <ellipse cx="60" cy="57" rx="3.6" ry="4" fill={GLOW} />;
    case 'thinking':
      return <path d="M56 57 q2 -1.5 4 0 t4 0" {...stroke} />;
    case 'worried':
      return <path d="M53 57.5 q3.5 -3 7 0 t7 0" {...stroke} />;
    case 'sad':
      return <path d="M54 59.5 q6 -6 12 0" {...stroke} />;
    case 'happy':
      return <path d="M51.5 54 q8.5 9.5 17 0 z" fill={GLOW} />;
    default:
      return <path d="M54 55 q6 5.5 12 0" {...stroke} />;
  }
}

/**
 * Robi: robot bianco e blu che fluttua, sbatte gli occhi, saluta e cambia
 * espressione. Disegno vettoriale interno all'app (nessuna immagine esterna):
 * guscio lucido con riflessi, visiera di vetro, occhi luminosi e antenna.
 */
export function RobotAvatar({ mood, speaking = false, waving = false, waveKey, className = '' }: RobotAvatarProps) {
  // Id unici per gradienti e filtri: in una pagina possono esserci più Robi.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `robi-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const cheeks = mood === 'happy' || mood === 'wow' || speaking;

  return (
    <svg
      viewBox="0 0 120 150"
      role="img"
      aria-label={t.play.robot.alt(t.play.robot.moods[mood] ?? '')}
      data-mood={mood}
      data-speaking={speaking ? 'true' : 'false'}
      className={`robot ${className}`}
    >
      <defs>
        <radialGradient id={id('bg')} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#e6f3ff" />
          <stop offset="0.55" stopColor="#b5d6f5" />
          <stop offset="1" stopColor="#7fb0e6" />
        </radialGradient>
        <linearGradient id={id('shell')} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#eef3fb" />
          <stop offset="1" stopColor="#cfdaeb" />
        </linearGradient>
        <linearGradient id={id('limb')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d5dfee" />
        </linearGradient>
        <radialGradient id={id('blue')} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#6aa2ff" />
          <stop offset="0.55" stopColor="#2f6fd6" />
          <stop offset="1" stopColor="#1c4594" />
        </radialGradient>
        <linearGradient id={id('visor')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2c4f" />
          <stop offset="1" stopColor="#070d1d" />
        </linearGradient>
        <radialGradient id={id('bulb')} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#ffe78a" />
          <stop offset="1" stopColor="#ffb534" />
        </radialGradient>
        <radialGradient id={id('halo')}>
          <stop offset="0" stopColor="#ffe27a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffe27a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('coreHalo')}>
          <stop offset="0" stopColor={GLOW} stopOpacity="0.7" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
        <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#1c4594" floodOpacity="0.28" />
        </filter>
        <clipPath id={id('visorClip')}>
          <rect x="28" y="24" width="64" height="41" rx="16" />
        </clipPath>
      </defs>

      {/* sfondo: cerchio luminoso con anello e piccole stelle */}
      <circle cx="60" cy="78" r="59" fill={url('bg')} />
      <circle cx="60" cy="78" r="55.5" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.2" />
      <g fill="#ffffff" className="robot-sparkles">
        <path d="M14 66 l1.3 3 l3 1.3 l-3 1.3 l-1.3 3 l-1.3 -3 l-3 -1.3 l3 -1.3 z" opacity="0.85" />
        <path d="M106 106 l1 2.3 l2.3 1 l-2.3 1 l-1 2.3 l-1 -2.3 l-2.3 -1 l2.3 -1 z" opacity="0.75" />
        <circle cx="20" cy="112" r="1.4" opacity="0.7" />
        <circle cx="110" cy="80" r="1.2" opacity="0.7" />
      </g>
      <ellipse className="robot-shadow" cx="60" cy="143" rx="24" ry="4" fill={BLUE_DARK} opacity="0.28" />

      <g className="robot-float">
        {/* braccio sinistro (a riposo, un po' aperto) */}
        <g filter={url('soft')}>
          <path d="M41 87 L31 97" stroke={url('limb')} strokeWidth="8" strokeLinecap="round" />
          <path d="M30 99 L25 108" stroke={url('limb')} strokeWidth="7" strokeLinecap="round" />
          <circle cx="30.5" cy="98" r="4.4" fill={url('blue')} />
          <circle cx="23.5" cy="111" r="5.6" fill={url('blue')} />
          <circle cx="22" cy="109.3" r="1.6" fill="#fff" opacity="0.6" />
        </g>

        {/* braccio destro: alzato, saluta con la mano aperta */}
        <g className={waving ? 'robot-arm robot-arm-wave' : 'robot-arm'} key={waveKey} filter={url('soft')}>
          <path d="M79 87 L90 85" stroke={url('limb')} strokeWidth="8" strokeLinecap="round" />
          <path d="M92 83 L98 72" stroke={url('limb')} strokeWidth="7" strokeLinecap="round" />
          <circle cx="91" cy="84.5" r="4.4" fill={url('blue')} />
          <path d="M96.5 63.5 l-2.5 -5 M100 62 l0 -6 M103.5 63.5 l3 -5 M105 67 l5 -2" stroke={BLUE_DARK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="67" r="5.8" fill={url('blue')} />
          <circle cx="98.4" cy="65.2" r="1.7" fill="#fff" opacity="0.6" />
        </g>

        {/* gambe corte con ginocchio blu e piedi tondi */}
        <g filter={url('soft')}>
          <rect x="46" y="113" width="10" height="11" rx="4" fill={url('limb')} stroke={SHELL_EDGE} strokeWidth="0.8" />
          <rect x="64" y="113" width="10" height="11" rx="4" fill={url('limb')} stroke={SHELL_EDGE} strokeWidth="0.8" />
          <rect x="45.5" y="120.5" width="11" height="5" rx="2.5" fill={url('blue')} />
          <rect x="63.5" y="120.5" width="11" height="5" rx="2.5" fill={url('blue')} />
          <path d="M44 134 q0 -9 7 -9 t7 9 z" fill={url('shell')} stroke={SHELL_EDGE} strokeWidth="0.8" />
          <path d="M62 134 q0 -9 7 -9 t7 9 z" fill={url('shell')} stroke={SHELL_EDGE} strokeWidth="0.8" />
          <rect x="44" y="132" width="14" height="2.6" rx="1.3" fill={url('blue')} />
          <rect x="62" y="132" width="14" height="2.6" rx="1.3" fill={url('blue')} />
        </g>

        {/* collo e corpo */}
        <rect x="51" y="70" width="18" height="10" rx="4" fill={url('blue')} />
        <g filter={url('soft')}>
          <path d="M43 86 q0 -9 9 -9 h16 q9 0 9 9 v15 q0 16 -17 16 t-17 -16 z" fill={url('shell')} stroke={SHELL_EDGE} strokeWidth="1" />
        </g>
        <path d="M47 84 q2 -4 7 -4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        <circle cx="41.5" cy="87" r="6.2" fill={url('blue')} />
        <circle cx="78.5" cy="87" r="6.2" fill={url('blue')} />
        <circle cx="39.8" cy="85.2" r="1.8" fill="#fff" opacity="0.55" />
        <circle cx="76.8" cy="85.2" r="1.8" fill="#fff" opacity="0.55" />
        <path d="M45.5 106 q14.5 5 29 0" fill="none" stroke={BLUE_DARK} strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
        {/* cuore luminoso sul petto, con due spie */}
        <circle cx="60" cy="94" r="12" fill={url('coreHalo')} className="robot-core" />
        <circle cx="60" cy="94" r="7.6" fill={url('visor')} stroke={url('blue')} strokeWidth="1.6" />
        <path className="robot-core" d="M60 89.5 q4.2 4.6 4.2 7 a4.2 4.2 0 0 1 -8.4 0 q0 -2.4 4.2 -7 z" fill={GLOW} filter={url('glow')} />
        <circle cx="51" cy="103" r="1.4" fill="#ff7aa8" />
        <circle cx="69" cy="103" r="1.4" fill="#ffd25a" />

        {/* antenna con lampadina */}
        <path d="M60 11 q0 -4 3 -6" fill="none" stroke={BLUE_DARK} strokeWidth="2.2" strokeLinecap="round" />
        <circle className="robot-antenna" cx="63.5" cy="4.5" r="7" fill={url('halo')} />
        <circle cx="63.5" cy="4.5" r="3.4" fill={url('bulb')} />

        {/* testa: larga e tonda, con grandi cuffie blu e calotta blu */}
        <g filter={url('soft')}>
          <circle cx="19" cy="42" r="11.5" fill={url('blue')} />
          <circle cx="101" cy="42" r="11.5" fill={url('blue')} />
        </g>
        <circle cx="15.5" cy="42" r="6" fill={BLUE_DARK} />
        <circle cx="104.5" cy="42" r="6" fill={BLUE_DARK} />
        <circle cx="15.5" cy="42" r="2.6" fill={GLOW} className="robot-core" filter={url('glow')} />
        <circle cx="104.5" cy="42" r="2.6" fill={GLOW} className="robot-core" filter={url('glow')} />
        <path d="M13 34.5 q4 -3.5 9 -2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
        <path d="M98 32.5 q5 -1.5 9 2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
        <g filter={url('soft')}>
          <rect x="18" y="9" width="84" height="64" rx="27" fill={url('shell')} stroke={SHELL_EDGE} strokeWidth="1" />
        </g>
        <path d="M43 10 q17 -2.5 34 0 q-2 9 -17 9 t-17 -9 z" fill={url('blue')} />
        <path d="M49 11.5 q6 -1 11 -0.6" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        {/* riflesso sul guscio */}
        <path d="M25 30 q2 -13 16 -17" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.95" />

        {/* visiera di vetro */}
        <rect x="28" y="24" width="64" height="41" rx="16" fill={url('visor')} />
        <rect x="28" y="24" width="64" height="41" rx="16" fill="none" stroke="#2f6fd6" strokeOpacity="0.5" strokeWidth="1.2" />
        <g clipPath={url('visorClip')}>
          <path d="M28 24 h30 l-18 41 h-12 z" fill="#ffffff" opacity="0.06" />
          <path d="M34 30 q8 -4 18 -3" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0.28" />
          {cheeks && (
            <g fill={BLUSH} opacity="0.7">
              <ellipse cx="38" cy="54" rx="4.5" ry="2.4" />
              <ellipse cx="82" cy="54" rx="4.5" ry="2.4" />
            </g>
          )}
          <g filter={url('glow')}>
            <g className={mood === 'thinking' ? 'robot-eyes robot-eyes-think' : 'robot-eyes'}>
              <Eyes mood={mood} />
            </g>
            <Mouth mood={mood} speaking={speaking} />
          </g>
        </g>

        {/* puntini «sto pensando» */}
        {mood === 'thinking' && (
          <g className="robot-dots" fill="#ffffff" stroke={BLUE_DARK} strokeWidth="0.8">
            <circle cx="100" cy="20" r="2.6" />
            <circle cx="107" cy="13" r="3.2" />
            <circle cx="115" cy="5" r="3.8" />
          </g>
        )}
      </g>
    </svg>
  );
}
