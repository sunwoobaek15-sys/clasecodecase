/* SAVE CITY — 저장소: 게임 데이터는 localStorage, 사진은 IndexedDB */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});

  const KEY = 'savecity.v1';
  const CORRUPT_PREFIX = 'savecity.corrupt.';
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
    available: false,
    lastError: null,
    lastSavedAt: null,

    init() {
      this.available = probeLocalStorage();
      return this.available;
    },

    /** { raw, status: 'ok' | 'empty' | 'corrupt' | 'unavailable' } */
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
        return { raw: JSON.parse(text), status: 'ok' };
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
        root.localStorage.setItem(KEY, JSON.stringify(state));
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
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 열기 실패'));
      req.onblocked = () => reject(new Error('IndexedDB 사용 중'));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
    return dbPromise;
  }

  function request(mode, fn) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          let tx;
          try {
            tx = db.transaction(IMG_STORE, mode);
          } catch (e) {
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
      return openDB().then(
        () => (this.usable = true),
        () => (this.usable = false)
      );
    },

    /** Blob을 ArrayBuffer로 바꿔 저장합니다 (오래된 Safari 호환). */
    put(id, blob) {
      return blob.arrayBuffer().then((buf) => request('readwrite', (st) => st.put({ type: blob.type || 'image/jpeg', data: buf, at: Date.now() }, id)));
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
