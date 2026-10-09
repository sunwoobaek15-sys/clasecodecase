using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 가벼운 스프라이트 파티클 풀 (물보라, 물결 링, 반짝이, 꽃가루, 김, 거품, 불씨, 연기, Zzz…).
    /// 렌더 파이프라인과 무관하게 SpriteRenderer 로만 그린다.
    /// </summary>
    public sealed class EffectsManager : MonoBehaviour
    {
        sealed class P
        {
            public Transform tr;
            public SpriteRenderer sr;
            public Vector2 pos;
            public Vector2 vel;
            public float gravity;
            public float drag;
            public float life;
            public float maxLife;
            public float size0;
            public float size1;
            public float rot;
            public float spin;
            public float sway;
            public float squash;
            public Color c0;
            public Color c1;
            public bool alive;
            public bool unscaled;
        }

        const int MaxParticles = 420;
        readonly List<P> _all = new List<P>();
        readonly Stack<P> _free = new Stack<P>();

        static readonly Color[] ConfettiColors =
        {
            Hex.C("#FF6B6B"), Hex.C("#FFD43B"), Hex.C("#69DB7C"), Hex.C("#4DABF7"), Hex.C("#B197FC"), Hex.C("#FF8FAB"),
        };

        public void Init()
        {
        }

        P Spawn(string spriteKey, Vector2 pos, int order)
        {
            P p;
            if (_free.Count > 0)
            {
                p = _free.Pop();
            }
            else if (_all.Count < MaxParticles)
            {
                p = new P();
                var go = new GameObject("fx");
                go.transform.SetParent(transform, false);
                p.tr = go.transform;
                p.sr = go.AddComponent<SpriteRenderer>();
                p.sr.sharedMaterial = SpriteFactory.SpriteMaterial;
                _all.Add(p);
            }
            else
            {
                return null;
            }
            p.sr.sprite = SpriteFactory.Get(spriteKey);
            p.sr.sortingOrder = order;
            p.sr.enabled = true;
            p.pos = pos;
            p.vel = Vector2.zero;
            p.gravity = 0f;
            p.drag = 0f;
            p.life = 0f;
            p.maxLife = 1f;
            p.size0 = 1f;
            p.size1 = 1f;
            p.rot = 0f;
            p.spin = 0f;
            p.sway = 0f;
            p.squash = 1f;
            p.c0 = Color.white;
            p.c1 = new Color(1f, 1f, 1f, 0f);
            p.alive = true;
            p.unscaled = false;
            p.tr.position = pos;
            return p;
        }

        void Update()
        {
            float sdt = Time.deltaTime;
            float udt = Time.unscaledDeltaTime;
            for (int i = 0; i < _all.Count; i++)
            {
                var p = _all[i];
                if (!p.alive) continue;
                float dt = p.unscaled ? udt : sdt;
                p.life += dt;
                if (p.life >= p.maxLife)
                {
                    p.alive = false;
                    p.sr.enabled = false;
                    _free.Push(p);
                    continue;
                }
                float t = p.life / p.maxLife;
                p.vel.y -= p.gravity * dt;
                if (p.drag > 0f) p.vel *= Mathf.Max(0f, 1f - p.drag * dt);
                p.pos += p.vel * dt;
                p.rot += p.spin * dt;
                float sx = p.sway != 0f ? Mathf.Sin(p.life * 4f) * p.sway : 0f;
                p.tr.position = new Vector3(p.pos.x + sx, p.pos.y, 0f);
                p.tr.rotation = Quaternion.Euler(0f, 0f, p.rot);
                float s = Mathf.Lerp(p.size0, p.size1, t);
                p.tr.localScale = new Vector3(s, s * p.squash, 1f);
                p.sr.color = Color.Lerp(p.c0, p.c1, t);
            }
        }

        // ------------------------------------------------------------------ presets

        public void Splash(Vector2 pos, float strength)
        {
            var water = WaterSurface.Instance != null ? WaterSurface.Instance.Colors.crest : Color.white;
            int n = Mathf.RoundToInt(10 + 8 * strength);
            for (int i = 0; i < n; i++)
            {
                var p = Spawn("fx.drop", pos, Sorting.Effects);
                if (p == null) return;
                float a = Mathf.Lerp(50f, 130f, (float)Game.Rng.NextDouble()) * Mathf.Deg2Rad;
                float sp = Game.Range(1.6f, 3.6f) * (0.7f + strength * 0.5f);
                p.vel = new Vector2(Mathf.Cos(a) * sp, Mathf.Sin(a) * sp);
                p.gravity = 9f;
                p.maxLife = Game.Range(0.45f, 0.8f);
                p.size0 = Game.Range(0.7f, 1.2f);
                p.size1 = 0.4f;
                var c = Color.Lerp(Color.white, water, 0.4f);
                p.c0 = c;
                p.c1 = new Color(c.r, c.g, c.b, 0f);
                p.rot = Mathf.Atan2(p.vel.y, p.vel.x) * Mathf.Rad2Deg - 90f;
            }
            Ripple(pos, 0.9f + strength * 0.6f);
            if (WaterSurface.Instance != null) WaterSurface.Instance.AddRipple(pos.x, 0.06f + 0.05f * strength);
        }

        public void Ripple(Vector2 pos, float size)
        {
            var p = Spawn("fx.ring", pos, Sorting.SurfaceDecor);
            if (p == null) return;
            p.maxLife = 0.9f;
            p.size0 = 0.15f * size;
            p.size1 = 1.1f * size;
            p.c0 = new Color(1f, 1f, 1f, 0.75f);
            p.c1 = new Color(1f, 1f, 1f, 0f);
            p.squash = 0.35f;
        }

        public void Sparkles(Vector2 pos, Color color, int count, float radius, bool unscaled = false)
        {
            for (int i = 0; i < count; i++)
            {
                var p = Spawn("fx.spark", pos + Random.insideUnitCircle * radius * 0.3f, Sorting.Effects + 2);
                if (p == null) return;
                var dir = Random.insideUnitCircle.normalized;
                p.vel = dir * Game.Range(0.8f, 2.4f) * radius;
                p.drag = 2.5f;
                p.maxLife = Game.Range(0.6f, 1.1f);
                p.size0 = Game.Range(0.6f, 1.3f);
                p.size1 = 0f;
                p.spin = Game.Range(-180f, 180f);
                p.c0 = color;
                p.c1 = new Color(color.r, color.g, color.b, 0f);
                p.unscaled = unscaled;
            }
        }

        public void Confetti(Vector2 pos, int count)
        {
            for (int i = 0; i < count; i++)
            {
                var p = Spawn("fx.confetti", pos, Sorting.Effects + 3);
                if (p == null) return;
                float a = Game.Range(40f, 140f) * Mathf.Deg2Rad;
                float sp = Game.Range(3f, 7f);
                p.vel = new Vector2(Mathf.Cos(a) * sp, Mathf.Sin(a) * sp);
                p.gravity = 5f;
                p.drag = 1.2f;
                p.maxLife = Game.Range(1.4f, 2.4f);
                p.size0 = Game.Range(1f, 1.6f);
                p.size1 = 1f;
                p.spin = Game.Range(-540f, 540f);
                p.sway = Game.Range(0.05f, 0.2f);
                var c = ConfettiColors[Game.Rng.Next(ConfettiColors.Length)];
                p.c0 = c;
                p.c1 = new Color(c.r, c.g, c.b, 0f);
                p.unscaled = true;
            }
        }

        public void Steam(Vector2 pos, int count = 3)
        {
            for (int i = 0; i < count; i++)
            {
                var p = Spawn("fx.soft", pos + new Vector2(Game.Range(-0.2f, 0.2f), 0f), Sorting.Effects);
                if (p == null) return;
                p.vel = new Vector2(Game.Range(-0.1f, 0.1f), Game.Range(0.5f, 0.9f));
                p.maxLife = Game.Range(0.9f, 1.4f);
                p.size0 = 0.25f;
                p.size1 = 0.7f;
                p.sway = 0.08f;
                p.c0 = new Color(1f, 1f, 1f, 0.6f);
                p.c1 = new Color(1f, 1f, 1f, 0f);
            }
        }

        public void Bubbles(Vector2 pos, int count)
        {
            for (int i = 0; i < count; i++)
            {
                var p = Spawn("fx.ring", pos + new Vector2(Game.Range(-0.15f, 0.15f), Game.Range(-0.1f, 0.1f)), Sorting.Swimmers);
                if (p == null) return;
                p.vel = new Vector2(0f, Game.Range(0.4f, 0.8f));
                p.sway = 0.06f;
                p.maxLife = Game.Range(1.5f, 2.6f);
                p.size0 = Game.Range(0.08f, 0.16f);
                p.size1 = p.size0 * 1.3f;
                p.c0 = new Color(1f, 1f, 1f, 0.7f);
                p.c1 = new Color(1f, 1f, 1f, 0f);
            }
        }

        public void Ember(Vector2 pos)
        {
            var p = Spawn("fx.spark", pos, Sorting.SurfaceDecor);
            if (p == null) return;
            p.vel = new Vector2(Game.Range(-0.3f, 0.3f), Game.Range(0.6f, 1.6f));
            p.sway = Game.Range(0.05f, 0.15f);
            p.maxLife = Game.Range(1.2f, 2.4f);
            p.size0 = Game.Range(0.25f, 0.45f);
            p.size1 = 0.05f;
            var c = Color.Lerp(Hex.C("#FFD43B"), Hex.C("#FF6B1A"), (float)Game.Rng.NextDouble());
            p.c0 = c;
            p.c1 = new Color(c.r, c.g * 0.5f, 0f, 0f);
        }

        public void Smoke(Vector2 pos)
        {
            var p = Spawn("fx.soft", pos, Sorting.FarBackground + 1);
            if (p == null) return;
            p.vel = new Vector2(Game.Range(0.05f, 0.25f), Game.Range(0.25f, 0.45f));
            p.maxLife = Game.Range(5f, 7f);
            p.size0 = Game.Range(0.8f, 1.1f);
            p.size1 = Game.Range(2.6f, 3.4f);
            p.c0 = new Color(0.55f, 0.5f, 0.5f, 0.55f);
            p.c1 = new Color(0.6f, 0.55f, 0.55f, 0f);
        }

        public void Zzz(Vector2 pos)
        {
            var p = Spawn("fx.z", pos, Sorting.Effects);
            if (p == null) return;
            p.vel = new Vector2(Game.Range(0.15f, 0.3f), 0.45f);
            p.sway = 0.08f;
            p.maxLife = 1.8f;
            p.size0 = 0.5f;
            p.size1 = 1f;
            p.spin = Game.Range(-20f, 20f);
            p.c0 = Color.white;
            p.c1 = new Color(1f, 1f, 1f, 0f);
        }

        public void Hearts(Vector2 pos, int count)
        {
            for (int i = 0; i < count; i++)
            {
                var p = Spawn("fx.heart", pos + new Vector2(Game.Range(-0.3f, 0.3f), 0f), Sorting.Effects);
                if (p == null) return;
                p.vel = new Vector2(Game.Range(-0.3f, 0.3f), Game.Range(0.6f, 1f));
                p.sway = 0.1f;
                p.maxLife = Game.Range(1f, 1.5f);
                p.size0 = 0.5f;
                p.size1 = 0.9f;
                p.c0 = Color.white;
                p.c1 = new Color(1f, 1f, 1f, 0f);
            }
        }

        public void Crumbs(Vector2 pos, Color color, int count)
        {
            for (int i = 0; i < count; i++)
            {
                var p = Spawn("fx.circle", pos, Sorting.Effects);
                if (p == null) return;
                float a = Game.Range(30f, 150f) * Mathf.Deg2Rad;
                float sp = Game.Range(0.6f, 1.4f);
                p.vel = new Vector2(Mathf.Cos(a) * sp, Mathf.Sin(a) * sp);
                p.gravity = 6f;
                p.maxLife = Game.Range(0.4f, 0.7f);
                p.size0 = Game.Range(0.05f, 0.09f);
                p.size1 = p.size0;
                p.c0 = color;
                p.c1 = new Color(color.r, color.g, color.b, 0f);
            }
        }

        /// <summary>물방울 하나 (비가 수면에 떨어질 때).</summary>
        public void RainHit(Vector2 pos)
        {
            var p = Spawn("fx.ring", pos, Sorting.SurfaceDecor);
            if (p == null) return;
            p.maxLife = 0.45f;
            p.size0 = 0.04f;
            p.size1 = 0.35f;
            p.squash = 0.35f;
            p.c0 = new Color(1f, 1f, 1f, 0.55f);
            p.c1 = new Color(1f, 1f, 1f, 0f);
        }
    }
}
