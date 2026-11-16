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
      <ellipse className="robot-shadow" cx="60" cy="143" rx="26" ry="4.5" fill="currentColor" opacity="0.18" />
      <g className="robot-float">
        {/* antenna */}
        <path d="M60 14 v-8" stroke={SHELL_SHADE} strokeWidth="3" strokeLinecap="round" />
        <circle className="robot-antenna" cx="60" cy="5" r="3.6" fill={GLOW} />

        {/* braccio sinistro (a riposo) */}
        <g>
          <path d="M40 92 q-13 4 -13 17" fill="none" stroke={SHELL} strokeWidth="8" strokeLinecap="round" />
          <path d="M40 92 q-13 4 -13 17" fill="none" stroke={SHELL_SHADE} strokeWidth="8" strokeLinecap="round" opacity="0.35" />
          <circle cx="27" cy="111" r="5.5" fill={VISOR} />
        </g>

        {/* braccio destro: saluta */}
        <g key={waveKey} className={waving ? 'robot-arm robot-arm-wave' : 'robot-arm'}>
          <path d="M80 92 q14 -2 17 -15" fill="none" stroke={SHELL} strokeWidth="8" strokeLinecap="round" />
          <path d="M80 92 q14 -2 17 -15" fill="none" stroke={SHELL_SHADE} strokeWidth="8" strokeLinecap="round" opacity="0.35" />
          <circle cx="98" cy="75" r="5.5" fill={VISOR} />
          <path d="M95 71 l-2 -5 M99 70 l0 -5 M102 72 l3 -4" stroke={VISOR} strokeWidth="2.6" strokeLinecap="round" />
        </g>

        {/* gambe */}
        <rect x="45" y="118" width="11" height="13" rx="4.5" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1.2" />
        <rect x="64" y="118" width="11" height="13" rx="4.5" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1.2" />
        <rect x="45" y="127" width="11" height="5" rx="2.5" fill={BLUE} />
        <rect x="64" y="127" width="11" height="5" rx="2.5" fill={BLUE} />

        {/* corpo */}
        <path d="M41 86 q0 -8 9 -8 h20 q9 0 9 8 v20 q0 15 -19 15 t-19 -15 z" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1.5" />
        <circle cx="40" cy="89" r="6" fill={BLUE} />
        <circle cx="80" cy="89" r="6" fill={BLUE} />
        <path d="M44 109 q16 6 32 0" fill="none" stroke={VISOR} strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="97" r="6.5" fill={VISOR} />
        <circle className="robot-core" cx="60" cy="97" r="3.4" fill={GLOW} />

        {/* testa */}
        <rect x="16" y="33" width="12" height="26" rx="6" fill={BLUE} />
        <rect x="92" y="33" width="12" height="26" rx="6" fill={BLUE} />
        <rect x="19" y="38" width="5" height="16" rx="2.5" fill={BLUE_DARK} />
        <rect x="96" y="38" width="5" height="16" rx="2.5" fill={BLUE_DARK} />
        <rect x="22" y="13" width="76" height="64" rx="27" fill={SHELL} stroke={SHELL_SHADE} strokeWidth="1.5" />
        <path d="M45 14.5 h30 q-2 9 -15 9 t-15 -9 z" fill={BLUE} />
        <rect x="32" y="28" width="56" height="39" rx="15" fill={VISOR} />
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
