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
  slideFrictionGround: 3.2,
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
  restitution: 0.35,
  baseBump: 3.2,
  speedFactor: 0.95,
  dashBonus: 10.5,
  dashRecoil: 0.25,
  airBonus: 1.2,
  popBase: 2.6,
  popFactor: 0.16,
  popMax: 7.5,
  stunBase: 0.12,
  stunFactor: 0.035,
  stunMax: 0.9,
  pairCooldown: 0.22,
  minClosing: 1.2,
};

export const SWEEPER = { r0: 5.8, r1: 15.6, y0: 0.2, y1: 1.0, halfWidth: 0.32, speed: 1.35, push: 12, pop: 6.5, stun: 0.55 };
export const WIND = { airAccel: 9, groundDrift: 3.4 };
