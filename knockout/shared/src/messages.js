// 네트워크 메시지 타입. 짧은 문자열로 전송량을 줄인다.
export const C2S = {
  CREATE: 'create',
  JOIN: 'join',
  RESUME: 'resume',
  LEAVE: 'leave',
  READY: 'ready',
  LOOK: 'look',
  NAME: 'name',
  START: 'start',
  ADD_BOT: 'addBot',
  REMOVE_BOT: 'removeBot',
  INPUT: 'i',
  REMATCH: 'rematch',
  TO_LOBBY: 'toLobby',
  MODE: 'mode',
  PING: 'ping',
};

export const S2C = {
  WELCOME: 'welcome',
  ROOM: 'room',
  ERROR: 'error',
  SNAPSHOT: 's',
  TILES: 'tiles',
  EVENTS: 'events',
  FX: 'fx',
  ELIM: 'elim',
  RESULT: 'result',
  PONG: 'pong',
  KICKED: 'kicked',
  ROUND_END: 'roundEnd',
};

export const PHASE = {
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  INTRO: 'intro',
  ROUND_END: 'roundEnd',
  RESULTS: 'results',
};

// 입력 버튼 비트
export const BTN = { JUMP: 1, DASH: 2 };

// 스냅샷 플레이어 플래그 비트
export const FLAG = { GROUNDED: 1, DASHING: 2, STUNNED: 4, OUT: 8, DISCONNECTED: 16, JUMPCUT: 32, JUMPHELD: 64, FINISHED: 128, JUMPING: 256 };

// 스냅샷 플레이어 배열 인덱스
export const SP = { ID: 0, X: 1, Y: 2, Z: 3, VX: 4, VY: 5, VZ: 6, YAW: 7, FLAGS: 8, DASHT: 9, DASHCD: 10, STUN: 11, COYOTE: 12, JUMPBUF: 13, MOVER: 14, HITCD: 15 };

export const ERR = {
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다. 코드를 확인해 주세요.',
  ROOM_FULL: '방이 가득 찼습니다 (최대 8명).',
  BAD_NAME: '이름을 입력해 주세요.',
  NOT_HOST: '방장만 할 수 있습니다.',
  NOT_ENOUGH: '최소 2명이 필요합니다.',
  NOT_READY: '모든 참가자가 준비해야 합니다.',
  RESUME_FAILED: '이전 세션을 복구할 수 없습니다.',
  BAD_PHASE: '지금은 할 수 없습니다.',
};
