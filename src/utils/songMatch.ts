/**
 * 게임 악보 제목(자유 텍스트)과 외부 음원 검색 결과를 매칭하는 유틸리티
 */
import type { SongCandidate } from '../types.js';

export const CHAT_MAX_LENGTH = 50;
export const DEFAULT_SONG_CHAT_TEMPLATE = '♪ {artist} - {title}';

/**
 * 악보 제목 주석 제거: 게임에 메모 기능이 없어 제목에 남기는 주석 규칙
 * - [대괄호] / 【】 / ［］ 안의 내용 (여러 개, 어디든)
 * - # 뒤의 모든 내용
 * 예: "캐치 캐치 [3인 합주] #베이스" → "캐치 캐치". 주석만 있는 제목이면 원문 유지.
 * (소괄호는 실제 곡명에 자주 쓰여 주석으로 보지 않음: Golden (Acapella))
 */
export function stripSongAnnotation(gameTitle: string): string {
  const stripped = gameTitle
    .replace(/#.*$/, '')
    .replace(/\[[^\]]*\]|【[^】]*】|［[^］]*］/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || gameTitle.trim();
}

// 검색어: 주석 제거 후 악보 제목의 구분자(_ - / · | 등)를 공백으로 정리
export function normalizeSongQuery(gameTitle: string): string {
  return stripSongAnnotation(gameTitle)
    .replace(/^악보\s*:\s*/, '')
    .replace(/[_\-/·|~()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 비교용 키: 소문자 + 글자/숫자만
const toKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// 원곡이 아닌 변형(커버/노래방/악기/속도 변경/리믹스 등)
const VARIANT_TITLE = /[(\[【［].*?(cover|karaoke|inst|piano|피아노|오르골|music ?box|sped|slowed|acapella|a cappella|lo-?fi|orchestra|remix|rem\/x|ver\b|ver\.|version|반주|커버|originally)/i;
const VARIANT_TITLE_SUFFIX = /\b(mr|inst\.?)$/i;
// 괄호 없이 붙는 속도 변경 표기 (예: "잘자요 아가씨 SLOWED (Prod. 과나)")
const VARIANT_TITLE_WORD = /\b(sped up|slowed|nightcore)\b/i;
const VARIANT_ARTIST = /(karaoke|noraebang|노래방|cover|piano|lullaby|music ?box|orgel|오르골)/i;

const isVariant = (c: SongCandidate) =>
  VARIANT_TITLE.test(c.title) ||
  VARIANT_TITLE_SUFFIX.test(c.title.trim()) ||
  VARIANT_TITLE_WORD.test(c.title) ||
  VARIANT_ARTIST.test(c.artist);

export type RankedCandidate = SongCandidate;

const SOURCE_PRIORITY: SongCandidate['source'][] = ['flo', 'itunes', 'deezer'];

/**
 * 출처 하나만 골라 원곡(커버/변형 제외)을 쓰고, 그 안에서는 검색 API의 관련도 순서를 신뢰해 상위 3개를 반환.
 * - 1위가 검색어와 완전 일치하는 출처가 있으면 그 출처 우선 (예: FLO가 팬메이드 곡뿐인 Golden → iTunes 원곡)
 * - 없으면 우선순위(FLO → iTunes US/JP → Deezer)대로 원곡이 있는 첫 출처
 * (FLO는 한국 곡을 한글로, iTunes는 영문 표기로 주므로 섞으면 같은 곡이 두 번 보임)
 * 글자 일치 점수는 한글 제목의 커버곡을 과대평가하므로 쓰지 않는다.
 * 1위가 완전 일치하면 확실로 보고 1개만 반환.
 */
export function rankSongCandidates(query: string, candidates: SongCandidate[]): RankedCandidate[] {
  const queryKey = toKey(query);
  if (!queryKey) return [];

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const k = `${toKey(c.artist)}|${toKey(c.title)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const tokens = queryTokens(query);
  const bySource = SOURCE_PRIORITY.map((src) => unique.filter((c) => c.source === src && !isVariant(c)));
  const originals =
    bySource.find((l) => l.length > 0 && isExactMatch(queryKey, l[0])) ??
    bySource.find((l) => l.length > 0 && isTransliteratedMatch(queryKey, tokens, l[0])) ??
    bySource.find((l) => l.length > 0) ??
    [];
  // 전부 변형 곡이면 아무것도 안 보여주는 것보다 변형이라도 보여줌
  const top = (originals.length > 0 ? originals : unique).slice(0, 3);
  if (top.length === 0) return [];
  return isExactMatch(queryKey, top[0]) || isTransliteratedMatch(queryKey, tokens, top[0]) ? [top[0]] : top;
}

const queryTokens = (query: string) => query.split(/\s+/).map(toKey).filter(Boolean);
const scriptOf = (key: string) => (/[가-힣]/.test(key) ? 'ko' : /[a-z]/.test(key) ? 'lat' : /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(key) ? 'cjk' : 'other');

/**
 * 곡명은 완전 일치하는데 가수 표기만 문자 체계가 다른 경우 (음역 차이)
 * 예: 악보 "험프백 - 친애하는 소년이여" ↔ "Hump Back - 친애하는 소년이여（拝啓、少年よ）"
 * - 곡명이 검색어의 앞이나 뒤 단어들과 정확히 같고, 곡명이 검색어의 절반 이상이며(3글자 이상)
 * - 남은 단어(가수로 추정)가 후보 가수와 다른 문자 체계일 때만 인정.
 *   같은 문자 체계면 가수도 일치해야 하므로(isExactMatch) 팬메이드 "Golden" 이 "Golden HuntR X" 로 확실 판정되지 않는다.
 */
function isTransliteratedMatch(queryKey: string, tokens: string[], c: SongCandidate): boolean {
  if (tokens.length < 2) return false;
  const artistScripts = new Set(artistKeys(c.artist).map(scriptOf));
  return titleKeys(c.title).some((t) => {
    if (t.length < 3 || t.length * 2 < queryKey.length) return false;
    for (let k = 1; k < tokens.length; k++) {
      const head = tokens.slice(0, k).join('');
      const tail = tokens.slice(k).join('');
      const rest = tail === t ? head : head === t ? tail : null;
      if (rest !== null && !artistScripts.has(scriptOf(rest))) return true;
    }
    return false;
  });
}

// 아티스트 표기 변형: "YENA (최예나)" → YENA최예나 / YENA / 최예나,
// "HUNTR/X, EJAE & KPop Demon Hunters Cast" → 전체 / HUNTR/X / EJAE / ...
function artistKeys(artist: string): string[] {
  const parts = artist.split(/[()（）,&]|\s(?:feat\.?|ft\.?|with)\s/i).map(toKey).filter(Boolean);
  return [toKey(artist), ...parts];
}

// 곡명 표기 변형: 괄호 부가정보를 뺀 형태도 비교 ("잘자요 아가씨 (Prod. 과나)", "친애하는 소년이여（拝啓、少年よ）")
// 곡명의 괄호 부가정보 제거: "친애하는 소년이여（拝啓、少年よ）" → "친애하는 소년이여". 괄호뿐이면 원문 유지
export function stripTitleExtras(title: string): string {
  const bare = title.replace(/[(（[【［][^)）\]】］]*[)）\]】］]/g, ' ').replace(/\s+/g, ' ').trim();
  return bare || title.trim();
}

function titleKeys(title: string): string[] {
  const bare = toKey(stripTitleExtras(title));
  return bare !== toKey(title) ? [toKey(title), bare] : [toKey(title)];
}

function isExactMatch(queryKey: string, c: SongCandidate): boolean {
  const artists = artistKeys(c.artist);
  return titleKeys(c.title).some(
    (t) => queryKey === t || artists.some((a) => queryKey === t + a || queryKey === a + t)
  );
}

// 확실한 1순위인지: 1위가 검색어와 곡명(+아티스트) 완전 일치, 또는 곡명 일치 + 가수 음역 차이
export function isConfidentMatch(query: string, ranked: SongCandidate[]): boolean {
  if (ranked.length === 0) return false;
  const queryKey = toKey(query);
  return isExactMatch(queryKey, ranked[0]) || isTransliteratedMatch(queryKey, queryTokens(query), ranked[0]);
}

// 템플릿 치환 후 50자 제한에 맞게 자름 (서로게이트 쌍 안전). {title} 은 괄호 부가정보를 뺀 곡명.
// 넘치면 먼저 아티스트를 대표 1명으로 줄여 곡명이 잘리지 않게 함
// (예: "HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast" → "HUNTR/X")
export function formatSongChat(
  template: string,
  values: { artist: string; title: string; game: string }
): string {
  const fill = (artist: string) =>
    (template.trim() || DEFAULT_SONG_CHAT_TEMPLATE)
      .replace(/\{artist\}/g, artist)
      .replace(/\{title\}/g, stripTitleExtras(values.title))
      .replace(/\{game\}/g, values.game)
      .trim();
  const full = fill(values.artist);
  if (Array.from(full).length <= CHAT_MAX_LENGTH) return full;
  const leadArtist = values.artist.split(/\s*[,&]\s*|\s(?:feat\.?|ft\.?|with)\s/i)[0].trim();
  return truncateChat(fill(leadArtist || values.artist));
}

// 원곡을 찾지 못했을 때 보낼 채팅: 주석을 뺀 악보 제목 그대로
export function formatSheetTitleChat(gameTitle: string): string {
  return truncateChat(stripSongAnnotation(gameTitle));
}

function truncateChat(text: string): string {
  const chars = Array.from(text);
  return chars.length > CHAT_MAX_LENGTH ? chars.slice(0, CHAT_MAX_LENGTH).join('') : text;
}
