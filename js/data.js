/* SAVE CITY — 게임 데이터: 규칙 상수, 아이템 카탈로그, 지역, 업적, 칭호 */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});

  const RULES = Object.freeze({
    DAILY_CAP: 50000, // 하루 최대 인정 금액 (원)
    WON_PER_UNIT: 1000, // 1,000원 절약 = 10 TOKEN
    TOKENS_PER_UNIT: 10,
    DAILY_TOKEN_CAP: 500, // 하루 최대 절약 TOKEN
    MAX_INPUT: 100000000, // 입력 가능한 최대 금액 (1억 원)
    MAX_BUILDING_LEVEL: 5,
    LUCKY_BONUS: 20,
    DISCOUNT_PERCENT: 10,
    MAX_CITY_LEVEL: 50,
    ITEM_MAX: 30,
    REASON_MAX: 60,
    MEMO_MAX: 200,
    NICK_MAX: 12,
    LEDGER_MAX: 1000,
    MAX_COUPONS: 99,
    GRID: 6,
  });

  const CATEGORIES = [
    { id: 'clothes', label: '옷·패션', icon: '👕' },
    { id: 'food', label: '배달·외식', icon: '🍔' },
    { id: 'cafe', label: '카페·간식', icon: '☕' },
    { id: 'game', label: '게임·취미', icon: '🎮' },
    { id: 'shopping', label: '쇼핑', icon: '🛍️' },
    { id: 'transport', label: '교통', icon: '🚕' },
    { id: 'digital', label: '전자·구독', icon: '📱' },
    { id: 'etc', label: '기타', icon: '🎁' },
  ];
  const CHECKIN_CATEGORY = { id: 'checkin', label: '0원 기록', icon: '🗓️' };

  /** 카테고리를 고르지 않았을 때 항목 이름으로 추측 */
  const CATEGORY_HINTS = [
    ['clothes', /옷|티셔츠|후드|바지|청바지|신발|운동화|패딩|셔츠|코트|자켓|재킷|가방|모자|원피스|치마|니트/],
    ['food', /배달|치킨|피자|햄버거|버거|떡볶이|외식|야식|라면|족발|보쌈|마라|초밥|회|분식|도시락|편의점/],
    ['cafe', /커피|카페|음료|라떼|아메리카노|빵|디저트|간식|과자|아이스크림|케이크|버블티|스무디|주스/],
    ['game', /게임|아이템|가챠|뽑기|현질|피규어|굿즈|웹툰|만화|취미/],
    ['transport', /택시|버스|기차|주유|킥보드|따릉이|지하철/],
    ['digital', /구독|넷플릭스|유튜브|앱|폰|이어폰|충전기|노트북|태블릿|게임기/],
    ['shopping', /쇼핑|화장품|쿠팡|마트|생필품|향수|액세서리|다이소/],
  ];

  const REASON_CHIPS = ['이미 비슷한 게 있어요', '집에서 해결했어요', '충동구매였어요', '더 싼 방법을 찾았어요', '꼭 필요하지 않았어요'];

  /** 기획서 9. 절약 기록 예시 */
  const EXAMPLES = [
    { item: '후드티', amount: 49000, reason: '이미 비슷한 옷이 있어서 구매하지 않음', category: 'clothes' },
    { item: '배달음식', amount: 18000, reason: '집에서 먹음', category: 'food' },
    { item: '게임 아이템', amount: 12000, reason: '이번에는 구매하지 않음', category: 'game' },
    { item: '카페 음료', amount: 5000, reason: '집에서 물을 마심', category: 'cafe' },
  ];

  const AVATARS = ['🐷', '🐱', '🐶', '🦊', '🐻', '🐰', '🐼', '🐯', '🐸', '🐧'];

  /*
   * 아이템 카탈로그
   *  cat: building(업그레이드 Lv.1~5) | decoration | landmark | vehicle | skin | special(보상 전용)
   *  value: 도시 가치 (건물은 value × 레벨)
   *  unlock: { level } 도시 레벨 조건 | { item, itemLevel } 건물 업그레이드 조건
   */
  const ITEMS = [
    // BUILDINGS — 기획서 12. 건물 가격 예시
    { id: 'house', cat: 'building', name: '작은 집', en: 'Small House', price: 100, value: 25, sign: '🏠', desc: '아늑한 첫 보금자리예요. Lv.5가 되면 벚꽃나무 장식이 열려요.' },
    { id: 'shop', cat: 'building', name: '작은 상점', en: 'Small Shop', price: 300, value: 75, sign: '🏪', unlock: { level: 5 }, desc: '동네 사람들이 들르는 가게예요. Lv.5가 되면 네온 사인 장식이 열려요.' },
    { id: 'cafe', cat: 'building', name: '카페', en: 'Cafe', price: 600, value: 150, sign: '☕', unlock: { level: 5 }, desc: '커피 향이 나는 카페예요. Lv.3이 되면 파라솔 장식이 열려요.' },
    { id: 'park', cat: 'building', name: '공원', en: 'Park', price: 800, value: 200, sign: '🌳', unlock: { level: 3 }, desc: '나무와 산책로가 있는 공원이에요. Lv.3이 되면 분수 장식이 열려요.' },
    { id: 'market', cat: 'building', name: '슈퍼마켓', en: 'Supermarket', price: 1500, value: 375, sign: '🛒', unlock: { level: 7 }, desc: '장보기를 책임지는 큰 마트예요.' },
    { id: 'office', cat: 'building', name: '오피스', en: 'Office', price: 3000, value: 750, sign: '💼', unlock: { level: 10 }, desc: '유리창이 반짝이는 업무 빌딩이에요. Lv.3이 되면 동상 장식이 열려요.' },
    { id: 'hotel', cat: 'building', name: '호텔', en: 'Hotel', price: 5000, value: 1250, sign: '🏨', unlock: { level: 15 }, desc: '여행객이 머무는 높은 호텔이에요.' },
    { id: 'mall', cat: 'building', name: '쇼핑몰', en: 'Shopping Mall', price: 8000, value: 2000, sign: '🛍️', unlock: { level: 20 }, desc: '도시의 쇼핑 중심지예요.' },
    { id: 'tower', cat: 'building', name: '대형 빌딩', en: 'Skyscraper', price: 12000, value: 3000, sign: '🏙️', unlock: { level: 20 }, desc: '구름에 닿을 듯한 초고층 빌딩이에요.' },

    // DECORATIONS
    { id: 'tree', cat: 'decoration', name: '나무', en: 'Tree', price: 50, value: 25, desc: '초록 잎이 무성한 나무예요.' },
    { id: 'bench', cat: 'decoration', name: '벤치', en: 'Bench', price: 80, value: 40, desc: '잠깐 쉬어 가는 벤치예요.' },
    { id: 'lamp', cat: 'decoration', name: '가로등', en: 'Lamp', price: 100, value: 50, desc: '밤길을 밝혀 주는 가로등이에요.' },
    { id: 'flower', cat: 'decoration', name: '꽃밭', en: 'Flower', price: 120, value: 60, desc: '알록달록한 꽃밭이에요.' },
    { id: 'parasol', cat: 'decoration', name: '파라솔', en: 'Parasol', price: 250, value: 125, unlock: { item: 'cafe', itemLevel: 3 }, desc: '카페 앞 야외 테이블이에요.' },
    { id: 'sakura', cat: 'decoration', name: '벚꽃나무', en: 'Cherry Tree', price: 300, value: 150, unlock: { item: 'house', itemLevel: 5 }, desc: '분홍 꽃잎이 흩날리는 나무예요.' },
    { id: 'fountain', cat: 'decoration', name: '분수', en: 'Fountain', price: 400, value: 200, unlock: { item: 'park', itemLevel: 3 }, desc: '시원한 물줄기가 솟는 분수예요.' },
    { id: 'neon', cat: 'decoration', name: '네온 사인', en: 'Neon Sign', price: 500, value: 250, unlock: { item: 'shop', itemLevel: 5 }, desc: '밤에 더 빛나는 간판이에요.' },
    { id: 'statue', cat: 'decoration', name: '동상', en: 'Statue', price: 600, value: 300, unlock: { item: 'office', itemLevel: 3 }, desc: '광장을 지키는 동상이에요.' },

    // LANDMARKS
    { id: 'monument', cat: 'landmark', name: '기념비', en: 'Monument', price: 2000, value: 1000, unlock: { level: 8 }, desc: '첫 절약을 기념하는 탑이에요.' },
    { id: 'clocktower', cat: 'landmark', name: '시계탑', en: 'Clock Tower', price: 6000, value: 3000, unlock: { level: 12 }, desc: '도시의 시간을 알려 주는 시계탑이에요.' },
    { id: 'ferris', cat: 'landmark', name: '대관람차', en: 'Ferris Wheel', price: 10000, value: 5000, unlock: { level: 18 }, desc: '도시 전체가 내려다보이는 관람차예요.' },
    { id: 'savetower', cat: 'landmark', name: 'SAVE 타워', en: 'SAVE Tower', price: 20000, value: 10000, unlock: { level: 25 }, desc: '꼭대기에 황금 동전이 빛나는 랜드마크예요.' },
    { id: 'spaceport', cat: 'landmark', name: '우주 정거장', en: 'Space Port', price: 30000, value: 15000, unlock: { level: 30 }, desc: '미래 도시의 상징이에요.' },

    // VEHICLES — 도로를 달려요
    { id: 'bicycle', cat: 'vehicle', name: '자전거', en: 'Bicycle', price: 500, value: 250, desc: '도로를 천천히 달리는 자전거예요.' },
    { id: 'car', cat: 'vehicle', name: '소형차', en: 'Small Car', price: 1500, value: 750, unlock: { level: 3 }, desc: '작고 귀여운 자동차예요.' },
    { id: 'taxi', cat: 'vehicle', name: '택시', en: 'Taxi', price: 2500, value: 1250, unlock: { level: 8 }, desc: '노란 택시가 도시를 누벼요.' },
    { id: 'bus', cat: 'vehicle', name: '버스', en: 'Bus', price: 5000, value: 2500, unlock: { level: 10 }, desc: '많은 시민을 태우는 버스예요.' },
    { id: 'flycar', cat: 'vehicle', name: '비행 자동차', en: 'Flying Car', price: 12000, value: 6000, unlock: { level: 30 }, desc: '하늘을 나는 미래의 자동차예요.' },

    // SKINS — 도시 전체 분위기
    { id: 'default', cat: 'skin', name: '기본 도시', en: 'Classic', price: 0, value: 0, desc: '맑은 하늘의 기본 도시예요.' },
    { id: 'spring', cat: 'skin', name: '봄 벚꽃', en: 'Spring', price: 800, value: 0, unlock: { level: 3 }, desc: '나무가 분홍빛으로 물들어요.' },
    { id: 'autumn', cat: 'skin', name: '가을 단풍', en: 'Autumn', price: 800, value: 0, unlock: { level: 5 }, desc: '나무와 잔디가 단풍색으로 바뀌어요.' },
    { id: 'winter', cat: 'skin', name: '겨울 눈꽃', en: 'Winter', price: 1200, value: 0, unlock: { level: 8 }, desc: '하얀 눈이 도시를 덮어요.' },
    { id: 'night', cat: 'skin', name: '밤의 도시', en: 'Night', price: 2000, value: 0, unlock: { level: 12 }, desc: '창문과 가로등에 불이 켜져요.' },
    { id: 'gold', cat: 'skin', name: '황금 도시', en: 'Golden', price: 5000, value: 0, unlock: { level: 20 }, desc: '도시가 황금빛으로 반짝여요.' },

    // SPECIAL — 판매하지 않는 보상 장식
    { id: 'golden_piggy', cat: 'special', name: '황금 저금통', en: 'Golden Piggy', price: 0, value: 500, desc: '30일 연속 기록 보상으로 받아요.' },
    { id: 'trophy', cat: 'special', name: '트로피 조형물', en: 'Trophy', price: 0, value: 400, desc: "업적 '기록의 전설' 보상으로 받아요." },
    { id: 'rainbow', cat: 'special', name: '무지개 아치', en: 'Rainbow Arch', price: 0, value: 600, desc: "업적 '100만원 절약' 보상으로 받아요." },
    { id: 'star_monument', cat: 'special', name: '별빛 기념탑', en: 'Star Monument', price: 0, value: 800, desc: "업적 '수집가' 보상으로 받아요." },
  ];

  const SHOP_TABS = [
    { id: 'building', label: '건물', en: 'BUILDINGS' },
    { id: 'decoration', label: '장식', en: 'DECORATIONS' },
    { id: 'vehicle', label: '탈것', en: 'VEHICLES' },
    { id: 'landmark', label: '랜드마크', en: 'LANDMARKS' },
    { id: 'skin', label: '스킨', en: 'SKINS' },
  ];

  const COLLECTION_GROUPS = [
    { id: 'building', label: '건물' },
    { id: 'decoration', label: '장식' },
    { id: 'vehicle', label: '탈것' },
    { id: 'landmark', label: '랜드마크' },
    { id: 'skin', label: '스킨' },
    { id: 'special', label: '특별 보상' },
  ];

  /*
   * 지역 지도 (6×6). '.' 빈 땅, 'R' 도로, 'W' 물
   * 인덱스 = 행 × 6 + 열
   */
  const REGIONS = [
    {
      id: 'village', no: 1, name: '작은 마을', level: 1, ground: 'grass',
      desc: '모든 이야기가 시작되는 조용한 마을',
      map: ['..R..W', '..R...', 'RRRRRR', '..R...', '..R...', '..R...'],
    },
    {
      id: 'commerce', no: 2, name: '상업 지구', level: 10, ground: 'paved',
      desc: '가게와 카페가 늘어선 활기찬 거리',
      map: ['...R..', '...R..', 'RRRRRR', '...R..', 'RRRRRR', '...R..'],
    },
    {
      id: 'downtown', no: 3, name: '번화가', level: 15, ground: 'plaza',
      desc: '높은 빌딩이 모이는 도시의 중심',
      map: ['.R..R.', '.R..R.', 'RRRRRR', '.R..R.', '.R..R.', '.R..R.'],
    },
    {
      id: 'industry', no: 4, name: '산업 지구', level: 20, ground: 'concrete',
      desc: '큰 건물을 세울 수 있는 넓은 부지',
      map: ['......', '.RRRR.', '.R..R.', '.R..R.', '.RRRR.', '......'],
    },
    {
      id: 'future', no: 5, name: '미래 도시', level: 30, ground: 'neon',
      desc: '빛나는 도로 위의 미래 도시',
      map: ['......', '.RRRR.', '.R..R.', 'RR..RR', '.RRRR.', '......'],
    },
  ];
  for (const r of REGIONS) {
    r.tiles = r.map.join('').split('').map((ch) => (ch === 'R' ? 'road' : ch === 'W' ? 'water' : 'plot'));
    r.plots = r.tiles.reduce((n, t) => n + (t === 'plot' ? 1 : 0), 0);
  }

  /** 기획서 14. 도시 레벨 */
  const LEVEL_ROADMAP = [
    { level: 1, title: '작은 마을', text: '작은 집, 나무, 벤치를 지을 수 있어요.' },
    { level: 5, title: '상업 건물 해금', text: '작은 상점과 카페를 지을 수 있어요.' },
    { level: 10, title: '상업 지구 해금', text: '두 번째 지역과 오피스, 버스가 열려요.' },
    { level: 20, title: '대형 건물 해금', text: '쇼핑몰과 대형 빌딩, 산업 지구가 열려요.' },
    { level: 30, title: '미래 도시 해금', text: '미래 도시와 우주 정거장이 열려요.' },
  ];

  /** 기획서 16. 연속 기록 STREAK */
  const STREAK_TRACK = [1, 2, 3, 4, 5, 7, 14, 30];
  const STREAK_REWARDS = {
    7: { tokens: 100 },
    14: { tokens: 250 },
    30: { special: 'golden_piggy' },
  };

  const TITLES = [
    { id: 'newbie', name: '새내기 시민' },
    { id: 'sprout', name: '절약 새싹' },
    { id: 'steady', name: '꾸준한 시민' },
    { id: 'master', name: '절약 달인' },
    { id: 'thrifty', name: '알뜰 시민' },
    { id: 'habitking', name: '습관의 왕' },
    { id: 'developer', name: '도시 개발자' },
    { id: 'architect', name: '도시 건축가' },
    { id: 'pioneer', name: '지역 개척자' },
    { id: 'collector', name: '수집가' },
    { id: 'savegod', name: '절약의 신' },
    { id: 'king', name: '도시의 왕' },
  ];

  /*
   * 업적 (40개) — metric은 engine.metricValue()가 계산하는 값의 이름
   * 보상: 배지(업적 자체), TOKEN, 특별 장식, 프로필 칭호
   */
  const ACHIEVEMENTS = [
    // 절약
    { id: 'first_save', group: 'save', icon: '🌱', name: '첫 절약', desc: '절약을 처음 기록하기', metric: 'records', target: 1, reward: { tokens: 50, title: 'sprout' } },
    { id: 'first_token', group: 'save', icon: '🪙', name: '첫 TOKEN', desc: '절약으로 TOKEN을 처음 받기', metric: 'saveTokens', target: 1, reward: { tokens: 10 } },
    { id: 'saves_10', group: 'save', icon: '📒', name: '절약 습관', desc: '절약 기록 10회', metric: 'records', target: 10, reward: { tokens: 100 } },
    { id: 'saves_50', group: 'save', icon: '📚', name: '절약 달인', desc: '절약 기록 50회', metric: 'records', target: 50, reward: { tokens: 300, title: 'master' } },
    { id: 'saves_100', group: 'save', icon: '🏆', name: '기록의 전설', desc: '절약 기록 100회', metric: 'records', target: 100, reward: { tokens: 500, special: 'trophy' } },
    { id: 'saved_100k', group: 'save', icon: '💵', name: '10만원 절약', desc: '누적 인정 금액 100,000원', metric: 'totalRecognized', target: 100000, reward: { tokens: 100 } },
    { id: 'saved_500k', group: 'save', icon: '💰', name: '50만원 절약', desc: '누적 인정 금액 500,000원', metric: 'totalRecognized', target: 500000, reward: { tokens: 300, title: 'thrifty' } },
    { id: 'saved_1m', group: 'save', icon: '🌈', name: '100만원 절약', desc: '누적 인정 금액 1,000,000원', metric: 'totalRecognized', target: 1000000, reward: { tokens: 500, special: 'rainbow' } },
    { id: 'saved_3m', group: 'save', icon: '👑', name: '300만원 절약', desc: '누적 인정 금액 3,000,000원', metric: 'totalRecognized', target: 3000000, reward: { tokens: 1000, title: 'savegod' } },
    { id: 'full_day', group: 'save', icon: '⚡', name: '꽉 채운 하루', desc: '하루 인정 금액 50,000원 채우기', metric: 'maxDayRecognized', target: 50000, reward: { tokens: 50 } },
    { id: 'big_save', group: 'save', icon: '💪', name: '큰 결심', desc: '한 번에 30,000원 이상 절약하기', metric: 'maxSingle', target: 30000, reward: { tokens: 30 } },
    { id: 'small_10', group: 'save', icon: '🐜', name: '티끌 모아 태산', desc: '5,000원 이하 절약 10회', metric: 'smallSaves', target: 10, reward: { tokens: 50 } },
    { id: 'categories_5', group: 'save', icon: '🎨', name: '골고루 절약', desc: '5가지 종류에서 절약하기', metric: 'categories', target: 5, reward: { tokens: 100 } },
    { id: 'memo_10', group: 'save', icon: '✍️', name: '기록 장인', desc: '메모를 남긴 기록 10개', metric: 'memos', target: 10, reward: { tokens: 50 } },
    { id: 'photo_1', group: 'save', icon: '📸', name: '인증샷', desc: '사진을 붙인 기록 남기기', metric: 'photos', target: 1, reward: { tokens: 30 } },
    // 연속 기록
    { id: 'streak_3', group: 'streak', icon: '🔥', name: '3일 연속', desc: '3일 연속 기록하기', metric: 'longestStreak', target: 3, reward: { tokens: 30 } },
    { id: 'streak_7', group: 'streak', icon: '📅', name: '7일 연속', desc: '7일 연속 기록하기', metric: 'longestStreak', target: 7, reward: { tokens: 70, title: 'steady' } },
    { id: 'streak_14', group: 'streak', icon: '🌟', name: '14일 연속', desc: '14일 연속 기록하기', metric: 'longestStreak', target: 14, reward: { tokens: 150 } },
    { id: 'streak_30', group: 'streak', icon: '🏅', name: '30일 연속', desc: '30일 연속 기록하기', metric: 'longestStreak', target: 30, reward: { tokens: 300, title: 'habitking' } },
    { id: 'checkin_1', group: 'streak', icon: '🛡️', name: '쉬어가도 괜찮아', desc: '0원 기록으로 STREAK 지키기', metric: 'checkins', target: 1, reward: { tokens: 10 } },
    // 도시
    { id: 'first_building', group: 'city', icon: '🏠', name: '첫 건물', desc: '첫 건물 짓기', metric: 'buildings', target: 1, reward: { tokens: 30 } },
    { id: 'builder_10', group: 'city', icon: '🏗️', name: '도시 개발자', desc: '건물 10채 짓기', metric: 'buildings', target: 10, reward: { tokens: 100, title: 'developer' } },
    { id: 'builder_25', group: 'city', icon: '🏙️', name: '도시 건축가', desc: '건물 25채 짓기', metric: 'buildings', target: 25, reward: { tokens: 250, title: 'architect' } },
    { id: 'first_upgrade', group: 'city', icon: '🔨', name: '첫 리모델링', desc: '건물 업그레이드 1회', metric: 'upgrades', target: 1, reward: { tokens: 30 } },
    { id: 'max_level', group: 'city', icon: '⭐', name: '최고 레벨', desc: '건물 하나를 Lv.5로 만들기', metric: 'maxBuildingLevel', target: 5, reward: { tokens: 100 } },
    { id: 'first_decoration', group: 'city', icon: '🌷', name: '꾸미기 시작', desc: '첫 장식 갖기', metric: 'decorations', target: 1, reward: { tokens: 20 } },
    { id: 'gardener', group: 'city', icon: '🌳', name: '정원사', desc: '장식 20개 모으기', metric: 'decorations', target: 20, reward: { tokens: 100 } },
    { id: 'first_vehicle', group: 'city', icon: '🚲', name: '첫 탈것', desc: '탈것 처음 사기', metric: 'vehicles', target: 1, reward: { tokens: 30 } },
    { id: 'first_landmark', group: 'city', icon: '🗼', name: '랜드마크 건설', desc: '첫 랜드마크 짓기', metric: 'landmarks', target: 1, reward: { tokens: 200 } },
    { id: 'value_10k', group: 'city', icon: '💎', name: '가치 있는 도시', desc: '도시 가치 10,000 달성', metric: 'cityValue', target: 10000, reward: { tokens: 200 } },
    { id: 'level_5', group: 'city', icon: '🏪', name: '상업의 시작', desc: '도시 LEVEL 5 달성', metric: 'cityLevel', target: 5, reward: { tokens: 50 } },
    { id: 'level_10', group: 'city', icon: '🌆', name: '성장하는 도시', desc: '도시 LEVEL 10 달성', metric: 'cityLevel', target: 10, reward: { tokens: 150 } },
    { id: 'level_20', group: 'city', icon: '🌃', name: '대도시', desc: '도시 LEVEL 20 달성', metric: 'cityLevel', target: 20, reward: { tokens: 400 } },
    { id: 'level_30', group: 'city', icon: '👑', name: '도시의 왕', desc: '도시 LEVEL 30 달성', metric: 'cityLevel', target: 30, reward: { tokens: 800, title: 'king' } },
    { id: 'pioneer', group: 'city', icon: '🗺️', name: '지역 개척자', desc: '새로운 지역 해금하기', metric: 'regions', target: 2, reward: { tokens: 100, title: 'pioneer' } },
    { id: 'all_regions', group: 'city', icon: '🌏', name: '모든 지역 정복', desc: '5개 지역 모두 해금하기', metric: 'regions', target: 5, reward: { tokens: 500 } },
    // 수집
    { id: 'first_skin', group: 'collect', icon: '🎀', name: '새 옷 입은 도시', desc: '스킨 구매하기', metric: 'skins', target: 1, reward: { tokens: 30 } },
    { id: 'spender_10k', group: 'collect', icon: '🛍️', name: '통 큰 시장님', desc: 'TOKEN 10,000개 사용하기', metric: 'spent', target: 10000, reward: { tokens: 300 } },
    { id: 'collector', group: 'collect', icon: '📖', name: '수집가', desc: '도감 50% 채우기', metric: 'collectionPct', target: 50, reward: { tokens: 200, title: 'collector', special: 'star_monument' } },
    { id: 'collector_all', group: 'collect', icon: '🏵️', name: '완벽한 수집가', desc: '도감 100% 채우기', metric: 'collectionPct', target: 100, reward: { tokens: 1000 } },
  ];

  const ACHIEVEMENT_GROUPS = [
    { id: 'save', label: '절약' },
    { id: 'streak', label: '연속 기록' },
    { id: 'city', label: '도시' },
    { id: 'collect', label: '수집' },
  ];

  const LEDGER_KINDS = {
    save: '절약',
    edit: '기록 수정',
    delete: '기록 삭제',
    bonus: '보너스',
    streak: 'STREAK',
    achievement: '업적',
    purchase: '구매',
    upgrade: '업그레이드',
  };

  const byId = (list) => list.reduce((m, x) => ((m[x.id] = x), m), {});

  SC.data = {
    RULES,
    CATEGORIES,
    CATEGORY_MAP: byId(CATEGORIES.concat([CHECKIN_CATEGORY])),
    CHECKIN_CATEGORY,
    CATEGORY_HINTS,
    REASON_CHIPS,
    EXAMPLES,
    AVATARS,
    ITEMS,
    ITEM_MAP: byId(ITEMS),
    SHOP_TABS,
    COLLECTION_GROUPS,
    REGIONS,
    REGION_MAP: byId(REGIONS),
    LEVEL_ROADMAP,
    STREAK_TRACK,
    STREAK_REWARDS,
    TITLES,
    TITLE_MAP: byId(TITLES),
    ACHIEVEMENTS,
    ACHIEVEMENT_MAP: byId(ACHIEVEMENTS),
    ACHIEVEMENT_GROUPS,
    LEDGER_KINDS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
