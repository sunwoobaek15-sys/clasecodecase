using System;
using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>이징 함수 모음 (0~1 → 0~1).</summary>
    public static class Ease
    {
        public static float Linear(float t) { return t; }
        public static float InQuad(float t) { return t * t; }
        public static float OutQuad(float t) { return 1f - (1f - t) * (1f - t); }
        public static float InOutQuad(float t) { return t < 0.5f ? 2f * t * t : 1f - Mathf.Pow(-2f * t + 2f, 2f) * 0.5f; }
        public static float OutCubic(float t) { float u = 1f - t; return 1f - u * u * u; }
        public static float InCubic(float t) { return t * t * t; }
        public static float OutBack(float t)
        {
            const float c1 = 1.70158f, c3 = c1 + 1f;
            float u = t - 1f;
            return 1f + c3 * u * u * u + c1 * u * u;
        }
        public static float OutElastic(float t)
        {
            if (t <= 0f) return 0f;
            if (t >= 1f) return 1f;
            const float c4 = 2f * Mathf.PI / 3f;
            return Mathf.Pow(2f, -10f * t) * Mathf.Sin((t * 10f - 0.75f) * c4) + 1f;
        }
        public static float OutBounce(float t)
        {
            const float n1 = 7.5625f, d1 = 2.75f;
            if (t < 1f / d1) return n1 * t * t;
            if (t < 2f / d1) { t -= 1.5f / d1; return n1 * t * t + 0.75f; }
            if (t < 2.5f / d1) { t -= 2.25f / d1; return n1 * t * t + 0.9375f; }
            t -= 2.625f / d1;
            return n1 * t * t + 0.984375f;
        }
        /// <summary>0 → 1 → 0 (흔들기/펀치용).</summary>
        public static float Punch(float t) { return Mathf.Sin(t * Mathf.PI) * (1f - t * 0.3f); }
    }

    /// <summary>
    /// 아주 작은 트윈 엔진 (기본: 언스케일 시간 → 일시정지/슬로모션 중에도 UI 연출이 움직인다).
    /// owner 가 파괴되면 자동으로 정리된다.
    /// </summary>
    public sealed class TweenRunner : MonoBehaviour
    {
        sealed class Tw
        {
            public int id;
            public object owner;
            public UnityEngine.Object unityOwner;
            public bool hasUnityOwner;
            public float elapsed;
            public float duration;
            public float delay;
            public Action<float> step;
            public Func<float, float> ease;
            public Action done;
            public bool unscaled;
            public bool killed;
        }

        readonly List<Tw> _active = new List<Tw>();
        readonly List<Tw> _adding = new List<Tw>();
        int _nextId = 1;
        bool _updating;

        public static TweenRunner Instance { get; private set; }

        void Awake()
        {
            Instance = this;
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        public int To(object owner, float duration, Action<float> step, Func<float, float> ease = null, Action done = null, float delay = 0f, bool unscaled = true)
        {
            var tw = new Tw
            {
                id = _nextId++,
                owner = owner,
                unityOwner = owner as UnityEngine.Object,
                duration = Mathf.Max(0.0001f, duration),
                delay = delay,
                step = step,
                ease = ease ?? Ease.OutQuad,
                done = done,
                unscaled = unscaled,
            };
            tw.hasUnityOwner = tw.unityOwner != null;
            if (_updating) _adding.Add(tw); else _active.Add(tw);
            return tw.id;
        }

        /// <summary>시간만 기다렸다가 콜백.</summary>
        public int Delay(object owner, float seconds, Action done, bool unscaled = true)
        {
            return To(owner, seconds, null, Ease.Linear, done, 0f, unscaled);
        }

        public void Kill(object owner)
        {
            if (owner == null) return;
            foreach (var t in _active) if (ReferenceEquals(t.owner, owner)) t.killed = true;
            foreach (var t in _adding) if (ReferenceEquals(t.owner, owner)) t.killed = true;
        }

        public void KillId(int id)
        {
            foreach (var t in _active) if (t.id == id) t.killed = true;
            foreach (var t in _adding) if (t.id == id) t.killed = true;
        }

        public bool IsRunning(object owner)
        {
            foreach (var t in _active) if (!t.killed && ReferenceEquals(t.owner, owner)) return true;
            foreach (var t in _adding) if (!t.killed && ReferenceEquals(t.owner, owner)) return true;
            return false;
        }

        void Update()
        {
            _updating = true;
            float udt = Time.unscaledDeltaTime;
            float sdt = Time.deltaTime;
            for (int i = 0; i < _active.Count; i++)
            {
                var t = _active[i];
                if (t.killed) continue;
                if (t.hasUnityOwner && t.unityOwner == null) { t.killed = true; continue; }
                float dt = t.unscaled ? udt : sdt;
                if (t.delay > 0f)
                {
                    t.delay -= dt;
                    if (t.delay > 0f) continue;
                    dt = -t.delay;
                    t.delay = 0f;
                }
                t.elapsed += dt;
                float p = Mathf.Clamp01(t.elapsed / t.duration);
                try
                {
                    if (t.step != null) t.step(t.ease(p));
                }
                catch (Exception e)
                {
                    Debug.LogException(e);
                    t.killed = true;
                    continue;
                }
                if (p >= 1f)
                {
                    t.killed = true;
                    if (t.done != null)
                    {
                        try { t.done(); }
                        catch (Exception e) { Debug.LogException(e); }
                    }
                }
            }
            _updating = false;
            _active.RemoveAll(x => x.killed);
            if (_adding.Count > 0)
            {
                _active.AddRange(_adding);
                _adding.Clear();
            }
        }
    }

    /// <summary>자주 쓰는 트윈 단축 함수.</summary>
    public static class Tweens
    {
        static TweenRunner R => TweenRunner.Instance;

        public static void Scale(Transform t, Vector3 from, Vector3 to, float dur, Func<float, float> ease = null, Action done = null, float delay = 0f)
        {
            if (R == null || t == null) { if (t != null) t.localScale = to; if (done != null) done(); return; }
            R.Kill(t);
            t.localScale = from;
            R.To(t, dur, p => { if (t != null) t.localScale = Vector3.LerpUnclamped(from, to, p); }, ease ?? Ease.OutBack, done, delay);
        }

        public static void Fade(CanvasGroup g, float to, float dur, Action done = null, float delay = 0f)
        {
            if (R == null || g == null) { if (g != null) g.alpha = to; if (done != null) done(); return; }
            R.Kill(g);
            float from = g.alpha;
            R.To(g, dur, p => { if (g != null) g.alpha = Mathf.LerpUnclamped(from, to, p); }, Ease.OutQuad, done, delay);
        }

        public static void Move(RectTransform rt, Vector2 to, float dur, Func<float, float> ease = null, Action done = null, float delay = 0f)
        {
            if (R == null || rt == null) { if (rt != null) rt.anchoredPosition = to; if (done != null) done(); return; }
            Vector2 from = rt.anchoredPosition;
            R.To(rt, dur, p => { if (rt != null) rt.anchoredPosition = Vector2.LerpUnclamped(from, to, p); }, ease ?? Ease.OutCubic, done, delay);
        }

        /// <summary>UI 펀치 스케일 (1 → 1+amount → 1).</summary>
        public static void Punch(Transform t, float amount, float dur)
        {
            if (R == null || t == null) return;
            R.Kill(t);
            R.To(t, dur, p => { if (t != null) t.localScale = Vector3.one * (1f + amount * Ease.Punch(p)); }, Ease.Linear, () => { if (t != null) t.localScale = Vector3.one; });
        }

        public static void Wait(object owner, float seconds, Action done, bool unscaled = true)
        {
            if (R == null) { if (done != null) done(); return; }
            R.Delay(owner, seconds, done, unscaled);
        }
    }
}
