// 서버와 클라이언트가 함께 사용하는 게임 상수.
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const NAME_MAX = 12;
export const ROOM_CODE_LENGTH = 4;

export const COUNTDOWN_SEC = 3;
export const RESULTS_SEC = 25;
export const RECONNECT_GRACE_SEC = 30;

export const PHYS = {
  radius: 0.55,
  height: 1.5,
  gravity: 28,
  fallGravityMul: 1.55,
  jumpCutMul: 2.6,
  jumpVel: 10,
  moveSpeed: 7.5,
  groundAccel: 55,
  groundDecel: 42,
  airAccel: 16,
  slideFrictionGround: 4.2,
  slideFrictionAir: 0.55,
  turnRate: 14,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  stepUp: 0.45,
  snapDown: 0.5,
  dashSpeed: 19,
  dashTime: 0.2,
  dashCooldown: 2.0,
  stunControl: 0.25,
  elimY: -14,
  belowFloorY: -1.0,
};

// 충돌/넉백 튜닝
export const KNOCK = {
  restitution: 0.3,
  baseBump: 2.5,
  dashBonus: 3,
  dashRecoil: 0.25,
  airBonus: 1.2,
  popBase: 1.6,
  popFactor: 0.09,
  popMax: 4.2,
  stunBase: 0.12,
  stunFactor: 0.03,
  stunMax: 0.8,
  pairCooldown: 0.22,
  minClosing: 1.2,
};

// 한 번 맞으면 hitCd 동안 막대와 상호작용하지 않는다 → 막대에 끌려다니며 연속으로 맞지 않는다
export const SWEEPER = { r0: 5.8, r1: 15.6, y0: 0.2, y1: 1.0, halfWidth: 0.32, speed: 1.2, push: 9, maxPush: 13, pop: 8.5, stun: 0.5, hitCd: 1.0 };
export const WIND = { airAccel: 9, groundDrift: 3.4 };

// 방해꾼(탈락자/완주자) 번개 폭탄
export const GHOST = { speed: 15, cooldown: 6, fuse: 1.1, radius: 3.3, push: 11, pop: 6.5, stun: 0.6, height: 7 };

// 쇼 모드 라운드 정보
export const ROUNDS = {
  race: { name: '터보 레이스', desc: '장애물을 뚫고 결승선을 통과하세요! 떨어지면 체크포인트에서 다시 시작합니다.', goal: 'finish' },
  survival: { name: '넉아웃 아레나', desc: '서로 밀어내세요! 목표 인원만 남으면 생존자 전원 통과.', goal: 'survive' },
  final: { name: '결승: 최후의 섬', desc: '마지막 한 명만이 챔피언! 경기장이 빠르게 무너집니다.', goal: 'last' },
  classic: { name: '클래식 넉아웃', desc: '마지막까지 살아남으세요!', goal: 'last' },
};
