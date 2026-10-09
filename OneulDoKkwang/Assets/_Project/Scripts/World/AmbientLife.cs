using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 장소별 배경 생명체/효과: 헤엄치는 물고기 실루엣, 지나가는 바다거북(부두), 거품, 용암 불씨, 화산 연기.
    /// </summary>
    public sealed class AmbientLife : MonoBehaviour
    {
        sealed class Swimmer
        {
            public SpriteRenderer sr;
            public float x;
            public float y;
            public float speed;
            public float phase;
        }

        LocationLayout _layout;
        float _waterStartX;
        readonly List<Swimmer> _swimmers = new List<Swimmer>();
        SpriteRenderer _turtle;
        float _turtleTimer;
        float _turtleX;
        float _turtleDir;
        float _turtleY;
        float _bubbleTimer;
        float _emberTimer;
        float _smokeTimer;

        public void Init(LocationLayout layout)
        {
            _layout = layout;
            _waterStartX = layout.WaterStartX;
            var fishSprite = SpriteFactory.Get("decor.fish");
            for (int i = 0; i < layout.swimmerCount; i++)
            {
                var sr = SpriteFactory.Renderer(transform, "Swimmer", fishSprite, Sorting.Swimmers);
                var colors = layout.swimmerColors;
                sr.color = colors != null && colors.Length > 0 ? colors[i % colors.Length] : new Color(0f, 0f, 0f, 0.3f);
                float s = Game.Range(0.35f, 0.7f);
                sr.transform.localScale = new Vector3(s, s, 1f);
                var sw = new Swimmer
                {
                    sr = sr,
                    x = Game.Range(-8f, 12f),
                    y = Game.Range(-4.1f, -1.9f),
                    speed = Game.Range(0.35f, 1.1f) * (Game.Chance(0.5f) ? 1f : -1f),
                    phase = Game.Range(0f, 6f),
                };
                sr.flipX = sw.speed < 0f;
                _swimmers.Add(sw);
            }
            if (layout.turtlePasses)
            {
                _turtle = SpriteFactory.Renderer(transform, "PassingTurtle", SpriteFactory.Get(SpriteKeys.Turtle), Sorting.Swimmers + 1);
                _turtle.enabled = false;
                _turtleTimer = Game.Range(8f, 16f);
            }
        }

        void Update()
        {
            float dt = Time.deltaTime;
            float camX = CameraRig.X;
            float t = Time.time;

            foreach (var s in _swimmers)
            {
                s.x += s.speed * dt;
                float rel = s.x - camX;
                if (rel > 14f) { s.x -= 28f; s.y = Game.Range(-4.1f, -1.9f); }
                else if (rel < -14f) { s.x += 28f; s.y = Game.Range(-4.1f, -1.9f); }
                float ground = _waterStartX + 0.6f;
                bool visible = s.x > ground;
                s.sr.enabled = visible;
                s.sr.transform.position = new Vector3(s.x, s.y + Mathf.Sin(t * 1.4f + s.phase) * 0.08f, 0f);
            }

            if (_turtle != null)
            {
                if (_turtle.enabled)
                {
                    _turtleX += _turtleDir * 0.75f * dt;
                    _turtle.transform.position = new Vector3(_turtleX, _turtleY + Mathf.Sin(t * 1.2f) * 0.12f, 0f);
                    _turtle.transform.rotation = Quaternion.Euler(0f, 0f, Mathf.Sin(t * 1.2f) * 4f);
                    if (Mathf.Abs(_turtleX - camX) > 15f)
                    {
                        _turtle.enabled = false;
                        _turtleTimer = Game.Range(30f, 55f);
                    }
                }
                else
                {
                    _turtleTimer -= dt;
                    if (_turtleTimer <= 0f)
                    {
                        _turtleDir = Game.Chance(0.5f) ? 1f : -1f;
                        _turtleX = camX - _turtleDir * 13f;
                        _turtleY = Game.Range(-3.6f, -2.2f);
                        _turtle.flipX = _turtleDir < 0f;
                        _turtle.transform.localScale = new Vector3(0.9f, 0.9f, 1f);
                        _turtle.enabled = true;
                    }
                }
            }

            if (Game.Fx == null) return;

            if (_layout.theme != LocationTheme.Volcano && _layout.theme != LocationTheme.Cloud)
            {
                _bubbleTimer -= dt;
                if (_bubbleTimer <= 0f)
                {
                    _bubbleTimer = Game.Range(0.8f, 2f);
                    float bx = camX + Game.Range(-6f, 9f);
                    if (bx > _waterStartX + 1f) Game.Fx.Bubbles(new Vector2(bx, -4.4f), Game.Rng.Next(1, 4));
                }
            }

            if (_layout.embers)
            {
                _emberTimer -= dt;
                if (_emberTimer <= 0f)
                {
                    _emberTimer = Game.Range(0.06f, 0.18f);
                    float ex = camX + Game.Range(-8f, 10f);
                    float ey = WaterSurface.Instance != null && ex > WaterSurface.Instance.startX ? WaterSurface.Instance.Height(ex) : LocationLayout.WaterY;
                    if (ex > _waterStartX) Game.Fx.Ember(new Vector2(ex, ey));
                }
            }

            if (_layout.volcanoSmoke)
            {
                _smokeTimer -= dt;
                if (_smokeTimer <= 0f)
                {
                    _smokeTimer = Game.Range(0.5f, 0.9f);
                    var o = _layout.smokeOrigin;
                    Game.Fx.Smoke(new Vector2(o.x + camX * _layout.smokeParallax + Game.Range(-0.3f, 0.3f), o.y));
                }
            }
        }
    }
}
