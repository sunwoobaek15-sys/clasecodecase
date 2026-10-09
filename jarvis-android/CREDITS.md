# CREDITS

## 폰트 (모두 SIL Open Font License 1.1, 원문은 `licenses/`)
| 폰트 | 용도 | 출처 |
|---|---|---|
| **Orbitron** (Matt McInerney) | 숫자·라벨 | github.com/google/fonts — `ofl/orbitron`. 가변 폰트에서 Medium/Bold/Black 정적 인스턴스를 fontTools 로 생성 |
| **Rajdhani** (Indian Type Foundry) | 테크 보조 텍스트 | github.com/google/fonts — `ofl/rajdhani` |
| **Pretendard** (길형진) | 한글 본문 | github.com/orioncactus/pretendard |

## 효과음
부팅음, 듣기 시작 "띠링", 처리 중 저음 험, 완료 "칙", 오류 경고음, 확인음은 **외부 음원 없이 앱 코드에서 직접 합성**합니다
(`app/src/main/java/com/jarvis/assistant/audio/SfxPlayer.kt`, 사인파·사각파·노이즈 + 엔벨로프). 별도 라이선스가 필요 없습니다.

## 데이터/서비스
- 날씨: [Open-Meteo](https://open-meteo.com/) (API 키 불필요, CC BY 4.0 데이터 — 앱 내 날씨 카드에 출처 표기 권장)
- 뉴스: Google News RSS (한국판)
- 호출어: [Vosk](https://alphacephei.com/vosk/) `vosk-model-small-ko-0.22` (Apache 2.0), 첫 사용 시 다운로드
- AI: Anthropic Claude API (`claude-sonnet-5-5`), 공식 Anthropic Java SDK

## 디자인
리액터 코어, HUD 패널, 앱 아이콘은 모두 이 프로젝트를 위한 오리지널 디자인입니다. 영화 캐릭터나 로고 등 실제 IP는 사용하지 않았습니다.
