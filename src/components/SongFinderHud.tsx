import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music2, Send, Loader2 } from 'lucide-react';
import { searchSong, sendGameChat } from '../services/api.js';
import {
  normalizeSongQuery,
  rankSongCandidates,
  formatSongChat,
  formatSheetTitleChat,
  isConfidentMatch,
  stripSongAnnotation,
  type RankedCandidate,
} from '../utils/songMatch.js';

interface SongFinderHudProps {
  gameTitle: string | null; // 내 연주 곡명 (연주 중이 아니면 null)
  template: string;
  autoChat: boolean;
  onToggleAutoChat: (next: boolean) => void;
  isLocked: boolean;
  isForcePassAll: boolean;
  onDoubleClick?: () => void;
  // 합주 모션 표시용: 확실한 1순위(또는 자동 채팅 시 1순위)의 '아티스트 - 곡명', 해당 없으면 null
  onResolvedTitle?: (gameTitle: string, display: string | null) => void;
}

interface SearchState {
  gameTitle: string;
  query: string;
  status: 'searching' | 'done' | 'error';
  results: RankedCandidate[];
}

// 마지막으로 자동 채팅한 곡: 임시 숨김(언마운트) 후 다시 나타나도 같은 곡을 재전송하지 않도록 모듈 수준에 보관
let lastAutoSentTitle: string | null = null;

export const SongFinderHud: React.FC<SongFinderHudProps> = React.memo(({
  gameTitle,
  template,
  autoChat,
  onToggleAutoChat,
  isLocked,
  isForcePassAll,
  onDoubleClick,
  onResolvedTitle,
}) => {
  const [search, setSearch] = useState<SearchState | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const cacheRef = useRef(new Map<string, RankedCandidate[]>());
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  // 곡이 바뀔 때만 1회 검색 (같은 곡은 캐시 재사용, 추가 폴링 없음)
  useEffect(() => {
    if (!gameTitle) {
      setSearch(null);
      return;
    }
    const query = normalizeSongQuery(gameTitle);
    const cached = cacheRef.current.get(query);
    if (cached) {
      setSearch({ gameTitle, query, status: 'done', results: cached });
      return;
    }
    let cancelled = false;
    setSearch({ gameTitle, query, status: 'searching', results: [] });
    searchSong(query).then((list) => {
      if (cancelled) return;
      if (!list) {
        setSearch({ gameTitle, query, status: 'error', results: [] });
        return;
      }
      const ranked = rankSongCandidates(query, list);
      cacheRef.current.set(query, ranked);
      setSearch({ gameTitle, query, status: 'done', results: ranked });
    });
    return () => {
      cancelled = true;
    };
  }, [gameTitle]);

  const showNotice = (text: string, ok: boolean) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ text, ok });
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3500);
  };

  const candidateMessage = useCallback(
    (candidate: RankedCandidate, gameTitle: string) =>
      formatSongChat(template, { artist: candidate.artist, title: candidate.title, game: stripSongAnnotation(gameTitle) }),
    [template]
  );

  const sendMessage = useCallback(async (message: string) => {
    if (sendingRef.current || !message) return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      const res = await sendGameChat(message);
      if (res.success) showNotice(`전송됨: ${message}`, true);
      else if (res.code === 'rate_limited') showNotice(`채팅 제한 · ${res.retryAfterSeconds ?? '잠시'}초 후 다시 시도`, false);
      else showNotice(res.message || '채팅 전송 실패', false);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }, []);

  // 자동 채팅을 켜는 순간 이미 재생 중인 곡은 보내지 않음 (곡이 바뀔 때부터 동작)
  useEffect(() => {
    if (autoChat && search) lastAutoSentTitle = search.gameTitle;
  }, [autoChat]);

  // 확실한 1순위만 원곡으로 인정 (자동 채팅·합주 모션 공통 기준. 불확실한 후보는 사람이 보고 클릭으로만 전송)
  const confidentTop =
    search?.status === 'done' && isConfidentMatch(search.query, search.results) ? search.results[0] : null;

  // 자동 채팅: 곡이 바뀔 때 1번. 확실한 1순위, 아니면(불확실/결과 없음/검색 실패) 주석 뺀 악보 제목
  useEffect(() => {
    if (!autoChat || !search || search.status === 'searching') return;
    if (lastAutoSentTitle === search.gameTitle) return;
    lastAutoSentTitle = search.gameTitle;
    void sendMessage(confidentTop ? candidateMessage(confidentTop, search.gameTitle) : formatSheetTitleChat(search.gameTitle));
  }, [autoChat, search, confidentTop, sendMessage, candidateMessage]);

  // 합주 모션 제목 반영: 확실한 1순위만 '아티스트 - 곡명', 아니면 악보 제목 그대로(null)
  useEffect(() => {
    if (!onResolvedTitle || search?.status !== 'done') return;
    onResolvedTitle(search.gameTitle, confidentTop ? `${confidentTop.artist} - ${confidentTop.title}` : null);
  }, [search, confidentTop, onResolvedTitle]);

  const results = search?.status === 'done' ? search.results : [];
  // 원곡을 못 찾았을 때(결과 없음/검색 실패) 보낼 악보 제목 메시지
  const fallbackMessage =
    search && search.status !== 'searching' && results.length === 0 ? formatSheetTitleChat(search.gameTitle) : null;

  return (
    <div
      onDoubleClick={() => onDoubleClick?.()}
      title="더블클릭 시 5초간 임시 숨김"
      style={{
        width: '240px',
        padding: '8px 10px',
        borderRadius: '10px',
        background: 'rgba(12, 13, 18, 0.82)',
        backdropFilter: 'blur(12px)',
        border: isLocked ? '1px solid rgba(167, 139, 250, 0.3)' : '1px dashed rgba(167, 139, 250, 0.8)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        color: '#e2e8f0',
        fontSize: '11px',
        userSelect: 'none',
        pointerEvents: isForcePassAll ? 'none' : 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* 헤더: 제목 + 자동 채팅 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '12px', color: '#f8fafc' }}>
          <Music2 size={12} color="#a78bfa" />
          <span>원곡 찾기</span>
        </div>
        <label
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: autoChat ? '#c4b5fd' : '#94a3b8', cursor: 'pointer' }}
          title="곡이 바뀌면 확실한 원곡을 자동으로 채팅합니다 (확실하지 않으면 악보 제목)"
        >
          <span>자동 채팅</span>
          <input
            type="checkbox"
            checked={autoChat}
            onChange={(e) => onToggleAutoChat(e.target.checked)}
            style={{ accentColor: '#a78bfa', width: '12px', height: '12px', cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* 게임 내 악보 제목 */}
      <div style={{ color: '#fde68a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '5px' }}>
        {search ? `♪ ${stripSongAnnotation(search.gameTitle)}` : '연주 대기 중'}
      </div>

      {search?.status === 'searching' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
          <Loader2 size={11} className="animate-spin" />
          <span>원곡 검색 중...</span>
        </div>
      )}
      {search?.status === 'error' && <div style={{ color: '#f87171' }}>검색 실패 (인터넷 연결 확인)</div>}
      {search?.status === 'done' && results.length === 0 && <div style={{ color: '#94a3b8' }}>일치하는 원곡을 찾지 못했습니다</div>}

      {/* 원곡을 못 찾으면 주석 뺀 악보 제목 그대로 전송 (후보 목록과 동시에 렌더링되지 않으므로 같은 id 사용) */}
      {fallbackMessage && (
        <div id="song-finder-candidates" style={{ marginTop: '4px', pointerEvents: 'auto' }}>
          <button
            disabled={isSending}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              void sendMessage(fallbackMessage);
            }}
            title={`클릭하면 채팅으로 전송: ${fallbackMessage}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              padding: '4px 6px',
              borderRadius: '6px',
              border: '1px solid rgba(253, 230, 138, 0.35)',
              background: 'rgba(253, 230, 138, 0.08)',
              color: '#fde68a',
              fontSize: '11px',
              textAlign: 'left',
              cursor: isSending ? 'wait' : 'pointer',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              악보 제목으로 보내기: {fallbackMessage}
            </span>
            <Send size={10} color="#fde68a" style={{ flexShrink: 0 }} />
          </button>
        </div>
      )}

      {/* 후보 목록: 클릭 = 즉시 채팅 전송 (완전 관통 모드에서도 클릭 가능) */}
      {results.length > 0 && (
        <div id="song-finder-candidates" style={{ display: 'flex', flexDirection: 'column', gap: '3px', pointerEvents: 'auto' }}>
          {results.map((c, i) => (
            <button
              key={`${c.artist}|${c.title}`}
              disabled={isSending}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (search) void sendMessage(candidateMessage(c, search.gameTitle));
              }}
              title={`클릭하면 채팅으로 전송: ${search ? candidateMessage(c, search.gameTitle) : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                padding: '4px 6px',
                borderRadius: '6px',
                border: i === 0 ? '1px solid rgba(167, 139, 250, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                background: i === 0 ? 'rgba(139, 92, 246, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                color: '#f1f5f9',
                fontSize: '11px',
                textAlign: 'left',
                cursor: isSending ? 'wait' : 'pointer',
                pointerEvents: 'auto',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b style={{ fontWeight: 700 }}>{c.artist}</b>
                <span style={{ color: '#94a3b8' }}> - </span>
                {c.title}
              </span>
              <Send size={10} color="#a78bfa" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div style={{ marginTop: '5px', fontSize: '10px', color: notice.ok ? '#86efac' : '#fca5a5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {notice.text}
        </div>
      )}
    </div>
  );
});
