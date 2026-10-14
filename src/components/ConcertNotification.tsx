import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, GripHorizontal, Trees, Shield, Star } from 'lucide-react';
import type { EnsembleSession, WidgetPosition, ConcertMotionTheme, ConcertBgStyle } from '../types.js';
import { useDraggable } from '../hooks/useDraggable.js';

interface ConcertNotificationProps {
  activeNotice: EnsembleSession | null;
  position: WidgetPosition;
  onPositionChange: (pos: WidgetPosition) => void;
  isLocked: boolean;
  isClickThrough: boolean;
  motionTheme?: ConcertMotionTheme;
  bgStyle?: ConcertBgStyle;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  scale?: number;
}

/* =========================================================================
   1. [세계수의 덩굴] 자라나는 바텀라인 & 잎사귀/꽃봉오리 SVG 컴포넌트 (와이드 680px 대응)
   ========================================================================= */
const VineBottomDecoration: React.FC = () => {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '680px',
        height: '44px',
        marginTop: '6px',
        overflow: 'visible',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <svg
        viewBox="0 0 680 44"
        style={{
          width: '100%',
          height: '44px',
          overflow: 'visible',
        }}
      >
        <defs>
          <linearGradient id="vineGradLeft" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vineGradRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
          <filter id="vineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 좌측 메인 덩굴 줄기 (중앙에서 좌측 끝으로 자라남) */}
        <motion.path
          d="M 340 22 C 285 22, 245 7, 180 14 C 130 20, 80 5, 25 18 C 12 21, 5 26, 0 30"
          fill="none"
          stroke="url(#vineGradLeft)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#vineGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* 우측 메인 덩굴 줄기 (중앙에서 우측 끝으로 자라남) */}
        <motion.path
          d="M 340 22 C 395 22, 435 7, 500 14 C 550 20, 600 5, 655 18 C 668 21, 675 26, 680 30"
          fill="none"
          stroke="url(#vineGradRight)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#vineGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* 좌측 잔가지 1 */}
        <motion.path
          d="M 230 12 C 210 3, 185 2, 168 9"
          fill="none"
          stroke="#34d399"
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        />
        {/* 좌측 잔가지 2 */}
        <motion.path
          d="M 115 16 C 95 6, 70 8, 52 16"
          fill="none"
          stroke="#10b981"
          strokeWidth="1.4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 0.7 }}
        />

        {/* 우측 잔가지 1 */}
        <motion.path
          d="M 450 12 C 470 3, 495 2, 512 9"
          fill="none"
          stroke="#34d399"
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        />
        {/* 우측 잔가지 2 */}
        <motion.path
          d="M 565 16 C 585 6, 610 8, 628 16"
          fill="none"
          stroke="#10b981"
          strokeWidth="1.4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 0.7 }}
        />

        {/* 좌측 잎사귀들 */}
        <motion.path
          d="M 250 13 Q 242 4 233 8 Q 237 16 250 13 Z"
          fill="#34d399"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 0.95 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        />
        <motion.path
          d="M 175 7 Q 166 0 157 4 Q 161 12 175 7 Z"
          fill="#6ee7b7"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 0.95 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        />
        <motion.path
          d="M 85 11 Q 78 3 69 7 Q 73 15 85 11 Z"
          fill="#34d399"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 0.9 }}
          transition={{ delay: 0.75, duration: 0.5 }}
        />

        {/* 우측 잎사귀들 */}
        <motion.path
          d="M 430 13 Q 438 4 447 8 Q 443 16 430 13 Z"
          fill="#34d399"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 0.95 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        />
        <motion.path
          d="M 505 7 Q 514 0 523 4 Q 519 12 505 7 Z"
          fill="#6ee7b7"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 0.95 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        />
        <motion.path
          d="M 595 11 Q 602 3 611 7 Q 607 15 595 11 Z"
          fill="#34d399"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 0.9 }}
          transition={{ delay: 0.75, duration: 0.5 }}
        />

        {/* 중앙 엘프 골드 꽃봉오리 코어 */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6, type: 'spring' }}
        >
          <circle cx="340" cy="22" r="5.5" fill="#fde047" filter="url(#vineGlow)" />
          <circle cx="340" cy="22" r="2.8" fill="#ffffff" />
          <motion.circle
            cx="340"
            cy="22"
            r="10"
            fill="none"
            stroke="#fde047"
            strokeWidth="1.2"
            animate={{ scale: [1, 1.45, 1], opacity: [0.8, 0.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.g>
      </svg>
    </div>
  );
};

/* =========================================================================
   2. [아케인 룬 서클] 웅장한 440px 듀얼 회전 마법진 SVG 컴포넌트
   ========================================================================= */
const ArcaneMagicCircle: React.FC = () => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '460px',
        height: '460px',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.75,
      }}
    >
      <svg
        viewBox="0 0 460 460"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        <defs>
          <filter id="arcaneGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 외륜 (시계방향 회전) */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '230px', originY: '230px' }}
        >
          <circle
            cx="230"
            cy="230"
            r="205"
            fill="none"
            stroke="rgba(192, 132, 252, 0.45)"
            strokeWidth="1.5"
            strokeDasharray="5 9"
          />
          <circle
            cx="230"
            cy="230"
            r="190"
            fill="none"
            stroke="rgba(56, 189, 248, 0.35)"
            strokeWidth="1"
          />
          {/* 12방위 룬 노드 */}
          {Array.from({ length: 12 }).map((_, idx) => {
            const angle = (idx * 30 * Math.PI) / 180;
            const x = 230 + 198 * Math.cos(angle);
            const y = 230 + 198 * Math.sin(angle);
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="3.5"
                fill={idx % 3 === 0 ? '#38bdf8' : '#c084fc'}
                opacity={0.85}
              />
            );
          })}
        </motion.g>

        {/* 내륜 (반시계방향 회전 옥타그램) */}
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '230px', originY: '230px' }}
        >
          <circle
            cx="230"
            cy="230"
            r="145"
            fill="none"
            stroke="rgba(192, 132, 252, 0.5)"
            strokeWidth="1.5"
          />
          {/* 정사각형 1 */}
          <rect
            x="135"
            y="135"
            width="190"
            height="190"
            fill="none"
            stroke="rgba(56, 189, 248, 0.35)"
            strokeWidth="1"
          />
          {/* 정사각형 2 (45도 회전) */}
          <rect
            x="135"
            y="135"
            width="190"
            height="190"
            fill="none"
            stroke="rgba(192, 132, 252, 0.35)"
            strokeWidth="1"
            transform="rotate(45 230 230)"
          />
        </motion.g>

        {/* 중앙 아케인 펄스 코어 */}
        <motion.circle
          cx="230"
          cy="230"
          r="55"
          fill="radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(192, 132, 252, 0.12) 60%, transparent 100%)"
          stroke="rgba(56, 189, 248, 0.55)"
          strokeWidth="1.2"
          filter="url(#arcaneGlow)"
          animate={{ scale: [0.92, 1.1, 0.92], opacity: [0.55, 0.95, 0.55] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '230px', originY: '230px' }}
        />
      </svg>
    </div>
  );
};

/* =========================================================================
   3. [별빛 오로라 프리즘] 크리스탈 스타 파티클 & 디바이더
   ========================================================================= */
const AuroraStar: React.FC<{
  size: number;
  color: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  delay: number;
}> = ({ size, color, top, left, right, bottom, delay }) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top,
        left,
        right,
        bottom,
        width: `${size}px`,
        height: `${size}px`,
        pointerEvents: 'none',
        zIndex: 5,
      }}
      animate={{
        scale: [0.6, 1.35, 0.6],
        opacity: [0.35, 1, 0.35],
        rotate: [0, 45, 0],
      }}
      transition={{
        duration: 2.8,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path
          d="M 12 0 Q 12 12 0 12 Q 12 12 12 24 Q 12 12 24 12 Q 12 12 12 0 Z"
          fill={color}
        />
      </svg>
    </motion.div>
  );
};

const AuroraPrismDivider: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        width: '100%',
        maxWidth: '460px',
        margin: '4px 0',
      }}
    >
      <div
        style={{
          flex: 1,
          height: '1.5px',
          background: 'linear-gradient(90deg, transparent, #a78bfa, #38bdf8)',
        }}
      />
      <div
        style={{
          width: '9px',
          height: '9px',
          transform: 'rotate(45deg)',
          background: '#fde047',
          boxShadow: '0 0 9px #fde047',
        }}
      />
      <div
        style={{
          flex: 1,
          height: '1.5px',
          background: 'linear-gradient(90deg, #38bdf8, #ec4899, transparent)',
        }}
      />
    </div>
  );
};

/* =========================================================================
   5~6. 배경 없는(알파) 테마: 제목 하단 장식선이 펼쳐지거나(오너먼트) 가지처럼 자라남
   - 좌측 절반만 그리고 우측은 좌우 반전으로 대칭 처리
   ========================================================================= */
const drawIn = (delay: number, duration = 0.9) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { delay, duration, ease: 'easeInOut' as const },
});

const popIn = (delay: number, origin = 'center') => ({
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as const },
  style: { transformBox: 'fill-box' as const, transformOrigin: origin },
});

const Mirrored: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <g>{children}</g>
    <g transform="translate(600 0) scale(-1 1)">{children}</g>
  </>
);

const LEAF_D = 'M0 0 C5 -6 14 -6 19 0 C14 6 5 6 0 0 Z';

// 빈티지 오너먼트 디바이더: 중앙 다이아몬드 → 좌우로 선과 소용돌이 장식이 펼쳐짐
const OrnamentUnfoldDivider: React.FC = () => {
  const c = '#ecdcae';
  const line = { fill: 'none', stroke: c, strokeWidth: 1.6, strokeLinecap: 'round' as const };
  return (
    <svg
      viewBox="0 0 600 60"
      style={{
        width: '100%',
        maxWidth: '600px',
        height: '60px',
        overflow: 'visible',
        filter: 'drop-shadow(0 0 6px rgba(236,220,174,0.55)) drop-shadow(0 1px 2px rgba(0,0,0,0.9))',
      }}
    >
      <Mirrored>
        {/* 메인 라인: 중앙에서 바깥으로 */}
        <motion.path d="M284 30 H130" {...line} {...drawIn(0.35, 0.7)} />
        <motion.path d="M130 30 C95 30 70 33 30 30" {...line} strokeWidth={1} {...drawIn(0.95, 0.6)} />
        {/* 끝단 말림 */}
        <motion.path d="M130 30 C112 30 104 18 112 12 C120 6 130 14 124 21 C119 26 112 22 115 17" {...line} {...drawIn(0.95, 0.7)} />
        {/* 안쪽 위/아래 소용돌이 */}
        <motion.path d="M268 30 C256 14 236 12 229 21 C223 29 233 36 240 30" {...line} strokeWidth={1.3} {...drawIn(0.6, 0.7)} />
        <motion.path d="M248 30 C238 45 216 47 210 38 C205 31 214 25 219 32" {...line} strokeWidth={1.3} {...drawIn(0.75, 0.7)} />
        {/* 잎 모양 스웨시 */}
        <motion.path d="M200 30 C190 20 172 18 164 24 C176 26 188 28 200 30" {...line} fill={c} fillOpacity={0.35} strokeWidth={1} {...drawIn(0.85, 0.6)} />
        {/* 점 장식 */}
        <motion.circle cx={22} cy={30} r={1.8} fill={c} {...popIn(1.45)} />
        <motion.circle cx={12} cy={30} r={1.2} fill={c} {...popIn(1.55)} />
      </Mirrored>
      {/* 중앙 다이아몬드 */}
      <motion.path d="M300 20 L310 30 L300 40 L290 30 Z" fill="none" stroke={c} strokeWidth={1.6} {...popIn(0.1)} />
      <motion.path d="M300 25 L305 30 L300 35 L295 30 Z" fill={c} {...popIn(0.25)} />
    </svg>
  );
};

const Leaf: React.FC<{ x: number; y: number; r: number; delay: number; color: string }> = ({ x, y, r, delay, color }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}>
    <motion.path d={LEAF_D} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={0.6} {...popIn(delay, '0% 50%')} />
  </g>
);

// 자라나는 가지: 중앙 새싹 → 줄기가 좌우로 자라며 곁가지·잎·꽃봉오리가 순서대로 돋아남
const BranchGrowDivider: React.FC = () => {
  const bark = '#efe4c6';
  const leaf = '#b7e4b0';
  const bud = '#fde7ef';
  const stem = { fill: 'none', stroke: bark, strokeLinecap: 'round' as const };
  return (
    <svg
      viewBox="0 0 600 70"
      style={{
        width: '100%',
        maxWidth: '600px',
        height: '70px',
        overflow: 'visible',
        filter: 'drop-shadow(0 0 5px rgba(183,228,176,0.45)) drop-shadow(0 1px 2px rgba(0,0,0,0.9))',
      }}
    >
      <Mirrored>
        {/* 주 줄기: 중앙의 굵은 줄기 → 바깥의 가는 끝 */}
        <motion.path d="M296 26 C262 30 232 38 196 36" {...stem} strokeWidth={2.6} {...drawIn(0.3, 0.6)} />
        <motion.path d="M196 36 C160 34 128 24 92 28" {...stem} strokeWidth={1.9} {...drawIn(0.85, 0.6)} />
        <motion.path d="M92 28 C70 30 50 38 24 34" {...stem} strokeWidth={1.2} {...drawIn(1.35, 0.55)} />
        {/* 곁가지 */}
        <motion.path d="M236 36 C230 48 220 54 208 55" {...stem} strokeWidth={1.3} {...drawIn(0.7, 0.45)} />
        <motion.path d="M150 30 C144 18 134 12 122 12" {...stem} strokeWidth={1.2} {...drawIn(1.15, 0.45)} />
        <motion.path d="M70 31 C64 42 54 47 44 47" {...stem} strokeWidth={1} {...drawIn(1.6, 0.4)} />
        {/* 잎사귀 */}
        <Leaf x={262} y={30} r={-150} delay={0.65} color={leaf} />
        <Leaf x={208} y={55} r={170} delay={1.1} color={leaf} />
        <Leaf x={178} y={35} r={30} delay={1.15} color={leaf} />
        <Leaf x={122} y={12} r={-170} delay={1.55} color={leaf} />
        <Leaf x={104} y={27} r={-140} delay={1.6} color={leaf} />
        <Leaf x={44} y={47} r={165} delay={1.95} color={leaf} />
        {/* 꽃봉오리 */}
        <motion.circle cx={24} cy={34} r={2.6} fill={bud} {...popIn(1.9)} />
        <motion.circle cx={122} cy={12} r={1.8} fill={bud} {...popIn(1.6)} />
      </Mirrored>
      {/* 중앙 새싹 */}
      <motion.path d="M300 28 V10" {...stem} strokeWidth={2} {...drawIn(0, 0.35)} />
      <Leaf x={300} y={12} r={-35} delay={0.3} color={leaf} />
      <Leaf x={300} y={12} r={-145} delay={0.4} color={leaf} />
      <motion.circle cx={300} cy={28} r={3.2} fill={bark} {...popIn(0)} />
    </svg>
  );
};

// 배경 없는 테마 본체: 흰색 제목 + 하단 장식
const BareConcertTitle: React.FC<{ theme: 'ornamentUnfold' | 'branchGrow'; title: string }> = ({ theme, title }) => {
  const isOrnament = theme === 'ornamentUnfold';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '8px 24px',
        minHeight: '136px',
      }}
    >
      <motion.div
        initial={isOrnament ? { opacity: 0, letterSpacing: '6px' } : { opacity: 0, y: 12, filter: 'blur(6px)' }}
        animate={isOrnament ? { opacity: 1, letterSpacing: '0.5px' } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: isOrnament ? 0.4 : 0.9, duration: 0.9, ease: 'easeOut' }}
        style={{
          fontFamily: isOrnament ? "'Cinzel', 'Nanum Myeongjo', serif" : "'Nanum Myeongjo', 'Cinzel', serif",
          fontSize: '32px',
          fontWeight: 800,
          color: '#ffffff',
          lineHeight: 1.25,
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: '100%',
          // 알파 배경 위 가독성: 짙은 외곽 그림자 겹침
          textShadow: '0 0 2px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.7)',
        }}
      >
        {title}
      </motion.div>
      {isOrnament ? <OrnamentUnfoldDivider /> : <BranchGrowDivider />}
    </div>
  );
};

/* =========================================================================
   7. [진주꽃 개화] 레퍼런스: 진주빛 꽃 장식 타이틀 (알파 배경)
   - 중앙 섬광 → 꽃잎 5장이 차례로 피어남 → 소용돌이·잎·방울꽃이 좌우로 번짐
   - 양끝 창 라인이 뻗어 나가 푸른 별이 점화 → 제목이 중앙에서 바깥으로 한 글자씩 피어남
   - 이후 제목 위를 빛줄기가 주기적으로 훑고, 별·방울꽃·펜던트가 은은하게 반짝이며 흔들림
   ========================================================================= */
const PEARL = '#fbf6ea';
const PEARL_EDGE = 'rgba(214, 186, 128, 0.9)';
const STAR_BLUE = '#7aa7ff';

// 4갈래 반짝이 별 (중심 0,0)
const starD = (r: number) => {
  const w = r * 0.18;
  return `M0 ${-r} Q${w} ${-w} ${r} 0 Q${w} ${w} 0 ${r} Q${-w} ${w} ${-r} 0 Q${-w} ${-w} 0 ${-r} Z`;
};

const loop = (duration: number, delay: number) => ({
  duration,
  delay,
  repeat: Infinity,
  ease: 'easeInOut' as const,
});

const PearlStar: React.FC<{ x: number; y: number; r: number; delay: number }> = ({ x, y, r, delay }) => (
  <g transform={`translate(${x} ${y})`}>
    <motion.g {...popIn(delay)}>
      <motion.g
        animate={{ scale: [1, 1.22, 1], rotate: [0, 12, 0], opacity: [1, 0.75, 1] }}
        transition={loop(2.6, delay + 0.4)}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        <path d={starD(r)} fill="url(#pbStarGrad)" stroke={PEARL} strokeWidth={0.6} />
        <path d={starD(r * 0.45)} fill="#ffffff" />
      </motion.g>
    </motion.g>
  </g>
);

const PearlLeaf: React.FC<{ x: number; y: number; r: number; s?: number; delay: number }> = ({ x, y, r, s = 1, delay }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s * 1.3})`}>
    <motion.path d={LEAF_D} fill="url(#pbLeafGrad)" stroke={PEARL_EDGE} strokeWidth={0.5} {...popIn(delay, '0% 50%')} />
    <motion.path d="M1 0 H16" stroke={PEARL_EDGE} strokeWidth={0.4} fill="none" {...drawIn(delay + 0.1, 0.3)} />
  </g>
);

// 은방울꽃: 줄기 끝에 매달려 살랑임
const PearlBell: React.FC<{ x: number; y: number; delay: number }> = ({ x, y, delay }) => (
  <g transform={`translate(${x} ${y})`}>
    <motion.g {...popIn(delay, '50% 0%')}>
      <motion.g
        animate={{ rotate: [-9, 9, -9] }}
        transition={loop(2.4, delay)}
        style={{ transformBox: 'fill-box', transformOrigin: '50% 0%' }}
      >
        <path d="M0 0 V3" stroke={PEARL_EDGE} strokeWidth={0.6} />
        <path d="M-4 9 C-4 2 4 2 4 9 L5 11 L2 10 L0 12 L-2 10 L-5 11 Z" fill={PEARL} stroke={PEARL_EDGE} strokeWidth={0.5} />
      </motion.g>
    </motion.g>
  </g>
);

// 매달린 별 펜던트: 떨어지듯 등장 후 흔들림
const PearlPendant: React.FC<{ x: number; y: number; len: number; delay: number }> = ({ x, y, len, delay }) => (
  <g transform={`translate(${x} ${y})`}>
    <motion.g
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 9 }}
    >
      <motion.g
        animate={{ rotate: [-6, 6, -6] }}
        transition={loop(3, delay + 0.5)}
        style={{ transformBox: 'fill-box', transformOrigin: '50% 0%' }}
      >
        <path d={`M0 0 V${len}`} stroke={PEARL_EDGE} strokeWidth={0.6} />
        <circle cx={0} cy={len * 0.45} r={1.3} fill={PEARL} />
        <g transform={`translate(0 ${len + 5})`}>
          <path d={starD(5)} fill="url(#pbStarGrad)" stroke={PEARL} strokeWidth={0.4} />
        </g>
      </motion.g>
    </motion.g>
  </g>
);

const PearlBlossomDivider: React.FC = () => {
  const line = { fill: 'none', stroke: PEARL, strokeLinecap: 'round' as const };
  const edge = { fill: 'none', stroke: PEARL_EDGE, strokeLinecap: 'round' as const };
  return (
    <svg
      viewBox="0 0 600 120"
      style={{
        width: '100%',
        maxWidth: '660px',
        height: '132px',
        marginTop: '-14px',
        overflow: 'visible',
        filter:
          'drop-shadow(0 0 5px rgba(255, 246, 225, 0.75)) drop-shadow(0 0 14px rgba(160, 190, 255, 0.4)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))',
      }}
    >
      <defs>
        <radialGradient id="pbStarGrad">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#bcd3ff" />
          <stop offset="100%" stopColor={STAR_BLUE} />
        </radialGradient>
        <linearGradient id="pbLeafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#efe8f7" />
          <stop offset="100%" stopColor="#c9d8fb" />
        </linearGradient>
        <radialGradient id="pbPetalGrad" cx="50%" cy="100%" r="100%">
          <stop offset="0%" stopColor="#fff4dc" />
          <stop offset="70%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1ead9" />
        </radialGradient>
        <radialGradient id="pbHalo">
          <stop offset="0%" stopColor="#fff8e6" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#fff8e6" stopOpacity={0} />
        </radialGradient>
      </defs>

      <Mirrored>
        {/* 창 라인: 꽃 아래에서 양끝으로 뻗어 나감 (이중선) */}
        <motion.path d="M262 60 H26" {...line} strokeWidth={1.6} {...drawIn(0.95, 0.65)} />
        <motion.path d="M246 64 H60" {...edge} strokeWidth={0.6} {...drawIn(1.05, 0.6)} />
        <motion.path d="M60 60 L54 56 L48 60 L54 64 Z" fill={PEARL} {...popIn(1.45)} />

        {/* 소용돌이 덩굴 */}
        <motion.path d="M270 70 C250 84 226 82 216 70 C206 58 190 52 176 60 C164 67 168 80 180 78" {...line} strokeWidth={1.5} {...drawIn(0.6, 0.7)} />
        <motion.path d="M264 46 C246 30 224 32 218 42 C214 50 222 56 228 50" {...line} strokeWidth={1.3} {...drawIn(0.65, 0.6)} />
        <motion.path d="M216 70 C190 90 150 88 128 74 C116 66 106 68 96 72" {...edge} strokeWidth={1} {...drawIn(0.9, 0.7)} />
        <motion.path d="M218 42 C196 36 176 40 160 50" {...edge} strokeWidth={0.8} {...drawIn(0.85, 0.5)} />

        {/* 잎사귀 */}
        <PearlLeaf x={246} y={80} r={165} s={1.1} delay={0.85} />
        <PearlLeaf x={232} y={36} r={-160} s={1} delay={0.9} />
        <PearlLeaf x={200} y={56} r={-150} s={1.15} delay={1} />
        <PearlLeaf x={176} y={78} r={170} s={1} delay={1.05} />
        <PearlLeaf x={160} y={50} r={-165} s={0.95} delay={1.1} />
        <PearlLeaf x={140} y={82} r={175} s={0.9} delay={1.2} />
        <PearlLeaf x={118} y={70} r={-170} s={0.85} delay={1.3} />
        <PearlLeaf x={98} y={72} r={170} s={0.75} delay={1.4} />

        {/* 은방울꽃 */}
        <motion.path d="M258 42 C250 28 238 24 226 26" {...edge} strokeWidth={0.8} {...drawIn(0.9, 0.4)} />
        <PearlBell x={244} y={27} delay={1.2} />
        <PearlBell x={232} y={26} delay={1.3} />

        {/* 진주 체인 */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.circle key={i} cx={190 - i * 11} cy={92 + Math.sin(i / 2) * 3} r={1.4} fill={PEARL} {...popIn(1.3 + i * 0.05)} />
        ))}

        {/* 매달린 별 펜던트 */}
        <PearlPendant x={132} y={84} len={12} delay={1.55} />
        <PearlPendant x={70} y={64} len={16} delay={1.65} />

        {/* 양끝 푸른 별 */}
        <PearlStar x={20} y={60} r={13} delay={1.5} />
      </Mirrored>

      {/* 중앙: 점화 섬광 → 후광 → 꽃잎 개화 */}
      <g transform="translate(300 58)">
        <motion.path
          d={starD(44)}
          fill="#ffffff"
          initial={{ scale: 0, opacity: 0, rotate: -45 }}
          animate={{ scale: [0, 1.4, 0.2], opacity: [0, 1, 0], rotate: [-45, 0, 20] }}
          transition={{ duration: 0.8, times: [0, 0.35, 1], ease: 'easeOut' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <motion.circle r={50} fill="url(#pbHalo)" {...popIn(0.2)} />
        <motion.circle r={40} {...edge} strokeWidth={0.8} {...drawIn(0.25, 0.8)} />
        <motion.circle r={36} {...line} strokeWidth={0.5} strokeOpacity={0.6} {...drawIn(0.35, 0.8)} />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`rotate(${i * 72})`}>
            <motion.path
              d="M0 -2 C-15 -9 -15 -30 0 -37 C15 -30 15 -9 0 -2 Z"
              fill="url(#pbPetalGrad)"
              stroke={PEARL_EDGE}
              strokeWidth={0.7}
              initial={{ scale: 0, rotate: -35, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
            />
          </g>
        ))}
      </g>
      <PearlStar x={300} y={58} r={10} delay={0.7} />
      <PearlStar x={300} y={8} r={6} delay={0.8} />
    </svg>
  );
};

// 주변을 떠다니며 반짝이는 별가루 (좌표는 컨테이너 기준 %)
const PEARL_DUST = [
  { l: 8, t: 18, s: 9, d: 1.8 },
  { l: 20, t: 62, s: 6, d: 2.4 },
  { l: 33, t: 8, s: 7, d: 3.1 },
  { l: 50, t: 4, s: 6, d: 2.0 },
  { l: 67, t: 10, s: 8, d: 2.7 },
  { l: 81, t: 64, s: 6, d: 3.4 },
  { l: 92, t: 20, s: 9, d: 2.2 },
];

const PearlDust: React.FC = () => (
  <>
    {PEARL_DUST.map((p, i) => (
      <motion.svg
        key={i}
        viewBox="-10 -10 20 20"
        width={p.s}
        height={p.s}
        style={{ position: 'absolute', left: `${p.l}%`, top: `${p.t}%`, overflow: 'visible', filter: 'drop-shadow(0 0 4px rgba(190, 210, 255, 0.9))' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], y: [0, -10, -18] }}
        transition={{ duration: 2.8, delay: p.d, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
      >
        <path d={starD(10)} fill="#ffffff" />
      </motion.svg>
    ))}
  </>
);

const PearlBlossomTitle: React.FC<{ title: string }> = ({ title }) => {
  const chars = Array.from(title);
  const mid = (chars.length - 1) / 2;
  const textStyle: React.CSSProperties = {
    fontFamily: "'Nanum Myeongjo', 'Cinzel', serif",
    fontSize: '42px',
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: '0.5px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'keep-all',
  };
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '10px 24px 0',
        minHeight: '136px',
      }}
    >
      <PearlDust />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 글자별 개화: 중앙 글자부터 바깥으로 흐림→선명 */}
        <div
          style={{
            ...textStyle,
            color: '#fffdf7',
            WebkitTextStroke: '0.6px rgba(214, 186, 128, 0.85)',
            textShadow:
              '0 0 6px rgba(255, 246, 225, 0.85), 0 0 18px rgba(170, 195, 255, 0.5), 0 2px 4px rgba(0, 0, 0, 0.85)',
          }}
        >
          {chars.map((ch, i) => (
            <motion.span
              key={i}
              style={{ display: 'inline-block' }}
              initial={{ opacity: 0, y: 8, scale: 1.35, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 1.1 + Math.abs(i - mid) * 0.06, duration: 0.6, ease: 'easeOut' }}
            >
              {ch}
            </motion.span>
          ))}
        </div>
        {/* 빛줄기 스윕: 개화 후 주기적으로 제목 위를 훑음 */}
        <motion.div
          aria-hidden
          style={{
            ...textStyle,
            position: 'absolute',
            inset: 0,
            color: 'transparent',
            backgroundImage:
              'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.95) 48%, rgba(190,210,255,0.9) 52%, transparent 65%)',
            backgroundSize: '250% 100%',
            backgroundRepeat: 'no-repeat',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            pointerEvents: 'none',
          }}
          initial={{ backgroundPosition: '150% 0' }}
          animate={{ backgroundPosition: ['150% 0', '-50% 0'] }}
          transition={{ delay: 2.1, duration: 1.3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 3.5 }}
        >
          {title}
        </motion.div>
      </div>
      <PearlBlossomDivider />
    </div>
  );
};

/* =========================================================================
   메인 ConcertNotification 컴포넌트
   - 충분히 크고 와이드한 폼팩터 (기본폭 720px 고정)
   - 연주자가 난입해서 추가되어도 외형 크기/높이가 덜컹거리지 않도록 안정적인 최소 높이 사전 확보
   ========================================================================= */
export const ConcertNotification: React.FC<ConcertNotificationProps> = React.memo(({
  activeNotice,
  position,
  onPositionChange,
  isLocked,
  isClickThrough,
  motionTheme = 'cinematic',
  bgStyle = 'translucent',
  containerRef,
  scale = 100,
}) => {
  const scaleFactor = (scale || 100) / 100;
  const { handleMouseDown: handleDragStart } = useDraggable({
    position,
    onPositionChange,
    disabled: isLocked || isClickThrough,
  });

  // 테마 정규화 (구버전 테마명 호환 폴백)
  const currentTheme: ConcertMotionTheme =
    motionTheme === 'vineBloom' || motionTheme === 'arcaneRune' || motionTheme === 'auroraPrism' ||
    motionTheme === 'ornamentUnfold' || motionTheme === 'branchGrow' || motionTheme === 'pearlBlossom'
      ? motionTheme
      : 'cinematic';

  // 1. 모션 테마별 Framer Motion 인입/퇴장 애니메이션 정의
  const getMotionProps = () => {
    switch (currentTheme) {
      case 'ornamentUnfold':
      case 'branchGrow':
      case 'pearlBlossom':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0, filter: 'blur(6px)' },
          transition: { duration: 0.5, ease: 'easeOut' as const },
        };
      case 'vineBloom':
        return {
          initial: { opacity: 0, y: 35, scale: 0.94 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -25, scale: 0.96, filter: 'blur(6px)' },
          transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] as const },
        };
      case 'arcaneRune':
        return {
          initial: { opacity: 0, scale: 0.55, rotate: -4 },
          animate: { opacity: 1, scale: 1, rotate: 0 },
          exit: { opacity: 0, scale: 1.12, filter: 'blur(10px)' },
          transition: { duration: 0.65, ease: [0.34, 1.56, 0.64, 1] as const },
        };
      case 'auroraPrism':
        return {
          initial: { opacity: 0, scale: 1.08, filter: 'blur(12px)' },
          animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, scale: 0.92, filter: 'blur(10px)' },
          transition: { duration: 0.7, ease: 'easeOut' as const },
        };
      case 'cinematic':
      default:
        return {
          initial: { opacity: 0, scale: 0.92, y: 18, filter: 'blur(6px)' },
          animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' },
          exit: { opacity: 0, scale: 0.96, y: -18, filter: 'blur(5px)' },
          transition: { duration: 0.65, ease: 'easeOut' as const },
        };
    }
  };

  // 2. 배경 및 테마별 카드 비주얼 스타일링
  const isOpaque = bgStyle === 'opaque';

  let cardBackground = '';
  let cardBorder = '';
  let cardBoxShadow = '';
  let badgeIcon = <Sparkles size={13} color="#fef08a" />;
  let badgeBg = 'rgba(245, 158, 11, 0.22)';
  let badgeBorder = '1px solid rgba(245, 158, 11, 0.5)';
  let badgeTextColor = '#fef08a';
  let badgeLabel = 'SOLO PERFORMANCE • 독주';

  if (activeNotice && activeNotice.members.length > 1) {
    badgeLabel = 'CONCERT ENSEMBLE • 합주';
  }

  switch (currentTheme) {
    case 'vineBloom':
      badgeIcon = <Trees size={13} color="#6ee7b7" />;
      badgeBg = 'rgba(16, 185, 129, 0.2)';
      badgeBorder = '1px solid rgba(52, 211, 153, 0.6)';
      badgeTextColor = '#a7f3d0';
      cardBackground = isOpaque
        ? 'linear-gradient(135deg, rgba(6, 28, 18, 0.98) 0%, rgba(10, 20, 15, 0.98) 100%)'
        : 'linear-gradient(135deg, rgba(6, 28, 18, 0.72) 0%, rgba(10, 22, 16, 0.68) 100%)';
      cardBorder = '1px solid rgba(52, 211, 153, 0.55)';
      cardBoxShadow =
        '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 32px rgba(16, 185, 129, 0.35), inset 0 1px 0 rgba(110, 231, 183, 0.2)';
      break;

    case 'arcaneRune':
      badgeIcon = <Shield size={13} color="#38bdf8" />;
      badgeBg = 'rgba(192, 132, 252, 0.22)';
      badgeBorder = '1px solid rgba(192, 132, 252, 0.65)';
      badgeTextColor = '#e9d5ff';
      cardBackground = isOpaque
        ? 'linear-gradient(135deg, rgba(16, 10, 32, 0.98) 0%, rgba(10, 15, 30, 0.98) 100%)'
        : 'linear-gradient(135deg, rgba(16, 10, 32, 0.75) 0%, rgba(10, 15, 30, 0.7) 100%)';
      cardBorder = '1px solid rgba(192, 132, 252, 0.65)';
      cardBoxShadow =
        '0 22px 55px rgba(0, 0, 0, 0.8), 0 0 40px rgba(192, 132, 252, 0.5), 0 0 55px rgba(56, 189, 248, 0.3)';
      break;

    case 'auroraPrism':
      badgeIcon = <Star size={13} color="#fde047" />;
      badgeBg = 'rgba(167, 139, 250, 0.25)';
      badgeBorder = '1px solid rgba(167, 139, 250, 0.65)';
      badgeTextColor = '#fdf2f8';
      cardBackground = isOpaque
        ? 'linear-gradient(135deg, rgba(12, 14, 35, 0.98) 0%, rgba(25, 12, 38, 0.98) 100%)'
        : 'linear-gradient(135deg, rgba(12, 14, 35, 0.72) 0%, rgba(25, 12, 38, 0.68) 100%)';
      cardBorder = '1px solid rgba(167, 139, 250, 0.6)';
      cardBoxShadow =
        '0 22px 55px rgba(0, 0, 0, 0.7), 0 0 35px rgba(167, 139, 250, 0.4), 0 0 45px rgba(244, 114, 182, 0.25)';
      break;

    case 'cinematic':
    default:
      badgeIcon = <Sparkles size={13} color="#fef08a" />;
      badgeBg = 'rgba(245, 158, 11, 0.22)';
      badgeBorder = '1px solid rgba(245, 158, 11, 0.5)';
      badgeTextColor = '#fef08a';
      cardBackground = isOpaque
        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(26, 20, 10, 0.98) 100%)'
        : 'linear-gradient(135deg, rgba(15, 23, 42, 0.55) 0%, rgba(26, 20, 10, 0.6) 100%)';
      cardBorder = '1px solid rgba(245, 158, 11, 0.5)';
      cardBoxShadow =
        '0 18px 45px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)';
      break;
  }

  // 타이틀 텍스트 스타일링 (큼직하고 웅장한 가독성)
  const getTitleStyle = (): React.CSSProperties => {
    const overflowDefense: React.CSSProperties = {
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      maxWidth: '100%',
    };

    switch (currentTheme) {
      case 'vineBloom':
        return {
          ...overflowDefense,
          fontFamily: "'Nanum Myeongjo', 'Cinzel', serif",
          fontSize: '30px',
          fontWeight: 800,
          color: '#f0fdf4',
          letterSpacing: '-0.2px',
          lineHeight: 1.25,
          textShadow:
            '0 0 20px rgba(52, 211, 153, 0.8), 0 2px 12px rgba(0, 0, 0, 0.95)',
        };

      case 'arcaneRune':
        return {
          ...overflowDefense,
          fontFamily: "'Pretendard', 'Cinzel', sans-serif",
          fontSize: '30px',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '0.8px',
          lineHeight: 1.25,
          textShadow:
            '0 0 24px rgba(192, 132, 252, 0.95), 0 0 40px rgba(56, 189, 248, 0.8), 0 2px 10px rgba(0,0,0,0.95)',
        };

      case 'auroraPrism':
        return {
          ...overflowDefense,
          fontFamily: "'Pretendard', 'Cinzel', sans-serif",
          fontSize: '31px',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '-0.2px',
          lineHeight: 1.25,
          background: 'linear-gradient(90deg, #c084fc, #60a5fa, #34d399, #f472b6, #fbbf24, #c084fc)',
          backgroundSize: '100% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 18px rgba(167, 139, 250, 0.9)) drop-shadow(0 2px 12px rgba(0,0,0,0.95))',
        };

      case 'cinematic':
      default:
        return {
          ...overflowDefense,
          fontFamily: "'Cinzel', 'Nanum Myeongjo', serif",
          fontSize: '30px',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.3px',
          lineHeight: 1.25,
          textShadow:
            '0 2px 14px rgba(0,0,0,0.95), 0 0 26px rgba(245, 158, 11, 0.5)',
        };
    }
  };

  return (
    <AnimatePresence mode="wait">
      {activeNotice && (
        <motion.div
          key={activeNotice.id || activeNotice.title}
          ref={containerRef as any}
          onMouseDown={handleDragStart}
          {...getMotionProps()}
            style={{
              position: 'fixed',
              left: `${position.x / scaleFactor}px`,
              top: `${position.y / scaleFactor}px`,
              zoom: scaleFactor,
              zIndex: 9999,
              pointerEvents: isClickThrough ? 'none' : 'auto',
              cursor: isLocked ? 'default' : 'move',
              userSelect: 'none',
              width: '720px',
              maxWidth: '94vw',
            }}
          >
            {/* 위치 이동 손잡이 (잠금 해제 상태에서만 노출) */}
            {!isLocked && (
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background:
                    currentTheme === 'vineBloom'
                      ? 'rgba(16, 185, 129, 0.95)'
                      : currentTheme === 'arcaneRune'
                      ? 'rgba(192, 132, 252, 0.95)'
                      : currentTheme === 'auroraPrism'
                      ? 'rgba(56, 189, 248, 0.95)'
                      : 'rgba(245, 158, 11, 0.95)',
                  borderRadius: '6px',
                  padding: '2px 10px',
                  color: '#000000',
                  fontSize: '10px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  zIndex: 20,
                }}
              >
                <GripHorizontal size={11} />
                <span>음악회 창 드래그 이동</span>
              </div>
            )}
            {/* 배경 없는 테마(오너먼트/가지) vs 카드 본체 */}
            {currentTheme === 'pearlBlossom' ? (
              <PearlBlossomTitle title={activeNotice.title} />
            ) : currentTheme === 'ornamentUnfold' || currentTheme === 'branchGrow' ? (
              <BareConcertTitle theme={currentTheme} title={activeNotice.title} />
            ) : (
            <div
              style={{
                position: 'relative',
                width: '100%',
                minHeight: '136px',
                boxSizing: 'border-box',
                padding: '22px 36px 20px 36px',
                borderRadius: '24px',
                background: cardBackground,
                backdropFilter: isOpaque ? 'none' : 'blur(18px)',
                WebkitBackdropFilter: isOpaque ? 'none' : 'blur(18px)',
                border: cardBorder,
                boxShadow: cardBoxShadow,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '8px',
                overflow: 'hidden',
                transition: 'background 0.3s ease, border-color 0.3s ease',
              }}
            >
              {/* [테마별 특수 이펙트 레이어] */}
              {/* 테마 2: 아케인 룬 마법진 백그라운드 (카드에 맞춘 460px 대형 마법진) */}
              {currentTheme === 'arcaneRune' && <ArcaneMagicCircle />}

              {/* 테마 3: 오로라 프리즘 별빛 파티클들 */}
              {currentTheme === 'auroraPrism' && (
                <>
                  <AuroraStar size={18} color="#fde047" top="14px" left="22px" delay={0} />
                  <AuroraStar size={14} color="#a78bfa" top="18px" right="24px" delay={0.6} />
                  <AuroraStar size={15} color="#38bdf8" bottom="18px" left="26px" delay={1.2} />
                  <AuroraStar size={14} color="#f472b6" bottom="16px" right="24px" delay={1.8} />
                </>
              )}

              {/* 상단 뱃지 */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 14px',
                  borderRadius: '16px',
                  background: badgeBg,
                  border: badgeBorder,
                  color: badgeTextColor,
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                }}
              >
                {badgeIcon}
                <span>{badgeLabel}</span>
              </div>

              {/* 메인 곡명 (테마별 애니메이션 및 타이포) */}
              <motion.div
                initial={
                  currentTheme === 'vineBloom'
                    ? { opacity: 0, y: 15, scale: 0.95 }
                    : currentTheme === 'arcaneRune'
                    ? { opacity: 0, scale: 0.85 }
                    : currentTheme === 'auroraPrism'
                    ? { opacity: 0, y: 10 }
                    : { opacity: 0, y: 8 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className={currentTheme === 'auroraPrism' ? 'mofo-aurora-gpu-shimmer' : undefined}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  ...getTitleStyle(),
                }}
              >
                {activeNotice.title}
              </motion.div>

              {/* [테마 1: 세계수의 덩굴] 자라나는 바텀라인 SVG 데코레이션 */}
              {currentTheme === 'vineBloom' && <VineBottomDecoration />}

              {/* [테마 3: 오로라 프리즘] 크리스탈 디바이더 */}
              {currentTheme === 'auroraPrism' && <AuroraPrismDivider />}

              {/* [테마 0: 시네마틱 골드] 클래식 디바이더 */}
              {currentTheme === 'cinematic' && (
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '80px',
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
                    margin: '2px 0',
                  }}
                />
              )}

              {/* [테마 2: 아케인 룬] 일렉트릭 디바이더 */}
              {currentTheme === 'arcaneRune' && (
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '100px',
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #38bdf8, #c084fc, transparent)',
                    margin: '2px 0',
                  }}
                />
              )}

            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
  );
});

