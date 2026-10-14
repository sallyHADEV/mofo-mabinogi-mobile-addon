import React from 'react';
import { Clock, CloudSun, MapPin, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import type { EnvironmentData } from '../types.js';

interface ErinnClockBadgeProps {
  envData: EnvironmentData | null;
  compact?: boolean;
  slim?: boolean; // 도킹 버튼 높이(28px)에 맞춘 슬림 모드
}

export interface ErinnTimeParsed {
  timeOnly: string;      // 예: "오전 04:18"
  period: string;        // 예: "새벽", "아침", "낮", "저녁", "밤"
  displayStr: string;    // 예: "오전 04:18 (새벽)"
  fullDate: string;      // 예: "에린력 2959년 1월 13일"
  raw: string;
}

export function parseErinnTime(raw?: string): ErinnTimeParsed {
  if (!raw) {
    return {
      timeOnly: '연동 중...',
      period: '',
      displayStr: '에린 시각 연동 중...',
      fullDate: '에린 시각 대기 중',
      raw: '',
    };
  }

  // 예: "2960-3-22 14:37" (월/일 0 패딩 없음)
  const match = raw.trim().match(/^(\d+)-(\d+)-(\d+)\s+(\d{1,2}):(\d{2})$/);
  if (!match) {
    return {
      timeOnly: raw,
      period: '',
      displayStr: raw,
      fullDate: raw,
      raw,
    };
  }

  const [, year, month, day, hourStr, minStr] = match;
  const h = parseInt(hourStr, 10);
  const m = minStr;
  const monthNum = parseInt(month, 10); // 원본 데이터의 월 값을 그대로 사용

  // 마비노기 에린 시간대 구분
  let period = '밤';
  if (h >= 4 && h < 6) period = '새벽';
  else if (h >= 6 && h < 12) period = '아침';
  else if (h >= 12 && h < 18) period = '낮';
  else if (h >= 18 && h < 22) period = '저녁';

  const ampm = h < 12 ? '오전' : '오후';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const timeOnly = `${ampm} ${String(displayHour).padStart(2, '0')}:${m}`;

  return {
    timeOnly,
    period,
    displayStr: `${timeOnly} (${period})`,
    fullDate: `에린력 ${year}년 ${monthNum}월 ${day}일`,
    raw,
  };
}

export const ErinnClockBadge: React.FC<ErinnClockBadgeProps> = React.memo(({ envData, compact, slim }) => {
  const parsedTime = parseErinnTime(envData?.ErinnNow);

  // 날씨 한글화 매핑 (대소문자 무관 정규화)
  const rawWeather = (envData?.Weather || '맑음').trim();
  const normalizedWeather = rawWeather.toLowerCase();
  const weatherMap: Record<string, string> = {
    sunny: '맑음',
    clear: '맑음',
    fine: '맑음',
    rain: '비',
    rainy: '비',
    shower: '소나기',
    drizzle: '이슬비',
    cloudy: '흐림',
    overcast: '흐림',
    fog: '안개',
    foggy: '안개',
    mist: '안개',
    snow: '눈',
    snowy: '눈',
    storm: '폭풍우',
    thunder: '낙뢰',
    thunderstorm: '낙뢰',
    lightning: '낙뢰',
  };
  const weather = weatherMap[normalizedWeather] || rawWeather;

  // 위치 안전 추출 (WorldPosition이 객체 {X, Y}로 올 수 있으므로 정규화)
  let location = '에린';
  if (envData?.GameSpaceDisplayName) {
    location = envData.GameSpaceDisplayName;
  } else if (envData?.ChannelDisplayName) {
    location = envData.ChannelDisplayName;
  } else if (envData?.WorldPosition) {
    const wp = envData.WorldPosition as any;
    location = typeof wp === 'object' ? `좌표 (${Math.round(wp.X)}, ${Math.round(wp.Y)})` : String(wp);
  }

  // 시간대 아이콘
  const iconSize = slim ? 12 : 14;
  const getPeriodIcon = () => {
    switch (parsedTime.period) {
      case '새벽':
        return <Sunrise size={iconSize} color="#a855f7" />;
      case '아침':
        return <Sunrise size={iconSize} color="#f59e0b" />;
      case '낮':
        return <Sun size={iconSize} color="#fbbf24" />;
      case '저녁':
        return <Sunset size={iconSize} color="#f97316" />;
      case '밤':
        return <Moon size={iconSize} color="#38bdf8" />;
      default:
        return <Clock size={iconSize} color="#f59e0b" />;
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: slim ? '7px' : '9px',
        padding: slim ? '0 11px' : compact ? '6px 12px' : '7px 15px',
        height: slim ? '28px' : undefined,
        boxSizing: 'border-box',
        borderRadius: '20px',
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
        color: '#f8fafc',
        fontSize: slim ? '11.5px' : '13px',
        fontWeight: 500,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
      title={`${parsedTime.fullDate} ${parsedTime.displayStr} (원본: ${parsedTime.raw || '없음'})`}
    >
      {/* 에린 시간 (직관적인 오전/오후 및 시간대 중심) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {getPeriodIcon()}
        <span style={{ color: '#fef08a', fontWeight: 700, letterSpacing: '-0.2px' }}>
          {parsedTime.displayStr}
        </span>
        {/* 에린력 날짜 미니 뱃지 */}
        {parsedTime.fullDate && parsedTime.fullDate !== '에린 시각 대기 중' && (
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#fbbf24',
              fontWeight: 600,
              letterSpacing: '-0.3px',
            }}
          >
            {parsedTime.fullDate}
          </span>
        )}
      </div>

      {!compact && (
        <>
          <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.18)' }} />

          {/* 날씨 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontSize: slim ? '11px' : '12px' }}>
            <CloudSun size={13} color="#38bdf8" />
            <span>{weather}</span>
          </div>

          <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.18)' }} />

          {/* 위치 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', fontSize: slim ? '11px' : '12px' }}>
            <MapPin size={12} color="#a855f7" />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {location}
            </span>
          </div>
        </>
      )}
    </div>
  );
});
