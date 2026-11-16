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

const SHELL = '#f3f6fb';
const SHELL_SHADE = '#d3dcea';
const BLUE = '#2f6fd6';
const BLUE_DARK = '#1f4fa3';
const VISOR = '#101a30';
const GLOW = '#55e6e0';
const BACKDROP = '#a9cdee';

/** Occhi secondo l'umore (dentro la visiera). */
function Eyes({ mood }: { mood: RobotMood }) {
  switch (mood) {
    case 'happy':
      return (
        <g fill="none" stroke={GLOW} strokeWidth="3.2" strokeLinecap="round">
          <path d="M43 46 q5 -7 10 0" />
          <path d="M67 46 q5 -7 10 0" />
        </g>
      );
    case 'wow':
      return (
        <g fill={GLOW}>
          <circle cx="48" cy="43" r="6.5" />
          <circle cx="72" cy="43" r="6.5" />
          <circle cx="50" cy="41" r="2" fill="#fff" />
          <circle cx="74" cy="41" r="2" fill="#fff" />
        </g>
      );
    case 'thinking':
      return (
        <g fill={GLOW}>
          <ellipse cx="51" cy="40" rx="4.5" ry="5.5" />
          <ellipse cx="75" cy="40" rx="4.5" ry="5.5" />
        </g>
      );
    case 'worried':
      return (
        <g>
          <ellipse cx="48" cy="45" rx="4.5" ry="5" fill={GLOW} />
          <ellipse cx="72" cy="45" rx="4.5" ry="5" fill={GLOW} />
          <g fill="none" stroke={GLOW} strokeWidth="2.4" strokeLinecap="round">
            <path d="M42 37 l9 -3" />
            <path d="M78 37 l-9 -3" />
          </g>
        </g>
      );
    case 'sad':
      return (
        <g fill="none" stroke={GLOW} strokeWidth="3.2" strokeLinecap="round">
          <path d="M43 42 q5 7 10 0" />
          <path d="M67 42 q5 7 10 0" />
        </g>
      );
    default:
      return (
        <g fill={GLOW}>
          <ellipse cx="48" cy="44" rx="4.8" ry="6" />
          <ellipse cx="72" cy="44" rx="4.8" ry="6" />
        </g>
      );
  }
}

function Mouth({ mood, speaking }: { mood: RobotMood; speaking: boolean }) {
  if (speaking) return <ellipse className="robot-mouth-talk" cx="60" cy="56" rx="5" ry="3.2" fill={GLOW} />;
  const stroke = { fill: 'none', stroke: GLOW, strokeWidth: 2.6, strokeLinecap: 'round' as const };
  switch (mood) {
    case 'wow':
      return <ellipse cx="60" cy="56.5" rx="3.6" ry="4" fill={GLOW} />;
    case 'thinking':
      return <path d="M56 57 h8" {...stroke} />;
    case 'worried':
      return <path d="M53 57 q3.5 -3 7 0 t7 0" {...stroke} />;
    case 'sad':
      return <path d="M54 59 q6 -6 12 0" {...stroke} />;
    case 'happy':
      return <path d="M52 54 q8 9 16 0 z" fill={GLOW} />;
    default:
      return <path d="M54 55 q6 5.5 12 0" {...stroke} />;
  }
}

/**
 * Robi: robot bianco e blu che fluttua, sbatte gli occhi, saluta e cambia
 * espressione. Disegno vettoriale interno all'app (nessuna immagine esterna).
 */
export function RobotAvatar({ mood, speaking = false, waving = false, waveKey, className = '' }: RobotAvatarProps) {
  return (
    <svg
      viewBox="0 0 120 150"
      role="img"
      aria-label={t.play.robot.alt(t.play.robot.moods[mood] ?? '')}
      data-mood={mood}
      data-speaking={speaking ? 'true' : 'false'}
      className={`robot ${className}`}
    >
      <circle cx="60" cy="78" r="59" fill={BACKDROP} />
      <ellipse className="robot-shadow" cx="60" cy="143" rx="24" ry="4" fill={BLUE_DARK} opacity="0.3" />
      <g className="robot-float">
        {/* braccio sinistro (a riposo, un po' aperto) */}
        <g>
          <path d="M41 87 L31 97" stroke={SHELL} strokeWidth="8" strokeLinecap="round" />
          <path d="M30 99 L25 108" stroke={SHELL} strokeWidth="7" strokeLinecap="round" />
          <circle cx="30.5" cy="98" r="4.2" fill={BLUE} />
          <circle cx="23.5" cy="111" r="5.2" fill={VISOR} />
        </g>

        {/* braccio destro: alzato, saluta con la mano aperta */}
        <g className={waving ? 'robot-arm robot-arm-wave' : 'robot-arm'} key={waveKey}>
          <path d="M79 87 L90 85" stroke={SHELL} strokeWidth="8" strokeLinecap="round" />
          <path d="M92 83 L98 72" stroke={SHELL} strokeWidth="7" strokeLinecap="round" />
          <circle cx="91" cy="84.5" r="4.2" fill={BLUE} />
          <circle cx="100" cy="67" r="5.4" fill={VISOR} />
          <path d="M96.5 63.5 l-2.5 -5 M100 62 l0 -6 M103.5 63.5 l3 -5 M105 67 l5 -2" stroke={VISOR} strokeWidth="2.8" strokeLinecap="round" />
        </g>

        {/* gambe corte con ginocchio blu */}
        <rect x="46" y="113" width="10" height="11" rx="4" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1" />
        <rect x="64" y="113" width="10" height="11" rx="4" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1" />
        <rect x="45.5" y="121" width="11" height="5" rx="2.5" fill={BLUE} />
        <rect x="63.5" y="121" width="11" height="5" rx="2.5" fill={BLUE} />
        <path d="M45 133 q0 -8 6 -8 t6 8 z" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1" />
        <path d="M63 133 q0 -8 6 -8 t6 8 z" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1" />

        {/* collo e corpo */}
        <rect x="51" y="70" width="18" height="10" rx="4" fill={BLUE} />
        <path d="M43 86 q0 -9 9 -9 h16 q9 0 9 9 v15 q0 16 -17 16 t-17 -16 z" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1.5" />
        <circle cx="41.5" cy="87" r="6" fill={BLUE} />
        <circle cx="78.5" cy="87" r="6" fill={BLUE} />
        <path d="M45.5 106 q14.5 5 29 0" fill="none" stroke={VISOR} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="60" cy="94" r="7" fill={VISOR} />
        <path className="robot-core" d="M60 89.5 q4.2 4.6 4.2 7 a4.2 4.2 0 0 1 -8.4 0 q0 -2.4 4.2 -7 z" fill={GLOW} />

        {/* testa: larga e tonda, con grandi cuffie blu e calotta blu */}
        <circle cx="19" cy="42" r="11.5" fill={BLUE} />
        <circle cx="101" cy="42" r="11.5" fill={BLUE} />
        <circle cx="15.5" cy="42" r="6" fill={BLUE_DARK} />
        <circle cx="104.5" cy="42" r="6" fill={BLUE_DARK} />
        <rect x="18" y="9" width="84" height="64" rx="27" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1.5" />
        <path d="M43 10 q17 -2.5 34 0 q-2 9 -17 9 t-17 -9 z" fill={BLUE} />
        <rect x="28" y="24" width="64" height="41" rx="16" fill={VISOR} />
        <g className={mood === 'thinking' ? 'robot-eyes robot-eyes-think' : 'robot-eyes'}>
          <Eyes mood={mood} />
        </g>
        <Mouth mood={mood} speaking={speaking} />

        {/* puntini «sto pensando» */}
        {mood === 'thinking' && (
          <g className="robot-dots" fill={BLUE}>
            <circle cx="100" cy="20" r="2.6" />
            <circle cx="107" cy="13" r="3.2" />
            <circle cx="115" cy="5" r="3.8" />
          </g>
        )}
      </g>
    </svg>
  );
}
