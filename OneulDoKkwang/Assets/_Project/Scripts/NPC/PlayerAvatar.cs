using System;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 알로하 셔츠 주인공. 파츠별 SpriteRenderer 참조를 들고 있어서 나중에 스프라이트만 바꿔 끼우면 된다.
    /// (몸통 / 머리 / 얼굴 표정 / 낚싯대). 낚싯대 각도로 캐스팅·릴 감기 포즈를 표현한다.
    /// </summary>
    public sealed class PlayerAvatar : MonoBehaviour
    {
        [Header("스프라이트 렌더러 (아트 교체 지점)")]
        public SpriteRenderer body;
        public SpriteRenderer head;
        public SpriteRenderer face;
        public SpriteRenderer rod;
        public SpriteRenderer shadow;
        public Transform visual;
        public Transform headPivot;
        public Transform rodPivot;
        public Transform bubbleAnchor;

        Sprite _faceOpen, _faceSleep, _faceSurprised;

        float _rodAngle = 38f;
        float _rodTarget = 38f;
        float _rodSpeed = 10f;
        float _rodShake;
        float _surprise;
        bool _dozing;
        float _zTimer;
        float _hop;
        float _castTimer;

        bool _walking;
        float _walkFrom, _walkTo, _walkTime, _walkDur;
        Action _walkDone;

        public const float IdleAngle = 38f;

        public static PlayerAvatar Create(Transform parent)
        {
            var root = new GameObject("Player (알로하 주인공)");
            root.transform.SetParent(parent, false);
            var p = root.AddComponent<PlayerAvatar>();
            p.Build();
            return p;
        }

        void Build()
        {
            float u = WorldPainter.CharDesignToWorld;
            shadow = SpriteFactory.Renderer(transform, "Shadow", SpriteFactory.Get("fx.shadow"), Sorting.Player - 2, new Color(1f, 1f, 1f, 0.55f));
            shadow.transform.localScale = new Vector3(0.9f, 0.9f, 1f);
            var vis = new GameObject("Visual");
            vis.transform.SetParent(transform, false);
            visual = vis.transform;

            body = SpriteFactory.Renderer(visual, "Body", SpriteFactory.Get(SpriteKeys.PlayerBody), Sorting.Player);
            Tintable.Attach(body, Tintable.Mode.Near);

            var hp = new GameObject("HeadPivot");
            hp.transform.SetParent(visual, false);
            hp.transform.localPosition = new Vector3((WorldPainter.PlayerNeckDesign.x - 50f) * u, WorldPainter.PlayerNeckDesign.y * u, 0f);
            headPivot = hp.transform;
            head = SpriteFactory.Renderer(headPivot, "Head", SpriteFactory.Get(SpriteKeys.PlayerHead), Sorting.Player + 1);
            Tintable.Attach(head, Tintable.Mode.Near);
            face = SpriteFactory.Renderer(headPivot, "Face", SpriteFactory.Get(SpriteKeys.PlayerFaceOpen), Sorting.Player + 2);
            Tintable.Attach(face, Tintable.Mode.Near);

            var rp = new GameObject("RodPivot (손)");
            rp.transform.SetParent(visual, false);
            rp.transform.localPosition = new Vector3((WorldPainter.PlayerHandDesign.x - 50f) * u, WorldPainter.PlayerHandDesign.y * u, 0f);
            rodPivot = rp.transform;
            rod = SpriteFactory.Renderer(rodPivot, "Rod", SpriteFactory.Get(SpriteKeys.Rod), Sorting.Rod);
            Tintable.Attach(rod, Tintable.Mode.Near);

            var ba = new GameObject("BubbleAnchor");
            ba.transform.SetParent(transform, false);
            ba.transform.localPosition = new Vector3(0.15f, 2.45f, 0f);
            bubbleAnchor = ba.transform;

            _faceOpen = SpriteFactory.Get(SpriteKeys.PlayerFaceOpen);
            _faceSleep = SpriteFactory.Get(SpriteKeys.PlayerFaceSleep);
            _faceSurprised = SpriteFactory.Get(SpriteKeys.PlayerFaceSurprised);
            ApplyRod();
        }

        public void PlaceAt(Vector2 p)
        {
            _walking = false;
            transform.position = new Vector3(p.x, p.y, 0f);
        }

        public void SetRod(RodData r)
        {
            if (rod != null) rod.sprite = SpriteFactory.RodSprite(r);
        }

        public Vector3 RodTip
        {
            get
            {
                if (rodPivot == null) return transform.position;
                return rodPivot.TransformPoint(new Vector3(WorldPainter.RodTipLocalX, 0f, 0f));
            }
        }

        // ------------------------------------------------------------- poses

        public void PoseIdle() { _rodTarget = IdleAngle; _rodSpeed = 6f; _rodShake = 0f; }
        public void PoseWaiting() { _rodTarget = 30f; _rodSpeed = 5f; _rodShake = 0f; }

        /// <summary>파워를 모으는 중: 낚싯대를 뒤로 젖힌다.</summary>
        public void PoseCharge(float power)
        {
            _rodTarget = Mathf.Lerp(55f, 122f, power);
            _rodSpeed = 14f;
            _rodShake = power > 0.9f ? 0.6f : 0f;
        }

        /// <summary>던지는 순간: 앞으로 휙.</summary>
        public void PoseCast()
        {
            _rodTarget = 8f;
            _rodSpeed = 28f;
            _castTimer = 0.28f;
            _rodShake = 0f;
        }

        public void PoseReel(float tension)
        {
            _rodTarget = 52f + tension * 16f;
            _rodSpeed = 12f;
            _rodShake = 0.35f + tension * 0.9f;
        }

        public void PoseShowCatch()
        {
            _rodTarget = 72f;
            _rodSpeed = 10f;
            _rodShake = 0f;
        }

        public void Doze(bool on)
        {
            _dozing = on;
            _zTimer = 0.5f;
        }

        public bool IsDozing => _dozing;

        public void Surprise(float seconds = 0.9f)
        {
            _surprise = seconds;
            _hop = 1f;
        }

        public void Hop()
        {
            _hop = 1f;
        }

        public void WalkTo(float x, float seconds, Action done)
        {
            _walking = true;
            _walkFrom = transform.position.x;
            _walkTo = x;
            _walkTime = 0f;
            _walkDur = Mathf.Max(0.1f, seconds);
            _walkDone = done;
        }

        // ------------------------------------------------------------- update

        void Update()
        {
            float dt = Time.deltaTime;
            float t = Time.time;

            if (_walking)
            {
                _walkTime += Time.unscaledDeltaTime;
                float k = Mathf.Clamp01(_walkTime / _walkDur);
                var pos = transform.position;
                pos.x = Mathf.Lerp(_walkFrom, _walkTo, k);
                transform.position = pos;
                visual.localPosition = new Vector3(0f, Mathf.Abs(Mathf.Sin(_walkTime * 9f)) * 0.08f, 0f);
                visual.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(_walkTime * 9f) * 3f);
                if (k >= 1f)
                {
                    _walking = false;
                    visual.localPosition = Vector3.zero;
                    visual.localRotation = Quaternion.identity;
                    var d = _walkDone;
                    _walkDone = null;
                    if (d != null) d();
                }
            }
            else
            {
                float breath = 1f + Mathf.Sin(t * 2.1f) * 0.012f;
                float hopY = 0f;
                if (_hop > 0f)
                {
                    _hop = Mathf.Max(0f, _hop - Time.unscaledDeltaTime * 3.2f);
                    hopY = Mathf.Sin((1f - _hop) * Mathf.PI) * 0.22f;
                }
                visual.localScale = new Vector3(1f, breath, 1f);
                visual.localPosition = new Vector3(0f, hopY, 0f);
            }

            if (_castTimer > 0f)
            {
                _castTimer -= dt;
                if (_castTimer <= 0f) { _rodTarget = 24f; _rodSpeed = 5f; }
            }

            _rodAngle = Mathf.Lerp(_rodAngle, _rodTarget, 1f - Mathf.Exp(-_rodSpeed * Mathf.Max(dt, 0.0001f)));
            ApplyRod();

            // 머리: 졸 때 꾸벅
            float headRot = 0f;
            if (_dozing) headRot = -10f + Mathf.Sin(t * 1.3f) * 4f;
            else headRot = Mathf.Sin(t * 1.7f) * 1.2f;
            headPivot.localRotation = Quaternion.Euler(0f, 0f, headRot);

            if (_surprise > 0f) _surprise -= Time.unscaledDeltaTime;
            face.sprite = _surprise > 0f ? _faceSurprised : (_dozing ? _faceSleep : _faceOpen);

            if (_dozing && Game.Fx != null)
            {
                _zTimer -= dt;
                if (_zTimer <= 0f)
                {
                    _zTimer = 1.1f;
                    Game.Fx.Zzz(headPivot.position + new Vector3(0.35f, 0.75f, 0f));
                }
            }
        }

        void ApplyRod()
        {
            if (rodPivot == null) return;
            float shake = _rodShake > 0f ? (Mathf.PerlinNoise(Time.time * 18f, 3.1f) - 0.5f) * 6f * _rodShake : 0f;
            rodPivot.localRotation = Quaternion.Euler(0f, 0f, _rodAngle + shake);
        }
    }
}
