// 오프라인 모드: 게임 서버(방/경기/봇 로직)를 브라우저 안에서 그대로 실행한다.
// 서버 없이 HTML 파일 하나로 봇과 플레이할 수 있게 해 준다. 온라인 대전은 실제 서버가 필요하다.
export const OFFLINE = import.meta.env.VITE_OFFLINE === '1';

let managerPromise = null;
function getManager() {
  if (!managerPromise) {
    managerPromise = Promise.all([
      import('../../../server/src/rooms/RoomManager.js'),
      import('../../../shared/src/constants.js'),
    ]).then(([{ RoomManager }, { DT }]) => {
      const manager = new RoomManager();
      let last = performance.now(), acc = 0;
      setInterval(() => {
        const now = performance.now();
        acc = Math.min(0.25, acc + (now - last) / 1000);
        last = now;
        while (acc >= DT) { acc -= DT; manager.update(); }
      }, 8);
      return manager;
    });
  }
  return managerPromise;
}

/** WebSocket과 같은 인터페이스를 가진 브라우저 내부 연결 */
export function createLocalSocket() {
  const sock = {
    readyState: 0,
    onopen: null, onmessage: null, onclose: null, onerror: null,
    player: null,
    send(data) {
      if (sock.readyState !== 1) return;
      getManager().then((m) => m.handle(conn, JSON.parse(data)));
    },
    close() { sock.readyState = 3; },
  };
  // 서버 쪽에서 보는 연결 객체
  const conn = {
    readyState: 1,
    player: null,
    send(str) { queueMicrotask(() => sock.onmessage && sock.onmessage({ data: str })); },
    close() {},
  };
  getManager().then(() => {
    sock.readyState = 1;
    sock.onopen && sock.onopen();
  });
  return sock;
}
