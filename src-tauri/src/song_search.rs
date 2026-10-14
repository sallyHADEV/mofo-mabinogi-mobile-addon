use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Serialize, Debug, Clone)]
pub struct SongCandidate {
    pub artist: String,
    pub title: String,
    pub source: &'static str,
    /// iTunes 곡 ID (한국 스토어 표기 조회용, 프런트로는 보내지 않음)
    #[serde(skip)]
    pub track_id: Option<u64>,
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(5))
        .user_agent("MoFo/0.1 (Mabinogi Mobile overlay)")
        .build()
}

fn fetch_json(agent: &ureq::Agent, url: &str, params: &[(&str, &str)]) -> Result<serde_json::Value, String> {
    let mut req = agent.get(url);
    for (k, v) in params {
        req = req.query(k, v);
    }
    let body = req.call().map_err(|e| e.to_string())?.into_string().map_err(|e| e.to_string())?;
    serde_json::from_str(&body).map_err(|e| e.to_string())
}

fn search_itunes(agent: &ureq::Agent, query: &str, country: &str) -> Result<Vec<SongCandidate>, String> {
    let json = fetch_json(
        agent,
        "https://itunes.apple.com/search",
        &[("term", query), ("country", country), ("media", "music"), ("entity", "song"), ("limit", "10")],
    )?;
    Ok(json["results"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|r| {
                    Some(SongCandidate {
                        artist: r["artistName"].as_str()?.to_string(),
                        title: r["trackName"].as_str()?.to_string(),
                        source: "itunes",
                        track_id: r["trackId"].as_u64(),
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

/// FLO(비공식 웹 API, 키 불필요): 한국 곡을 한글 표기로 반환. 형식이 바뀌면 빈 목록/에러 → iTunes로 대체
fn search_flo(agent: &ureq::Agent, query: &str) -> Result<Vec<SongCandidate>, String> {
    let json = fetch_json(
        agent,
        "https://www.music-flo.com/api/search/v2/search",
        &[("keyword", query), ("searchType", "TRACK"), ("sortType", "ACCURACY"), ("size", "10"), ("page", "1")],
    )?;
    Ok(json["data"]["list"]
        .as_array()
        .and_then(|groups| groups.iter().find(|g| g["type"] == "TRACK"))
        .and_then(|g| g["list"].as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|t| {
                    Some(SongCandidate {
                        artist: t["representationArtist"]["name"].as_str()?.to_string(),
                        title: t["name"].as_str()?.to_string(),
                        source: "flo",
                        track_id: None,
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

fn search_deezer(agent: &ureq::Agent, query: &str) -> Result<Vec<SongCandidate>, String> {
    let json = fetch_json(agent, "https://api.deezer.com/search", &[("q", query), ("limit", "10")])?;
    Ok(json["data"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|r| {
                    Some(SongCandidate {
                        artist: r["artist"]["name"].as_str()?.to_string(),
                        title: r["title"].as_str()?.to_string(),
                        source: "deezer",
                        track_id: None,
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

/// iTunes 한국 스토어는 "검색"은 0건이지만 곡 ID "조회"는 한국어 표기를 준다
/// (YENA - Catch Catch → 최예나 - 캐치 캐치, BIBI - Bam Yang Gang → 비비 - 밤양갱).
/// 미국·일본에서 찾은 곡들을 한 번에 조회해 이름을 바꾼다. 실패하거나 한국에 없는 곡은 원래 표기 유지.
fn localize_itunes_kr(agent: &ureq::Agent, list: &mut [SongCandidate]) {
    let mut ids: Vec<u64> = list.iter().filter_map(|c| c.track_id).collect();
    ids.sort_unstable();
    ids.dedup();
    if ids.is_empty() {
        return;
    }
    let id_param = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
    let Ok(json) = fetch_json(agent, "https://itunes.apple.com/lookup", &[("country", "KR"), ("id", &id_param)]) else {
        return;
    };
    let names: HashMap<u64, (String, String)> = json["results"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|r| Some((r["trackId"].as_u64()?, (r["artistName"].as_str()?.to_string(), r["trackName"].as_str()?.to_string()))))
                .collect()
        })
        .unwrap_or_default();
    for c in list.iter_mut() {
        if let Some((artist, title)) = c.track_id.and_then(|id| names.get(&id)) {
            c.artist = artist.clone();
            c.title = title.clone();
        }
    }
}

/// FLO 결과 + iTunes 미국·일본 결과(순위대로 번갈아 합친 뒤 한국어 표기로 변환)를 출처와 함께 반환.
/// 어느 출처를 쓸지는 프런트(rankSongCandidates)가 FLO → iTunes → Deezer 우선순위로 결정한다.
/// 세 곳은 동시에 호출해 최악의 대기 시간을 줄인다(검색 5초 + 한국어 조회 5초).
/// FLO와 iTunes가 모두 비었거나 실패하면 Deezer로 재검색.
pub fn search_song(query: &str) -> Result<Vec<SongCandidate>, String> {
    let agent = agent();
    let (flo, us, jp) = std::thread::scope(|s| {
        let flo = s.spawn(|| search_flo(&agent, query));
        let us = s.spawn(|| search_itunes(&agent, query, "US"));
        let jp = s.spawn(|| search_itunes(&agent, query, "JP"));
        let join = |h: std::thread::ScopedJoinHandle<'_, Result<Vec<SongCandidate>, String>>| {
            h.join().unwrap_or_else(|_| Err("search thread panicked".to_string()))
        };
        (join(flo), join(us), join(jp))
    });
    let (us_list, jp_list) = (us.as_deref().unwrap_or(&[]), jp.as_deref().unwrap_or(&[]));
    let mut itunes = Vec::with_capacity(us_list.len() + jp_list.len());
    for i in 0..us_list.len().max(jp_list.len()) {
        itunes.extend(us_list.get(i).cloned());
        itunes.extend(jp_list.get(i).cloned());
    }
    localize_itunes_kr(&agent, &mut itunes);
    let mut merged: Vec<SongCandidate> = flo.as_deref().unwrap_or(&[]).to_vec();
    merged.extend(itunes);
    if !merged.is_empty() {
        return Ok(merged);
    }
    let any_ok = flo.is_ok() || us.is_ok() || jp.is_ok();
    match search_deezer(&agent, query) {
        Ok(list) => Ok(list),
        // 다른 출처가 정상 응답(0건)이었다면 Deezer 실패는 "결과 없음"으로 처리
        Err(_) if any_ok => Ok(Vec::new()),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    // 실제 네트워크 호출: cargo test -- --ignored
    #[test]
    #[ignore]
    fn searches_real_apis() {
        let list = super::search_song("Golden HuntR X").expect("search failed");
        assert!(list.iter().any(|c| c.artist.starts_with("HUNTR/X") && c.title == "Golden"), "{list:?}");
        // 한글 검색어: FLO 한글 표기 + iTunes 결과도 한국 스토어 조회로 한글 표기
        let list = super::search_song("최예나 캐치 캐치").expect("search failed");
        assert!(list.iter().any(|c| c.source == "flo" && c.title == "캐치 캐치"), "FLO: {list:?}");
        assert!(list.iter().any(|c| c.source == "itunes" && c.artist == "최예나" && c.title == "캐치 캐치"), "iTunes KR: {list:?}");
        let started = std::time::Instant::now();
        let list = super::search_song("밤양갱").expect("search failed");
        assert!(list.iter().any(|c| c.source == "itunes" && c.artist == "비비" && c.title == "밤양갱"), "iTunes KR: {list:?}");
        eprintln!("밤양갱 검색 소요: {:?}", started.elapsed());
    }
}

