using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>해, 달, 별, 노을 반사광. 시간에 따라 위치/색/투명도가 바뀐다.</summary>
    public sealed class CelestialSystem : MonoBehaviour
    {
        const float Parallax = 0.95f;
        SpriteRenderer _sun, _moon, _reflection;
        readonly List<SpriteRenderer> _stars = new List<SpriteRenderer>();
        readonly List<Vector2> _starPos = new List<Vector2>();
        readonly List<float> _starPhase = new List<float>();
        readonly List<float> _starAlpha = new List<float>();

        public Vector2 SunPosition { get; private set; }
        public bool SunVisible { get; private set; }

        public void Init()
        {
            _sun = SpriteFactory.Renderer(transform, "Sun", SpriteFactory.Get(SpriteKeys.Sun), Sorting.Celestial);
            _moon = SpriteFactory.Renderer(transform, "Moon", SpriteFactory.Get(SpriteKeys.Moon), Sorting.Celestial);
            _reflection = SpriteFactory.Renderer(transform, "SunReflection", SpriteFactory.Get("fx.reflection"), Sorting.Reflection);
            var rng = new System.Random(77);
            for (int i = 0; i < 70; i++)
            {
                var sr = SpriteFactory.Renderer(transform, "Star", SpriteFactory.Get(i % 4 == 0 ? "fx.spark" : "fx.soft"), Sorting.Stars);
                float scale = i % 4 == 0 ? 0.25f + (float)rng.NextDouble() * 0.25f : 0.06f + (float)rng.NextDouble() * 0.07f;
                sr.transform.localScale = new Vector3(scale, scale, 1f);
                _stars.Add(sr);
                _starPos.Add(new Vector2((float)rng.NextDouble() * 34f - 17f, LocationLayout.WaterY + 1.2f + (float)rng.NextDouble() * 7.5f));
                _starPhase.Add((float)rng.NextDouble() * 10f);
                _starAlpha.Add(0.5f + (float)rng.NextDouble() * 0.5f);
            }
        }

        public void Apply(float hour, float day, float sunset, float night, float rain, Color horizonTint)
        {
            float camX = CameraRig.X;
            float wy = LocationLayout.WaterY;
            float clear = 1f - rain * 0.85f;

            // 해: 06시 왼쪽에서 떠서 19시 오른쪽 바다로 진다
            float st = (hour - 6f) / 13f;
            SunVisible = hour > 5.6f && hour < 19.5f;
            float sx = Mathf.Lerp(-7.5f, 7.5f, st);
            float sy = wy + 0.15f + Mathf.Sin(Mathf.Clamp01(st) * Mathf.PI) * 5.3f;
            SunPosition = new Vector2(sx + camX * Parallax, sy);
            _sun.enabled = SunVisible;
            if (SunVisible)
            {
                _sun.transform.position = new Vector3(SunPosition.x, SunPosition.y, 0f);
                float big = 1f + sunset * 0.45f;
                _sun.transform.localScale = new Vector3(big, big, 1f);
                var c = Color.Lerp(new Color(1f, 0.98f, 0.86f), new Color(1f, 0.56f, 0.28f), sunset);
                c.a = Mathf.Lerp(1f, 0.35f, rain);
                _sun.color = c;
            }

            // 노을 반사광 (해가 낮을 때 수면에 길게)
            float low = Mathf.Clamp01(1f - (sy - wy) / 3f);
            float refl = SunVisible ? sunset * low * clear : 0f;
            _reflection.enabled = refl > 0.01f;
            if (_reflection.enabled)
            {
                _reflection.transform.position = new Vector3(SunPosition.x, wy, 0f);
                _reflection.color = new Color(1f, 0.72f, 0.45f, 0.6f * refl);
                float w = 0.7f + 0.15f * Mathf.Sin(Time.time * 2f);
                _reflection.transform.localScale = new Vector3(w, 1f, 1f);
            }

            // 달: 19시 ~ 다음날 6.5시
            bool moonUp = hour >= 19f || hour <= 6.5f;
            _moon.enabled = moonUp;
            if (moonUp)
            {
                float hh = hour >= 19f ? hour - 19f : hour + 5f;
                float mt = hh / 11.5f;
                float mx = Mathf.Lerp(-7f, 7f, mt);
                float my = wy + 0.4f + Mathf.Sin(Mathf.Clamp01(mt) * Mathf.PI) * 4.8f;
                _moon.transform.position = new Vector3(mx + camX * Parallax, my, 0f);
                _moon.transform.localScale = new Vector3(0.85f, 0.85f, 1f);
                _moon.color = new Color(1f, 0.97f, 0.82f, Mathf.Clamp01(night * 1.3f) * clear);
            }

            // 별
            float starA = night * clear;
            for (int i = 0; i < _stars.Count; i++)
            {
                var sr = _stars[i];
                bool on = starA > 0.02f;
                sr.enabled = on;
                if (!on) continue;
                var p = _starPos[i];
                sr.transform.position = new Vector3(p.x + camX, p.y, 0f);
                float tw = 0.65f + 0.35f * Mathf.Sin(Time.unscaledTime * (1.3f + (i % 5) * 0.37f) + _starPhase[i]);
                sr.color = new Color(1f, 1f, 0.95f, starA * _starAlpha[i] * tw);
            }
        }
    }
}
