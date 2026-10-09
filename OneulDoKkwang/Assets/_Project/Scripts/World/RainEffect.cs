using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>비 줄기 + 수면 빗방울 링. WeatherManager.RainBlend 에 따라 양이 바뀐다.</summary>
    public sealed class RainEffect : MonoBehaviour
    {
        readonly List<SpriteRenderer> _drops = new List<SpriteRenderer>();
        readonly List<Vector2> _pos = new List<Vector2>();
        readonly List<float> _speed = new List<float>();
        static readonly Vector2 Dir = new Vector2(-0.16f, -1f);
        float _hitTimer;

        public void Init(int count = 150)
        {
            var sprite = SpriteFactory.Get("fx.rain");
            for (int i = 0; i < count; i++)
            {
                var sr = SpriteFactory.Renderer(transform, "Rain", sprite, Sorting.Rain);
                sr.transform.rotation = Quaternion.Euler(0f, 0f, -9f);
                sr.enabled = false;
                _drops.Add(sr);
                _pos.Add(new Vector2(Game.Range(-14f, 14f), Game.Range(-6f, 7f)));
                _speed.Add(Game.Range(12f, 17f));
            }
        }

        void LateUpdate()
        {
            float blend = Game.Weather != null ? Game.Weather.RainBlend : 0f;
            int active = Mathf.RoundToInt(_drops.Count * blend);
            float dt = Time.deltaTime;
            float camX = CameraRig.X;
            var water = WaterSurface.Instance;
            _hitTimer -= dt;
            for (int i = 0; i < _drops.Count; i++)
            {
                var sr = _drops[i];
                bool on = i < active;
                sr.enabled = on;
                if (!on) continue;
                var p = _pos[i] + Dir * _speed[i] * dt;
                float wx = p.x + camX;
                float floor = -6.5f;
                if (water != null && wx > water.startX) floor = water.Height(wx);
                if (p.y < floor)
                {
                    if (water != null && wx > water.startX && _hitTimer <= 0f && Game.Fx != null)
                    {
                        Game.Fx.RainHit(new Vector2(wx, floor));
                        _hitTimer = 0.04f;
                    }
                    p = new Vector2(Game.Range(-13f, 15f), Game.Range(6f, 8f));
                }
                _pos[i] = p;
                sr.transform.position = new Vector3(p.x + camX, p.y, 0f);
                sr.color = new Color(0.85f, 0.9f, 1f, 0.5f * blend);
            }
        }
    }
}
