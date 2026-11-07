# CHRONICLE: THE LOST WORLD

Android용 가로 화면 픽셀 아트 액션 RPG (Godot 4 · GDScript).
시간의 핵이 부서져 떠다니는 섬들로 갈라진 세계에서, 기억을 잃은 검사가 핵 조각을 모읍니다.

**현재 상태: Phase 1 (전투 프로토타입) 완료** — 직접 조작으로 슬라임 구역을 지나 첫 보스 베르단을 쓰러뜨리고
시간의 핵 조각을 얻는 스테이지 1-1이 처음부터 끝까지 플레이 가능합니다.

<p>
<img src="docs/screenshots/01_title.png" width="400" alt="타이틀">
<img src="docs/screenshots/04_elite_slime.png" width="400" alt="강화형 슬라임 전투">
<img src="docs/screenshots/06_boss_intro.png" width="400" alt="보스 등장">
<img src="docs/screenshots/07_boss_telegraph.png" width="400" alt="숲의 분노 공격 예고">
<img src="docs/screenshots/08_ultimate_cutin.png" width="400" alt="궁극기 컷인">
<img src="docs/screenshots/10_stage_clear.png" width="400" alt="스테이지 클리어">
</p>

## 실행

1. [Godot 4.7](https://godotengine.org/download) (표준판, .NET 아님) 설치 — 4.7.2에서 개발·테스트했습니다.
2. Godot에서 이 `chronicle/` 폴더의 `project.godot`를 엽니다.
3. F5로 실행 (메인 씬: `scenes/boot/title.tscn`).

PC에서는 마우스 클릭이 터치로 처리되어 화면의 터치 버튼도 그대로 시험할 수 있습니다.

| 동작 | 터치 | 키보드 | 게임패드 |
|---|---|---|---|
| 이동 (살짝: 걷기 / 끝까지: 달리기) | 왼쪽 가상 조이스틱 | A/D, ←/→ | 왼쪽 스틱 |
| 점프 (길게 누르면 더 높이) | 점프 | Space, K | A |
| 공격 (연타: 3단 콤보, 꾹 눌렀다 떼기: 강공격) | 공격 | J, Z | X |
| 회피 (무적 시간) | 회피 | L, X, Shift | B, RB |
| 스킬 '청월참' (마나 15) | 스킬 | U, C | Y |
| 궁극기 '청월강림' (게이지 100%) | 궁극기 | I, V | LB |
| 일시정지·설정 | 우측 상단 ‖ | Esc, P | Start |

## Phase 1 구현 내용

- **주인공 (청월의 검사)**: 상태 머신(지상·공중·공격·충전·강공격·회피·스킬·궁극기·피격·사망), 가속/감속, 가변 점프, 코요테 타임, 입력 버퍼, 3단 콤보, 공중 베기, 충전 강공격, 무적 회피와 잔상, 초승달 검기 스킬(마나·쿨다운), 컷인 연출 궁극기(4연타 광역), 피격 넉백·무적 깜빡임, 구덩이 낙하 시 피해 후 복귀.
- **숲의 정령 슬라임**: 일반(슬라임 탄 + 범위 튀김) / 소형(빠름, 근접만) / 강화형(자수정 슬라임: 3방향 탄, 넓은 튀김, 슈퍼아머). 대기 → 순찰 → 추격 → 공격 / 점프 추격 / 피격 / 사망 상태 머신, 회복 구슬 드롭.
- **중간 보스 베르단**: 등장 연출 후 나무 던지기·뿌리 돌진·숲의 분노 3패턴. **모든 공격에 예고(주황 섬광 + 바닥 경고)** 를 넣어 피할 수 있게 했고, 경직(그로기) 시스템, HP 50%에서 2페이즈(포효, 빨라진 예고, 2연속 통나무, 양방향 뿌리, 2파 분출), 사망 연출.
- **스테이지 1-1 잊혀진 숲**: 텍스트 레벨 데이터(`data/levels/forest_stage_01.txt`) → 자동 타일링, 일방향 발판, 구덩이, 튜토리얼 표지판 7개, 체크포인트(시간 결정), 보스 경기장(문이 닫힘), 시간의 핵 조각 → 클리어 화면.
- **모바일 조작**: 손가락마다 컨트롤 하나에 고정되는 멀티터치(버튼 간 간섭 없음), 아날로그 조이스틱(유동/고정 선택), 큰 버튼, 쿨다운·마나 부족·궁극기 준비 표시, UI 크기 80~140%, 디스플레이 안전 영역 대응, 가로 화면, 어떤 화면 비율에서도 확장(expand) 레이아웃.
- **연출**: 히트스톱, 화면 흔들림, 피격 섬광 셰이더, 피해 숫자, 콤보 카운터, 4단 패럴랙스 배경, 반딧불·낙엽 파티클, 진동(설정에서 끔).
- **UI**: HUD(초상화·HP·MP·궁극기·보스 바), 보스 등장 배너, 토스트, 일시정지·설정, 게임오버(체크포인트 재도전)·클리어 화면, 타이틀.

## 폴더 구조

```
chronicle/
├── project.godot
├── scenes/   boot/ world/ player/ enemies/ bosses/ ui/ (village/ pets/ effects/: 다음 단계)
├── scripts/  core/ player/ combat/ enemies/ bosses/ world/ ui/ effects/ inventory/
│             (progression/ quests/ pets/ save/: 다음 단계)
├── assets/   characters/ enemies/ bosses/ effects/ environments/ ui/ (npcs/ pets/ weapons/ audio/: 다음 단계)
├── data/     items/ skills/ enemies/ player/ levels/ (quests/ pets/: 다음 단계)
├── tests/    자동 테스트 (test_*.gd)
├── docs/     ASSET_ANALYSIS.md, PHASE1_REPORT.md, screenshots/
├── tools/    에셋 파이프라인 (Python + Godot 스크립트)
└── art_source/  original/ (첨부 원본, 수정 금지) cleaned/ preview/
```

수치(능력치, 공격 판정·타이밍, 몬스터 스탯)는 모두 `data/`의 `.tres` 리소스에 있어 코드 수정 없이 조정할 수 있습니다.
무기는 `WeaponData`(콤보·공중·강공격·스킬·궁극기 묶음)로 정의되어 있어, 무기를 바꾸면 공격 방식이 통째로 바뀌는 구조입니다.

## 에셋 파이프라인

첨부 이미지 6장의 분석 결과와 프레임 매핑은 [docs/ASSET_ANALYSIS.md](docs/ASSET_ANALYSIS.md)에 있습니다.

```bash
pip install pillow numpy opencv-python-headless
python3 tools/clean_sheets.py        # 1. 라벨·가짜 배경 제거 → art_source/cleaned/
python3 tools/build_sprites.py       # 2. 프레임 추출·축소·팔레트·외곽선·정렬 → assets/**/_atlas.png + _sprites.json
python3 tools/build_environment.py   # 3. 타일·배경·소품·UI 아이콘 (절차 생성)
godot --headless --path . --import
godot --headless --path . -s res://tools/build_sprite_frames.gd   # 4. JSON → SpriteFrames(.tres)
```

## 테스트

```bash
# 자동 테스트 (46개, 약 2초)
godot --headless --path . --fixed-fps 60 res://tests/test_runner.tscn

# 자동 플레이 봇: 타이틀부터 보스 처치·클리어까지 입력만으로 플레이 (성공 시 종료 코드 0)
godot --headless --path . --fixed-fps 60 -- --bot

# 화면 캡처 포함 (렌더러 필요, 리눅스 서버에서는 xvfb-run)
godot --path . --fixed-fps 60 -- --bot --screenshots=/tmp/shots
```

## 라이선스 / 크레딧

- 캐릭터·몬스터·보스·NPC·펫 디자인: 프로젝트 제공 참고 이미지 (`art_source/original/`).
- 폰트: [Galmuri](https://github.com/quiple/galmuri) by Lee Minseo — SIL Open Font License 1.1 (`assets/ui/fonts/OFL-Galmuri.md`).
- 지형·배경·UI 아이콘: `tools/build_environment.py`로 생성한 임시 아트 (Phase 4에서 교체 예정).
