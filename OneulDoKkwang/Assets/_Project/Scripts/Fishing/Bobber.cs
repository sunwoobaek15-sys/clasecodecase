using System;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 찌. 낚싯대 끝에 매달림 → 포물선 비행 → 물결 위에 둥둥 → 깔짝/입질(! + 줄어드는 링) → 릴 감기 중 끌려옴 → 회수.
    /// </summary>
    [DefaultExecutionOrder(60)]
    public sealed class Bobber : MonoBehaviour
    {
        public enum Mode { Hanging, Flying, Floating, Reeling, Retrieving }

        [Header("스프라이트 렌더러 (아트 교체 지점)")]
        public SpriteRenderer sprite;
        public SpriteRenderer exclaim;
        public SpriteRenderer ring;

        public Mode Current { get; private set; }
        public Vector3 Position => transform.position;
        /// <summary>현재 수면 기준 x.</summary>
        public float X => _x;

        Vector3 _from, _to;
        float _t, _dur, _apex;
        Action _done;
        float _x;
        float _dip;
        float _dipVel;
        bool _biting;
        float _biteT;
        float _ringDur = 0.6f;
        Vector3 _hangPos;
        Vector3 _hangVel;
        float _reelJerk;

        public static Bobber Create(Transform parent)
        {
            var go = new GameObject("Bobber (찌)");
            go.transform.SetParent(parent, false);
            var b = go.AddComponent<Bobber>();
            b.sprite = SpriteFactory.Renderer(go.transform, "Sprite", SpriteFactory.Get(SpriteKeys.Bobber), Sorting.Bobber);
            Tintable.Attach(b.sprite, Tintable.Mode.Near);
            b.exclaim = SpriteFactory.Renderer(go.transform, "Exclaim (!)", SpriteFactory.Get("fx.exclaim"), Sorting.Effects + 5);
            b.exclaim.enabled = false;
            b.ring = SpriteFactory.Renderer(go.transform, "BiteRing", SpriteFactory.Get("fx.ring"), Sorting.Effects + 4, new Color(1f, 0.85f, 0.2f, 0.9f));
            b.ring.enabled = false;
            return b;
        }

        public void Hang(bool snap)
        {
            Current = Mode.Hanging;
            StopBite();
            if (snap && Game.Player != null)
            {
                _hangPos = Game.Player.RodTip + new Vector3(0f, -0.55f, 0f);
                _hangVel = Vector3.zero;
                transform.position = _hangPos;
            }
        }

        public void Launch(Vector3 from, Vector3 to, float duration, float apex, Action landed)
        {
            Current = Mode.Flying;
            _from = from;
            _to = to;
            _t = 0f;
            _dur = Mathf.Max(0.1f, duration);
            _apex = apex;
            _done = landed;
            transform.position = from;
        }

        public void Nibble()
        {
            _dipVel -= Game.Range(0.9f, 1.5f);
            if (Game.Fx != null) Game.Fx.Ripple(new Vector2(_x, transform.position.y), 0.45f);
        }

        public void StartBite(float window)
        {
            _biting = true;
            _biteT = 0f;
            _ringDur = window;
            _dipVel -= 3.2f;
            exclaim.enabled = true;
            ring.enabled = true;
            exclaim.transform.localScale = Vector3.zero;
            Tweens.Scale(exclaim.transform, Vector3.zero, Vector3.one, 0.18f, Ease.OutBack);
            if (Game.Fx != null) Game.Fx.Splash(new Vector2(_x, transform.position.y), 0.35f);
        }

        public void StopBite()
        {
            _biting = false;
            if (exclaim != null) exclaim.enabled = false;
            if (ring != null) ring.enabled = false;
        }

        public void BeginReel()
        {
            StopBite();
            Current = Mode.Reeling;
        }

        public void SetReelX(float x, float jerk)
        {
            _x = x;
            _reelJerk = jerk;
        }

        public void Retrieve(float duration, Action done)
        {
            StopBite();
            Current = Mode.Retrieving;
            _from = transform.position;
            _t = 0f;
            _dur = Mathf.Max(0.05f, duration);
            _done = done;
        }

        void LateUpdate()
        {
            float dt = Time.deltaTime;
            var water = WaterSurface.Instance;
            switch (Current)
            {
                case Mode.Hanging:
                {
                    if (Game.Player == null) break;
                    var target = Game.Player.RodTip + new Vector3(0f, -0.55f, 0f);
                    _hangPos = Vector3.SmoothDamp(_hangPos, target, ref _hangVel, 0.08f, 60f, Mathf.Max(dt, 0.0001f));
                    transform.position = _hangPos;
                    transform.rotation = Quaternion.Euler(0f, 0f, Mathf.Clamp(-_hangVel.x * 12f, -35f, 35f));
                    break;
                }
                case Mode.Flying:
                {
                    _t += dt;
                    float k = Mathf.Clamp01(_t / _dur);
                    var p = Vector3.Lerp(_from, _to, k);
                    p.y += Mathf.Sin(k * Mathf.PI) * _apex;
                    transform.position = p;
                    transform.rotation = Quaternion.Euler(0f, 0f, -k * 360f * 1.5f);
                    if (k >= 1f)
                    {
                        _x = _to.x;
                        _dip = 0f;
                        _dipVel = -2.5f;
                        Current = Mode.Floating;
                        transform.rotation = Quaternion.identity;
                        var d = _done;
                        _done = null;
                        if (d != null) d();
                    }
                    break;
                }
                case Mode.Floating:
                case Mode.Reeling:
                {
                    float h = water != null ? water.Height(_x) : LocationLayout.WaterY;
                    _dipVel += (-_dip * 70f - _dipVel * 7f) * dt;
                    _dip += _dipVel * dt;
                    float x = _x;
                    float y = h + _dip;
                    float rot = water != null ? Mathf.Atan(water.Slope(_x)) * Mathf.Rad2Deg * 0.8f : 0f;
                    if (_biting)
                    {
                        _biteT += dt;
                        x += Mathf.Sin(_biteT * 55f) * 0.045f;
                        y += -0.22f + Mathf.Sin(_biteT * 31f) * 0.04f;
                        rot += Mathf.Sin(_biteT * 40f) * 14f;
                        float rk = Mathf.Clamp01(_biteT / Mathf.Max(0.05f, _ringDur));
                        float rs = Mathf.Lerp(1.5f, 0.35f, rk);
                        ring.transform.position = new Vector3(x, h + 0.05f, 0f);
                        ring.transform.localScale = new Vector3(rs, rs * 0.55f, 1f);
                        ring.color = new Color(1f, Mathf.Lerp(0.9f, 0.3f, rk), 0.2f, 0.9f);
                        exclaim.transform.position = new Vector3(x, h + 0.55f + Mathf.Sin(_biteT * 20f) * 0.04f, 0f);
                        exclaim.transform.rotation = Quaternion.identity;
                    }
                    if (Current == Mode.Reeling)
                    {
                        float t = Time.time;
                        x += (Mathf.PerlinNoise(t * 6f, 1.7f) - 0.5f) * 0.25f * _reelJerk;
                        y += -0.1f + (Mathf.PerlinNoise(t * 7f, 4.3f) - 0.5f) * 0.18f * _reelJerk;
                        rot += (Mathf.PerlinNoise(t * 9f, 8.1f) - 0.5f) * 40f * _reelJerk;
                    }
                    transform.position = new Vector3(x, y, 0f);
                    transform.rotation = Quaternion.Euler(0f, 0f, rot);
                    break;
                }
                case Mode.Retrieving:
                {
                    _t += dt;
                    float k = Mathf.Clamp01(_t / _dur);
                    var tip = Game.Player != null ? Game.Player.RodTip + new Vector3(0f, -0.55f, 0f) : _from;
                    var p = Vector3.Lerp(_from, tip, Ease.InOutQuad(k));
                    p.y += Mathf.Sin(k * Mathf.PI) * 0.8f;
                    transform.position = p;
                    if (k >= 1f)
                    {
                        _hangPos = tip;
                        _hangVel = Vector3.zero;
                        Current = Mode.Hanging;
                        var d = _done;
                        _done = null;
                        if (d != null) d();
                    }
                    break;
                }
            }
        }
    }
}
