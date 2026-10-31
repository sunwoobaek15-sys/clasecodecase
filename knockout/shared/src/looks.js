// 캐릭터 커스터마이징 옵션 (외형 전용, 능력치 영향 없음)
export const COLORS = [
  { id: 'red', name: '토마토', hex: 0xff4d5e },
  { id: 'blue', name: '하늘', hex: 0x3fa7ff },
  { id: 'yellow', name: '바나나', hex: 0xffd23f },
  { id: 'green', name: '라임', hex: 0x52d273 },
  { id: 'purple', name: '포도', hex: 0xa66bff },
  { id: 'orange', name: '귤', hex: 0xff9a3c },
  { id: 'pink', name: '솜사탕', hex: 0xff7ac8 },
  { id: 'cyan', name: '민트', hex: 0x38e0d4 },
  { id: 'white', name: '눈송이', hex: 0xf2f4fa },
  { id: 'black', name: '먹물', hex: 0x3b3f4c },
];
export const HATS = [
  { id: 'none', name: '없음' },
  { id: 'party', name: '파티 모자' },
  { id: 'crown', name: '왕관' },
  { id: 'tophat', name: '실크햇' },
  { id: 'cap', name: '야구모자' },
  { id: 'beanie', name: '비니' },
  { id: 'horns', name: '뿔' },
  { id: 'propeller', name: '프로펠러' },
];
export const OUTFITS = [
  { id: 'none', name: '없음' },
  { id: 'scarf', name: '목도리' },
  { id: 'belt', name: '챔피언 벨트' },
  { id: 'cape', name: '망토' },
  { id: 'overalls', name: '멜빵' },
  { id: 'stripes', name: '줄무늬' },
];
export const ACCESSORIES = [
  { id: 'none', name: '없음' },
  { id: 'glasses', name: '안경' },
  { id: 'shades', name: '선글라스' },
  { id: 'bowtie', name: '나비넥타이' },
  { id: 'backpack', name: '배낭' },
  { id: 'mustache', name: '콧수염' },
];
export const EMOTES = [
  { id: 'jump', name: '방방 점프' },
  { id: 'spin', name: '회전' },
  { id: 'wave', name: '손 흔들기' },
  { id: 'flex', name: '근육 자랑' },
  { id: 'dance', name: '댄스' },
];

const ids = (list) => list.map((o) => o.id);
const pick = (list, v, fallback) => (ids(list).includes(v) ? v : fallback);

export function sanitizeLook(look = {}) {
  return {
    color: pick(COLORS, look.color, COLORS[0].id),
    hat: pick(HATS, look.hat, 'none'),
    outfit: pick(OUTFITS, look.outfit, 'none'),
    acc: pick(ACCESSORIES, look.acc, 'none'),
    emote: pick(EMOTES, look.emote, 'jump'),
  };
}

export function colorHex(id) {
  return (COLORS.find((c) => c.id === id) || COLORS[0]).hex;
}

export function randomLook(rand = Math.random) {
  const r = (list) => list[Math.floor(rand() * list.length)].id;
  return { color: r(COLORS), hat: r(HATS), outfit: r(OUTFITS), acc: r(ACCESSORIES), emote: r(EMOTES) };
}
