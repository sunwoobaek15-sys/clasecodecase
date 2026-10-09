using System;
using UnityEngine;

namespace OneulDoKkwang
{
    public enum FishingState
    {
        Intro,
        Idle,
        Charging,
        Casting,
        Waiting,
        Bite,
        Reeling,
        Result,
        Recover,
        Busy,
    }

    public enum FailReason
    {
        EarlyHook,
        Missed,
        Escaped,
    }

    /// <summary>
    /// 낚시 흐름 상태머신: Idle → Charging → Casting → Waiting → Bite → Reeling → Result (→ Idle)
    /// 실패하면 Recover(찌 회수) → Idle. 메뉴/이동/인트로 중에는 Busy/Intro.
    /// </summary>
    [DefaultExecutionOrder(10)]
    public sealed class FishingController : MonoBehaviour
    {
        [Header("구성 요소")]
        public CastController cast;
        public BiteSystem bite;
        public CatchResolver resolver;
        public Bobber bobber;
        public FishingLine line;

        [Header("방치 연출 (초)")]
        public float dozeAfter = 18f;
        public float mischiefAfter = 26f;

        readonly StateMachine<FishingState> _fsm = new StateMachine<FishingState>();
        FishingInput _input;

        CatchData _target;
        ReelModel _reel;
        float _castPower;
        bool _perfect;
        bool _quickHook;
        float _landX;
        float _idleTime;
        bool _mischief;
        CatchResult _result;
        SpriteRenderer _showcase;
        bool _showcaseHolding;
        float _bigIntro;

        public FishingState State => _fsm.Current;
        public bool IsCalm => _fsm.Is(FishingState.Idle) || _fsm.Is(FishingState.Waiting);
        public bool CanOpenMenus => _fsm.Is(FishingState.Idle) || _fsm.Is(FishingState.Waiting) || _fsm.Is(FishingState.Recover);
        public event Action<FishingState, FishingState> StateChanged;

        public void Init(FishingInput input)
        {
            _input = input;
            _fsm.Add(FishingState.Intro, () => { _input.ResetAll(); Hint(""); });
            _fsm.Add(FishingState.Idle, EnterIdle, UpdateIdle, ExitIdle);
            _fsm.Add(FishingState.Charging, EnterCharging, UpdateCharging, () => { if (Game.UI != null) Game.UI.Power.Hide(); });
            _fsm.Add(FishingState.Casting, EnterCasting, UpdateFollowBobber);
            _fsm.Add(FishingState.Waiting, EnterWaiting, UpdateWaiting);
            _fsm.Add(FishingState.Bite, EnterBite, UpdateBite, () => bobber.StopBite());
            _fsm.Add(FishingState.Reeling, EnterReeling, UpdateReeling, ExitReeling);
            _fsm.Add(FishingState.Result, EnterResult, UpdateResult);
            _fsm.Add(FishingState.Recover, EnterRecover, d => _input.Clear());
            _fsm.Add(FishingState.Busy, () => { _input.ResetAll(); Hint(""); });
            _fsm.Changed += (a, b) => { if (StateChanged != null) StateChanged(a, b); };
            bite.Nibble += OnNibble;
            _fsm.Start(FishingState.Intro);
        }

        /// <summary>인트로가 끝나면 호출.</summary>
        public void BeginPlay()
        {
            _fsm.Go(FishingState.Idle);
        }

        /// <summary>장소 이동/인트로 재생 등: 하던 낚시를 접고 대기.</summary>
        public void EnterBusy()
        {
            CleanupTransient();
            bobber.Hang(true);
            _fsm.Go(FishingState.Busy);
        }

        public void ExitBusy()
        {
            bobber.Hang(true);
            _fsm.Go(FishingState.Idle);
        }

        void Update()
        {
            _fsm.Update(Time.deltaTime);
        }

        void Hint(string s)
        {
            if (Game.UI != null) Game.UI.Hint(s);
        }

        void Follow(float x)
        {
            if (Game.Cam != null) Game.Cam.Follow(x);
        }

        LocationLayout Layout => Game.World != null ? Game.World.Layout : LocationLayout.For(LocationTheme.Beach);

        // ================================================================ Idle

        void EnterIdle()
        {
            _input.Clear();
            _idleTime = 0f;
            _mischief = false;
            if (Game.Player != null) Game.Player.PoseIdle();
            if (bobber.Current != Bobber.Mode.Hanging && bobber.Current != Bobber.Mode.Retrieving) bobber.Hang(true);
            line.showUnderwater = false;
            line.showHooked = false;
            line.slack = 0.3f;
            Follow(0f);
            Hint("화면을 꾹 눌러 파워를 모으고, 놓으면 던져요!");
        }

        void UpdateIdle(float dt)
        {
            if (Game.UI != null && Game.UI.IsModalOpen) return;
            if (_input.ConsumePress())
            {
                if (Game.Player != null && Game.Player.IsDozing)
                {
                    WakeUp();
                    return;
                }
                if (Game.Cat != null) Game.Cat.WakeUp();
                _fsm.Go(FishingState.Charging);
                return;
            }
            _idleTime += dt;
            if (_idleTime > dozeAfter && Game.Player != null && !Game.Player.IsDozing)
            {
                Game.Player.Doze(true);
                Hint("Zzz… (탭해서 깨우기)");
            }
            if (_idleTime > mischiefAfter && !_mischief)
            {
                _mischief = true;
                if (Game.Cat != null) Game.Cat.StartIdleMischief();
            }
        }

        void ExitIdle()
        {
            if (Game.Player != null && Game.Player.IsDozing) Game.Player.Doze(false);
        }

        void WakeUp()
        {
            Game.Player.Doze(false);
            Game.Player.Surprise(0.7f);
            if (Game.UI != null) Game.UI.PlayerBubble.Show(FunnyLines.Get(LineType.PlayerWake), 2f);
            if (Game.Cat != null) Game.Cat.WakeUp();
            _idleTime = 0f;
            _mischief = false;
            Hint("화면을 꾹 눌러 파워를 모으고, 놓으면 던져요!");
        }

        // ================================================================ Charging

        void EnterCharging()
        {
            _input.DropStaleRelease();
            cast.BeginCharge();
            if (Game.UI != null)
            {
                Game.UI.Power.SetPerfectThreshold(cast.perfectThreshold);
                Game.UI.Power.Show();
            }
            Hint("놓으면 던져요! (맨 위 = 퍼펙트)");
        }

        void UpdateCharging(float dt)
        {
            cast.TickCharge(dt);
            if (Game.UI != null) Game.UI.Power.Set(cast.Power);
            if (Game.Player != null) Game.Player.PoseCharge(cast.Power);
            if (InputBridge.Down(InputBridge.KeyId.Cancel))
            {
                _fsm.Go(FishingState.Idle);
                return;
            }
            bool released = _input.ConsumeRelease() || !_input.Held;
            if (released && _fsm.TimeInState > 0.08f) _fsm.Go(FishingState.Casting);
        }

        // ================================================================ Casting

        void EnterCasting()
        {
            _input.Clear();
            _castPower = cast.FinalPower;
            _perfect = cast.IsPerfect;
            var gm = Game.State;
            gm.RegisterCast();
            if (Game.Player != null) Game.Player.PoseCast();
            if (Game.Audio != null) Game.Audio.Play(Sfx.Cast);

            var L = Layout;
            float x = CastController.TargetX(L, gm.Rod, _castPower);
            var water = WaterSurface.Instance;
            float y = water != null ? water.Height(x) : LocationLayout.WaterY;
            Vector3 from = Game.Player != null ? Game.Player.RodTip : new Vector3(L.playerX, 1f, 0f);
            float dur = 0.55f + 0.45f * _castPower;
            float apex = 1.6f + 2.4f * _castPower;
            line.slack = 0.12f;
            bobber.Launch(from, new Vector3(x, y, 0f), dur, apex, OnLanded);
            Hint("");

            if (_perfect)
            {
                if (Game.UI != null) Game.UI.Announcer.Banner("퍼펙트 캐스팅!", BannerStyle.Good, 1.1f);
                if (Game.Fx != null) Game.Fx.Sparkles(from, UIColors.Yellow, 10, 0.8f);
                if (Game.Cat != null) Game.Cat.OnPerfectCast();
                if (Game.UI != null && Game.Chance(0.5f)) Game.UI.PlayerBubble.Show(FunnyLines.Get(LineType.PlayerPerfectCast), 1.4f);
            }
        }

        void UpdateFollowBobber(float dt)
        {
            Follow(bobber.Position.x - 6f);
            _input.Clear();
        }

        void OnLanded()
        {
            var p = bobber.Position;
            if (Game.Fx != null) Game.Fx.Splash(new Vector2(p.x, p.y), 0.6f + _castPower * 0.6f);
            if (Game.UI != null && Game.Player != null)
            {
                float m = CastController.Meters(Game.Player.transform.position.x, p.x);
                Game.UI.Announcer.FloatText(p + new Vector3(0f, 0.9f, 0f), m.ToString("0.0") + "m", Color.white, 34);
            }
            if (_fsm.Is(FishingState.Casting)) _fsm.Go(FishingState.Waiting);
        }

        // ================================================================ Waiting

        void EnterWaiting()
        {
            _input.Clear();
            _landX = bobber.X;
            var gm = Game.State;
            var ctx = gm.BuildContext(_castPower, _perfect);
            _target = resolver.Roll(ctx);
            bite.Begin(_target, gm.Bait, ctx.weather);
            line.slack = 0.45f;
            line.showUnderwater = true;
            line.showHooked = false;
            if (Game.Player != null) Game.Player.PoseWaiting();
            Hint("입질을 기다리는 중… 찌가 쑥 들어가면 탭!");
        }

        void UpdateWaiting(float dt)
        {
            Follow(bobber.Position.x - 6f);
            if (Game.UI != null && Game.UI.IsModalOpen) return;
            if (_input.ConsumePress())
            {
                Fail(FailReason.EarlyHook);
                return;
            }
            if (bite.TickWait(dt)) _fsm.Go(FishingState.Bite);
        }

        void OnNibble()
        {
            if (!_fsm.Is(FishingState.Waiting)) return;
            bobber.Nibble();
        }

        // ================================================================ Bite

        void EnterBite()
        {
            _input.Clear();
            bite.StartWindow();
            bobber.StartBite(bite.hookWindow);
            if (Game.Audio != null) Game.Audio.Play(Sfx.Bite);
            if (Game.Cam != null) Game.Cam.Shake(0.15f);
            if (Game.Cat != null) Game.Cat.OnBite();
            Hint("지금! 탭!!");
        }

        void UpdateBite(float dt)
        {
            Follow(bobber.Position.x - 6f);
            if (_input.ConsumePress())
            {
                _quickHook = bite.IsQuickHook;
                Hooked();
                return;
            }
            if (bite.TickWindow(dt)) Fail(FailReason.Missed);
        }

        void Hooked()
        {
            if (Game.Audio != null) Game.Audio.Play(Sfx.Hook);
            if (Game.Player != null) Game.Player.Surprise(0.8f);
            if (Game.Fx != null) Game.Fx.Splash(new Vector2(bobber.Position.x, bobber.Position.y), 0.8f);
            var ui = Game.UI;
            _bigIntro = 0f;
            if (_target != null && _target.IsBigEvent)
            {
                _bigIntro = 1f;
                if (Game.TimeScale != null) Game.TimeScale.SlowMo(0.3f, 1f);
                if (Game.Cam != null) { Game.Cam.Shake(0.8f); Game.Cam.ZoomPunch(1.12f, 1.4f); }
                if (ui != null)
                {
                    ui.Fader.Flash(0.85f, 0.6f);
                    ui.Fader.Vignette(1f);
                    bool legend = _target.rarity == CatchRarity.Legendary;
                    ui.Announcer.Banner(legend ? "전설의 기운이…!" : "??? 무언가가 걸렸다…", BannerStyle.Legend, 1.8f, legend ? "바다가 술렁인다" : "이건… 물고기가 아니다");
                    ui.PlayerBubble.Show(FunnyLines.Get(LineType.PlayerBigHook), 1.6f);
                }
                if (Game.Cat != null) Game.Cat.OnHooked(_target);
            }
            else
            {
                if (ui != null)
                {
                    if (_quickHook) ui.Announcer.Banner("칼챔질!", BannerStyle.Good, 0.9f, "시작 게이지 +10%");
                    else if (Game.Chance(0.35f)) ui.PlayerBubble.Show(FunnyLines.Get(LineType.PlayerHook), 1.2f);
                }
            }
            _fsm.Go(FishingState.Reeling);
        }

        // ================================================================ Reeling

        void EnterReeling()
        {
            var gm = Game.State;
            var settings = ReelSettings.For(_target, gm.Rod, _quickHook);
            _reel = new ReelModel(settings, Game.Rng.Next());
            var water = WaterSurface.Instance;
            if (Game.UI != null) Game.UI.Reel.Show(_reel, _target, water != null ? water.Colors.surface : UIColors.Teal);
            bobber.BeginReel();
            line.slack = 0.03f;
            line.showUnderwater = true;
            line.showHooked = true;
            line.SetHookedSprite(SpriteFactory.Icon(_target));
            Hint("꾹 누르면 초록 바 ↑ · 물고기를 초록 바 안에 가둬요!");
            if (_target != null && !string.IsNullOrEmpty(_target.reelShout) && Game.UI != null)
            {
                float delay = _target.IsBigEvent ? 1.2f : 0.4f;
                var shout = _target.reelShout;
                Tweens.Wait(this, delay, () => { if (_fsm.Is(FishingState.Reeling)) Game.UI.PlayerBubble.Show(shout, 2.4f); });
            }
        }

        void UpdateReeling(float dt)
        {
            if (Game.UI != null && Game.UI.IsModalOpen) return;
            _input.ConsumePress();
            _input.ConsumeRelease();
            if (_bigIntro > 0f)
            {
                _bigIntro -= Time.unscaledDeltaTime;
                if (_bigIntro > 0f)
                {
                    Game.UI.Reel.Render(0f);
                    return;
                }
            }
            _reel.Tick(dt, _input.Held);
            var ui = Game.UI;
            if (ui != null) ui.Reel.Render(dt);

            if (_reel.PhaseChanged && ui != null)
            {
                ui.Reel.SetPhase(_reel.Phase);
                ui.Announcer.Banner(_reel.Phase == 2 ? "2페이즈: 왕의 분노!" : "3페이즈: 왕관 던지기!!", BannerStyle.Legend, 1.3f);
                ui.Fader.Flash(0.45f, 0.35f, new Color(1f, 0.6f, 0.2f));
                if (Game.Cam != null) Game.Cam.Shake(0.55f);
                if (Game.Cat != null) Game.Cat.React(CatCompanion.Mood.Surprised, 1.2f, 0.25f);
            }

            var L = Layout;
            float k = Ease.OutQuad(Mathf.Clamp01(_reel.Progress));
            float x = Mathf.Lerp(_landX, Mathf.Max(L.shoreX + 1.2f, L.castMinX), k * 0.7f);
            bobber.SetReelX(x, _reel.InZone ? 0.45f : 1.1f);
            if (Game.Player != null) Game.Player.PoseReel(_reel.InZone ? 0.25f : 0.9f);
            Follow(bobber.Position.x - 6f);

            if (_reel.Done)
            {
                if (_reel.Success) _fsm.Go(FishingState.Result);
                else Fail(FailReason.Escaped, _reel.BestProgress);
            }
        }

        void ExitReeling()
        {
            if (Game.UI != null)
            {
                Game.UI.Reel.Hide();
                Game.UI.Fader.Vignette(0f);
            }
        }

        // ================================================================ Result

        void EnterResult()
        {
            _input.Clear();
            _result = resolver.Finalize(_target);
            var c = _result.data;
            var ui = Game.UI;
            if (Game.Audio != null) Game.Audio.Play(Sfx.Success);
            if (Game.Player != null) Game.Player.PoseShowCatch();
            line.showHooked = false;
            line.showUnderwater = false;
            Hint("");

            var from = bobber.Position;
            if (Game.Fx != null) Game.Fx.Splash(new Vector2(from.x, from.y), 1f);
            bobber.Retrieve(0.45f, null);
            Follow(0f);

            // 잡은 것이 물 밖으로 휙 날아와 머리 위로
            _showcase = SpriteFactory.Renderer(transform, "Showcase: " + c.displayName, SpriteFactory.Icon(c), Sorting.Effects + 10);
            _showcaseHolding = false;
            var target = Game.Player != null ? Game.Player.bubbleAnchor.position + new Vector3(0.25f, -0.15f, 0f) : from + Vector3.up * 2f;
            var mid = Vector3.Lerp(from, target, 0.5f) + new Vector3(0f, 2.2f, 0f);
            var sc = _showcase;
            if (TweenRunner.Instance != null)
            {
                TweenRunner.Instance.To(sc, 0.65f, p =>
                {
                    if (sc == null) return;
                    var a = Vector3.Lerp(from, mid, p);
                    var b = Vector3.Lerp(mid, target, p);
                    sc.transform.position = Vector3.Lerp(a, b, p);
                    sc.transform.rotation = Quaternion.Euler(0f, 0f, (1f - p) * 540f);
                    float s = Mathf.Lerp(0.3f, 0.8f, p);
                    sc.transform.localScale = new Vector3(s, s, 1f);
                }, Ease.OutQuad, () => OnShowcaseArrived());
            }
            else
            {
                OnShowcaseArrived();
            }

            if (Game.Fx != null)
            {
                Color rc = UIColors.Rarity(c.rarity);
                Game.Fx.Sparkles(target, rc, c.rarity == CatchRarity.Common ? 6 : 14, 1f, true);
                if (_result.price > 0 && ui != null) Tweens.Wait(this, 0.65f, () => ui.Announcer.FloatText(target + new Vector3(0f, 0.6f, 0f), "+" + UIBuilder.Money(_result.price), UIColors.Yellow, 46));
            }
            if (c.IsBigEvent)
            {
                if (Game.Fx != null) Game.Fx.Confetti(target + new Vector3(0f, 0.5f, 0f), 70);
                if (Game.Cam != null) Game.Cam.Shake(0.6f);
                if (ui != null)
                {
                    ui.Fader.Flash(0.7f, 0.5f, new Color(1f, 0.95f, 0.7f));
                    ui.Announcer.Banner(c.rarity == CatchRarity.Legendary ? "전설 획득!!" : "정체: 진짜 꽝!!", BannerStyle.Legend, 2f);
                }
            }
            else if (_result.isNew && ui != null)
            {
                ui.Announcer.Banner("NEW! 도감 등록", BannerStyle.Good, 1.1f);
            }
            if (Game.Cat != null)
            {
                var r = _result;
                Tweens.Wait(this, 0.5f, () => { if (Game.Cat != null) Game.Cat.OnSuccess(r); });
            }
            if (c.special != CatchSpecial.LongName && _result.sizeCm < 5f && ui != null && !c.IsBigEvent)
                ui.PlayerBubble.Show(FunnyLines.Get(LineType.PlayerTinyCatch), 1.6f);
        }

        void OnShowcaseArrived()
        {
            _showcaseHolding = true;
            if (Game.UI != null && _result != null) Game.UI.Result.Show(_result, OnResultClosed);
        }

        void UpdateResult(float dt)
        {
            _input.Clear();
            if (_showcase != null && _showcaseHolding && Game.Player != null)
            {
                var basePos = Game.Player.bubbleAnchor.position + new Vector3(0.25f, -0.15f, 0f);
                _showcase.transform.position = basePos + new Vector3(0f, Mathf.Sin(Time.unscaledTime * 3f) * 0.06f, 0f);
                _showcase.transform.rotation = Quaternion.Euler(0f, 0f, Mathf.Sin(Time.unscaledTime * 2.2f) * 6f);
            }
        }

        void OnResultClosed()
        {
            var sc = _showcase;
            _showcase = null;
            _showcaseHolding = false;
            var res = _result;
            if (sc != null && TweenRunner.Instance != null)
            {
                var from = sc.transform.position;
                if (res != null && res.released)
                {
                    // 방생: 바다로 돌려보낸다
                    var to = new Vector3(Layout.shoreX + 3f, LocationLayout.WaterY - 0.4f, 0f);
                    if (Game.Fx != null) Game.Fx.Hearts(from, 3);
                    TweenRunner.Instance.To(sc, 0.9f, p =>
                    {
                        if (sc == null) return;
                        sc.transform.position = Vector3.Lerp(from, to, p) + new Vector3(0f, Mathf.Sin(p * Mathf.PI) * 1.2f, 0f);
                        sc.color = new Color(1f, 1f, 1f, 1f - p * p);
                    }, Ease.Linear, () =>
                    {
                        if (sc != null)
                        {
                            if (Game.Fx != null) Game.Fx.Splash(new Vector2(to.x, LocationLayout.WaterY), 0.5f);
                            Destroy(sc.gameObject);
                        }
                    });
                }
                else
                {
                    var to = Game.Bucket != null ? Game.Bucket.RimPosition : from;
                    TweenRunner.Instance.To(sc, 0.35f, p =>
                    {
                        if (sc == null) return;
                        sc.transform.position = Vector3.Lerp(from, to, p) + new Vector3(0f, Mathf.Sin(p * Mathf.PI) * 0.6f, 0f);
                        float s = Mathf.Lerp(0.8f, 0.36f, p);
                        sc.transform.localScale = new Vector3(s, s, 1f);
                    }, Ease.InQuad, () =>
                    {
                        if (sc != null) Destroy(sc.gameObject);
                        if (Game.Bucket != null && res != null) Game.Bucket.Add(res.data);
                    });
                }
            }
            else if (sc != null)
            {
                Destroy(sc.gameObject);
            }
            if (_fsm.Is(FishingState.Result)) _fsm.Go(FishingState.Idle);
        }

        // ================================================================ Fail / Recover

        void Fail(FailReason reason, float bestProgress = 0f)
        {
            Game.State.RegisterFail();
            if (Game.Audio != null) Game.Audio.Play(Sfx.Fail);
            bobber.StopBite();
            string text;
            switch (reason)
            {
                case FailReason.EarlyHook:
                    text = FunnyLines.Get(LineType.EarlyHook);
                    break;
                case FailReason.Missed:
                    text = FunnyLines.Get(LineType.MissLate);
                    break;
                default:
                    bool special = _target != null && !string.IsNullOrEmpty(_target.escapeLine) && Game.Chance(0.65f);
                    text = special ? _target.escapeLine : FunnyLines.Get(LineType.Escape);
                    if (Game.Fx != null) Game.Fx.Splash(new Vector2(bobber.Position.x, bobber.Position.y), 0.7f);
                    break;
            }
            string sub = null;
            if (reason == FailReason.Escaped && bestProgress >= 0.7f) sub = "아깝다! " + Mathf.RoundToInt(bestProgress * 100f) + "%까지 갔다";
            else if (reason == FailReason.Missed) sub = "입질 후 0.6초 안에 탭!";
            if (Game.UI != null) Game.UI.Announcer.Banner(text, BannerStyle.Fail, 2.4f, sub);
            if (Game.Cat != null) Tweens.Wait(this, 1f, () => { if (Game.Cat != null) Game.Cat.OnFail(); });
            if (Game.Cam != null) Game.Cam.Shake(0.12f);
            _fsm.Go(FishingState.Recover);
        }

        void EnterRecover()
        {
            line.showUnderwater = false;
            line.showHooked = false;
            line.slack = 0.3f;
            if (Game.Player != null) Game.Player.PoseIdle();
            Hint("");
            Follow(0f);
            bobber.Retrieve(0.5f, () => { if (_fsm.Is(FishingState.Recover)) _fsm.Go(FishingState.Idle); });
        }

        void CleanupTransient()
        {
            if (Game.UI != null)
            {
                Game.UI.Reel.Hide();
                Game.UI.Power.Hide();
                Game.UI.Fader.Vignette(0f);
                if (Game.UI.Result.IsOpen) Game.UI.Result.Close();
            }
            if (_showcase != null)
            {
                Destroy(_showcase.gameObject);
                _showcase = null;
            }
            line.showUnderwater = false;
            line.showHooked = false;
            bobber.StopBite();
        }
    }
}
