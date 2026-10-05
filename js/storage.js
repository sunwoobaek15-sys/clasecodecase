/* SAVE CITY — 저장소: 게임 데이터는 localStorage, 사진은 IndexedDB */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});

  const KEY = 'savecity.v1';
  const CORRUPT_PREFIX = 'savecity.corrupt.';
  // 저장할 때마다 내용으로 만든 확인값(seal)을 끝에 붙여 둡니다. 게임 밖에서 값을 고치면 확인값이 맞지 않아요.
  // 비밀 열쇠가 아니라서 완벽한 보호는 아니지만, 저장 데이터를 직접 고치는 가장 쉬운 치트를 알아볼 수 있어요.
  const SEAL_KEY = '_seal';
  const SEAL_SALT = 'savecity.seal.v1';
  const SEAL_TAIL = /,"_seal":"([0-9a-z]{1,20})"\}$/;

  function sealOf(body) {
    return SC.util.hash(body + SEAL_SALT);
  }

  /** 상태 → 확인값이 붙은 저장 문자열 */
  function seal(state) {
    const body = JSON.stringify(state);
    if (body.length < 3 || body[body.length - 1] !== '}') return body;
    return body.slice(0, -1) + ',"' + SEAL_KEY + '":"' + sealOf(body) + '"}';
  }

  /**
   * 저장 문자열의 확인값 검사 → true(맞음) | false(바뀜) | null(확인값 없는 예전 데이터)
   * 확인값을 지워도 예전에 확인값을 붙인 적이 있는 데이터(security.sealed)면 바뀐 것으로 봐요.
   */
  function checkSeal(text, raw) {
    const m = SEAL_TAIL.exec(text);
    if (m) return sealOf(text.slice(0, m.index) + '}') === m[1];
    return raw && raw.security && raw.security.sealed === true ? false : null;
  }
  const IMG_DB = 'savecity-images';
  const IMG_STORE = 'images';

  function probeLocalStorage() {
    try {
      const k = '__savecity_probe__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  const storage = {
    KEY,
    seal,
    checkSeal,
    available: false,
    lastError: null,
    lastSavedAt: null,

    init() {
      this.available = probeLocalStorage();
      return this.available;
    },

    /** { raw, status: 'ok' | 'empty' | 'corrupt' | 'unavailable', sealOk: true | false | null } */
    load() {
      if (!this.available) return { raw: null, status: 'unavailable' };
      let text;
      try {
        text = root.localStorage.getItem(KEY);
      } catch (e) {
        return { raw: null, status: 'unavailable' };
      }
      if (text == null) return { raw: null, status: 'empty' };
      try {
        const raw = JSON.parse(text);
        return { raw, status: 'ok', sealOk: checkSeal(text, raw) };
      } catch (e) {
        this.keepCorrupt(text);
        return { raw: null, status: 'corrupt' };
      }
    },

    /** 손상된 데이터는 지우지 않고 따로 보관합니다 (최대 3개). */
    keepCorrupt(text) {
      try {
        const old = [];
        for (let i = 0; i < root.localStorage.length; i++) {
          const k = root.localStorage.key(i);
          if (k && k.indexOf(CORRUPT_PREFIX) === 0) old.push(k);
        }
        old.sort();
        while (old.length >= 3) root.localStorage.removeItem(old.shift());
        root.localStorage.setItem(CORRUPT_PREFIX + Date.now(), text);
      } catch (e) {
        /* 보관 실패는 무시 */
      }
    },

    save(state) {
      if (!this.available) return false;
      try {
        root.localStorage.setItem(KEY, seal(state));
        this.lastSavedAt = new Date();
        this.lastError = null;
        return true;
      } catch (e) {
        this.lastError = e;
        return false;
      }
    },

    clear() {
      try {
        root.localStorage.removeItem(KEY);
      } catch (e) {
        /* 무시 */
      }
    },
  };

  /* ---------------- 사진 (IndexedDB) ---------------- */

  let dbPromise = null;
  const IDB_TIMEOUT = 8000;

  /** IndexedDB가 응답하지 않아도 앱이 멈추지 않도록 시간 제한을 둡니다. */
  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('IndexedDB 응답 없음')), ms || IDB_TIMEOUT);
      promise.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        }
      );
    });
  }

  /** Blob → ArrayBuffer (Blob.arrayBuffer가 없는 오래된 Safari도 지원) */
  function blobToBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('파일 읽기 실패'));
      fr.readAsArrayBuffer(blob);
    });
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) {
        reject(new Error('IndexedDB 없음'));
        return;
      }
      let req;
      try {
        req = root.indexedDB.open(IMG_DB, 1);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        // 브라우저가 연결을 끊으면 다음 사용 때 다시 엽니다.
        db.onclose = () => (dbPromise = null);
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('IndexedDB 열기 실패'));
      req.onblocked = () => reject(new Error('IndexedDB 사용 중'));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
    return dbPromise;
  }

  function request(mode, fn) {
    return withTimeout(openDB()).then(
      (db) =>
        new Promise((resolve, reject) => {
          let tx;
          try {
            tx = db.transaction(IMG_STORE, mode);
          } catch (e) {
            dbPromise = null;
            reject(e);
            return;
          }
          const req = fn(tx.objectStore(IMG_STORE));
          tx.oncomplete = () => resolve(req ? req.result : undefined);
          tx.onerror = () => reject(tx.error || new Error('IndexedDB 오류'));
          tx.onabort = () => reject(tx.error || new Error('IndexedDB 중단'));
        })
    );
  }

  const images = {
    usable: null, // null: 아직 모름, true/false: 확인 결과

    probe() {
      return withTimeout(openDB()).then(
        () => (this.usable = true),
        () => (this.usable = false)
      );
    },

    /** Blob을 ArrayBuffer로 바꿔 저장합니다 (오래된 Safari 호환). */
    put(id, blob) {
      return withTimeout(blobToBuffer(blob).then((buf) => request('readwrite', (st) => st.put({ type: blob.type || 'image/jpeg', data: buf, at: Date.now() }, id))));
    },

    get(id) {
      return request('readonly', (st) => st.get(id)).then((v) => (v && v.data ? new Blob([v.data], { type: v.type || 'image/jpeg' }) : null));
    },

    del(id) {
      return request('readwrite', (st) => st.delete(id)).catch(() => undefined);
    },

    keys() {
      return request('readonly', (st) => st.getAllKeys()).then((k) => k || []);
    },

    clear() {
      return request('readwrite', (st) => st.clear()).catch(() => undefined);
    },

    /** 기록이 없는 사진을 정리합니다. */
    prune(validIds) {
      const keep = new Set(validIds);
      return this.keys()
        .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => this.del(k))))
        .catch(() => undefined);
    },
  };

  /** 사진을 최대 800px JPEG로 줄입니다. */
  function resizeImage(file, maxSize, quality) {
    maxSize = maxSize || 800;
    quality = quality || 0.82;
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || '')) {
        reject(new Error('type'));
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        reject(new Error('size'));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const g = canvas.getContext('2d');
          g.fillStyle = '#ffffff';
          g.fillRect(0, 0, w, h);
          g.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', quality);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode'));
      };
      img.src = url;
    });
  }

  SC.storage = storage;
  SC.images = images;
  SC.resizeImage = resizeImage;
})(typeof window !== 'undefined' ? window : globalThis);
