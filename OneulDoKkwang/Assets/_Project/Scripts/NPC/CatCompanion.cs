using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 화관 쓴 고양이 NPC. 꽝 치면 위로하고, 전설 잡으면 놀라고, 방치하면 양동이 생선을 훔쳐 먹는다.
    /// </summary>
    public sealed class CatCompanion : MonoBehaviour
    {
        public enum Mood { Normal, Happy, Surprised, Sleep }

        [Header("스프라이트 렌더러 (아트 교체 지점)")]
        public SpriteRenderer body;
        public SpriteRenderer face;
        public SpriteRenderer tail;
        public Transform visual;
        public Transform tailPivot;
        public Transform bubbleAnchor;

        Sprite _open, _happy, _surprised, _sleep;
        Mood _mood;
        float _moodTimer;
        float _blink;
        float _hop;
        float _hopHeight;
        float _lastSpoke = -100f;
        float _chatTimer = 18f;
        bool _sleeping;
        float _zTimer;

        // 이동 / 훔쳐먹기
        enum StealStep { None, WalkThere, Eat, WalkBack, Walk }
        StealStep _steal;
        float _stepTime;
        float _homeX;
        float _walkFrom, _walkTo, _walkDur;
        CatchData _stolen;

        public bool IsBusy => _steal != StealStep.None;
        public float Home => _homeX;

        public static CatCompanion Create(Transform parent)
        {
            var go = new GameObject("Cat (화관 고양이)");
            go.transform.SetParent(parent, false);
            var c = go.AddComponent<CatCompanion>();
            c.Build();
            return c;
        }

        void Build()
        {
            var shadow = SpriteFactory.Renderer(transform, "Shadow", SpriteFactory.Get("fx.shadow"), Sorting.Cat - 3, new Color(1f, 1f, 1f, 0.5f));
            shadow.transform.localScale = new Vector3(0.65f, 0.7f, 1f);
            var vis = new GameObject("Visual");
            vis.transform.SetParent(transform, false);
            visual = vis.transform;

            var tp = new GameObject("TailPivot");
            tp.transform.SetParent(visual, false);
            const float u = 1.28f / 135f;
            tp.transform.localPosition = new Vector3((WorldPainter.CatTailBaseDesign.x - 50f) * u, WorldPainter.CatTailBaseDesign.y * u, 0f);
            tailPivot = tp.transform;
            tail = SpriteFactory.Renderer(tailPivot, "Tail", SpriteFactory.Get(SpriteKeys.CatTail), Sorting.Cat - 1);
            Tintable.Attach(tail, Tintable.Mode.Near);
            body = SpriteFactory.Renderer(visual, "Body", SpriteFactory.Get(SpriteKeys.CatBody), Sorting.Cat);
            Tintable.Attach(body, Tintable.Mode.Near);
            face = SpriteFactory.Renderer(visual, "Face", SpriteFactory.Get(SpriteKeys.CatFaceOpen), Sorting.Cat + 1);
            Tintable.Attach(face, Tintable.Mode.Near);

            var ba = new GameObject("BubbleAnchor");
            ba.transform.SetParent(transform, false);
            ba.transform.localPosition = new Vector3(0.1f, 1.1f, 0f);
            bubbleAnchor = ba.transform;

            _open = SpriteFactory.Get(SpriteKeys.CatFaceOpen);
            _happy = SpriteFactory.Get(SpriteKeys.CatFaceHappy);
            _surprised = SpriteFactory.Get(SpriteKeys.CatFaceSurprised);
            _sleep = SpriteFactory.Get(SpriteKeys.CatFaceSleep);
            _blink = Random.Range(2f, 5f);
        }

        public void PlaceAt(Vector2 p)
        {
            _steal = StealStep.None;
            _homeX = p.x;
            transform.position = new Vector3(p.x, p.y, 0f);
            visual.localScale = Vector3.one;
            visual.localPosition = Vector3.zero;
        }

        public void SetHome(float x)
        {
            _homeX = x;
        }

        /// <summary>인트로 등에서 그냥 걸어가기.</summary>
        public void WalkTo(float x, float seconds)
        {
            _steal = StealStep.Walk;
            _stepTime = 0f;
            _walkFrom = transform.position.x;
            _walkTo = x;
            _walkDur = Mathf.Max(0.1f, seconds);
            _sleeping = false;
        }

        // ------------------------------------------------------------- talk & mood

        public void Say(string line, float seconds = 2.8f)
        {
            if (string.IsNullOrEmpty(line) || Game.UI == null) return;
            Game.UI.CatBubble.Show(line, seconds);
            _lastSpoke = Time.unscaledTime;
            _chatTimer = Random.Range(22f, 40f);
        }

        public void Say(LineType type, float seconds = 2.8f)
        {
            Say(FunnyLines.Get(type), seconds);
        }

        public bool RecentlySpoke(float seconds)
        {
            return Time.unscaledTime - _lastSpoke < seconds;
        }

        public void React(Mood mood, float seconds, float hop = 0f)
        {
            _mood = mood;
            _moodTimer = seconds;
            if (hop > 0f)
            {
                _hop = 1f;
                _hopHeight = hop;
            }
            if (_sleeping && mood != Mood.Sleep) _sleeping = false;
        }

        public void SetSleeping(bool on)
        {
            _sleeping = on;
            _zTimer = 0.3f;
        }

        // ------------------------------------------------------------- fishing hooks

        public void OnPerfectCast()
        {
            React(Mood.Happy, 1f, 0.12f);
        }

        public void OnBite()
        {
            React(Mood.Surprised, 0.5f, 0.06f);
        }

        public void OnHooked(CatchData c)
        {
            if (c != null && c.IsBigEvent)
            {
                React(Mood.Surprised, 2.5f, 0.35f);
                Say(LineType.CatBigBite, 2.2f);
            }
        }

        public void OnSuccess(CatchResult r)
        {
            if (r == null || r.data == null) return;
            var c = r.data;
            if (c.rarity == CatchRarity.Mystery) { React(Mood.Surprised, 3f, 0.4f); Say(LineType.CatMystery, 3.2f); return; }
            if (c.rarity == CatchRarity.Legendary) { React(Mood.Surprised, 3f, 0.45f); Say(LineType.CatLegend, 3.2f); return; }
            if (r.released) { React(Mood.Happy, 2f, 0.15f); Say(LineType.CatRelease); if (Game.Fx != null) Game.Fx.Hearts(bubbleAnchor.position, 3); return; }
            React(Mood.Happy, 1.6f, 0.15f);
            if (r.streak >= 3 && r.streak % 3 == 0) { Say(FunnyLines.Get(LineType.CatStreak, r.streak)); return; }
            if (r.isNew && Game.Chance(0.5f)) { Say(LineType.CatNew); return; }
            if (r.isRecord && Game.Chance(0.6f)) { Say(LineType.CatRecord); return; }
            if (c.rarity == CatchRarity.Rare) { Say(LineType.CatRare); return; }
            if ((c.tags & (CatchTags.Food | CatchTags.Grilled)) != 0) { Say(LineType.CatFood); return; }
            if ((c.tags & CatchTags.Junk) != 0) { Say(LineType.CatJunk); return; }
            if (Game.Chance(0.6f)) Say(LineType.CatCommon);
        }

        public void OnFail()
        {
            React(Mood.Normal, 0.1f, 0f);
            Say(LineType.CatConsole, 3f);
        }

        // ------------------------------------------------------------- 훔쳐먹기

        /// <summary>양동이에 생선이 있으면 훔치러 간다. 없으면 잔다.</summary>
        public void StartIdleMischief()
        {
            if (_steal != StealStep.None) return;
            if (Game.Bucket != null && Game.Bucket.Count > 0)
            {
                _steal = StealStep.WalkThere;
                _stepTime = 0f;
                _walkFrom = transform.position.x;
                _walkTo = Game.Bucket.transform.position.x - 0.55f;
                _walkDur = 1.6f;
                _sleeping = false;
            }
            else
            {
                SetSleeping(true);
                if (!RecentlySpoke(8f)) Say(LineType.CatSleepy, 2.2f);
            }
        }

        /// <summary>주인공이 깨면: 하던 짓 멈추고 제자리로.</summary>
        public void WakeUp()
        {
            _sleeping = false;
            if (_steal == StealStep.WalkThere || _steal == StealStep.Eat)
            {
                _steal = StealStep.WalkBack;
                _stepTime = 0f;
                _walkFrom = transform.position.x;
                _walkTo = _homeX;
                _walkDur = 0.6f;
                React(Mood.Surprised, 0.8f, 0.2f);
            }
        }

        void UpdateSteal(float dt)
        {
            _stepTime += dt;
            switch (_steal)
            {
                case StealStep.WalkThere:
                case StealStep.WalkBack:
                case StealStep.Walk:
                {
                    float k = Mathf.Clamp01(_stepTime / _walkDur);
                    var p = transform.position;
                    p.x = Mathf.Lerp(_walkFrom, _walkTo, Mathf.SmoothStep(0f, 1f, k));
                    transform.position = p;
                    float dir = Mathf.Sign(_walkTo - _walkFrom);
                    visual.localScale = new Vector3(dir < 0f ? -1f : 1f, 1f, 1f);
                    visual.localPosition = new Vector3(0f, Mathf.Abs(Mathf.Sin(_stepTime * 12f)) * 0.06f, 0f);
                    if (k >= 1f)
                    {
                        visual.localPosition = Vector3.zero;
                        if (_steal == StealStep.Walk)
                        {
                            _steal = StealStep.None;
                            visual.localScale = Vector3.one;
                        }
                        else if (_steal == StealStep.WalkThere)
                        {
                            _steal = StealStep.Eat;
                            _stepTime = 0f;
                            visual.localScale = Vector3.one;
                            _stolen = Game.Bucket != null ? Game.Bucket.RemoveTop() : null;
                            Say(LineType.CatSteal, 2.4f);
                            React(Mood.Happy, 1.8f, 0f);
                        }
                        else
                        {
                            _steal = StealStep.None;
                            visual.localScale = Vector3.one;
                            SetSleeping(true);
                        }
                    }
                    break;
                }
                case StealStep.Eat:
                {
                    visual.localScale = new Vector3(1f, 1f + Mathf.Abs(Mathf.Sin(_stepTime * 14f)) * 0.04f, 1f);
                    if (Game.Fx != null && Random.value < dt * 8f) Game.Fx.Crumbs(bubbleAnchor.position + new Vector3(0.25f, -0.55f, 0f), new Color(0.85f, 0.6f, 0.35f), 2);
                    if (_stepTime >= 1.8f)
                    {
                        if (Game.State != null) Game.State.Save.stats.catSteals++;
                        if (_stolen != null && Game.Chance(0.45f) && Game.State != null)
                        {
                            int tip = Game.Rng.Next(1, 4) * 10;
                            Game.State.AddMoney(tip);
                            Say(FunnyLines.Get(LineType.CatStealTip, tip), 2.6f);
                        }
                        _steal = StealStep.WalkBack;
                        _stepTime = 0f;
                        _walkFrom = transform.position.x;
                        _walkTo = _homeX;
                        _walkDur = 1.4f;
                    }
                    break;
                }
            }
        }

        // ------------------------------------------------------------- update

        void Update()
        {
            float dt = Time.deltaTime;
            float t = Time.time;

            if (_steal != StealStep.None) UpdateSteal(dt);

            float tailSpeed = _sleeping ? 0.8f : 2.2f;
            tailPivot.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(t * tailSpeed) * (_sleeping ? 4f : 12f));

            if (_hop > 0f && _steal == StealStep.None)
            {
                _hop = Mathf.Max(0f, _hop - Time.unscaledDeltaTime * 2.8f);
                float h = Mathf.Sin((1f - _hop) * Mathf.PI) * _hopHeight;
                visual.localPosition = new Vector3(0f, h, 0f);
                float squash = 1f + (_hop > 0.85f ? -0.06f : 0.04f * Mathf.Sin((1f - _hop) * Mathf.PI));
                visual.localScale = new Vector3(2f - squash, squash, 1f);
            }
            else if (_steal == StealStep.None)
            {
                float breath = 1f + Mathf.Sin(t * (_sleeping ? 1.2f : 2.4f)) * 0.015f;
                visual.localScale = new Vector3(1f, breath, 1f);
                visual.localPosition = Vector3.zero;
            }

            if (_moodTimer > 0f)
            {
                _moodTimer -= Time.unscaledDeltaTime;
                if (_moodTimer <= 0f) _mood = Mood.Normal;
            }

            _blink -= dt;
            bool blinking = false;
            if (_blink <= 0f)
            {
                blinking = true;
                if (_blink < -0.12f) _blink = Random.Range(2.5f, 5.5f);
            }

            Sprite f;
            if (_sleeping) f = _sleep;
            else if (_mood == Mood.Surprised) f = _surprised;
            else if (_mood == Mood.Happy) f = _happy;
            else f = blinking ? _sleep : _open;
            face.sprite = f;

            if (_sleeping && Game.Fx != null)
            {
                _zTimer -= dt;
                if (_zTimer <= 0f)
                {
                    _zTimer = 1.4f;
                    Game.Fx.Zzz(bubbleAnchor.position + new Vector3(0.2f, -0.25f, 0f));
                }
            }

            // 심심할 때 수다 (낚시 중 방해되지 않게 대기/기다림 상태에서만)
            _chatTimer -= dt;
            if (_chatTimer <= 0f)
            {
                _chatTimer = Random.Range(22f, 40f);
                bool calm = Game.Fishing != null && Game.Fishing.IsCalm;
                if (calm && !_sleeping && _steal == StealStep.None && !RecentlySpoke(10f)) Say(LineType.CatIdle);
            }
        }
    }
}
