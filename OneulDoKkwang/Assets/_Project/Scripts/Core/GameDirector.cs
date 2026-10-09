using System.Collections;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 큰 흐름 연출: 첫 실행 인트로(하와이 도착), 재방문 인사, 장소 이동(페이드), 시간대/날씨/요일 알림, 세이브 초기화.
    /// </summary>
    public sealed class GameDirector : MonoBehaviour
    {
        public bool IsBusy { get; private set; }
        bool _skip;
        Coroutine _running;

        public void Init()
        {
            if (Game.Clock != null)
            {
                Game.Clock.PeriodChanged += OnPeriodChanged;
                Game.Clock.DayChanged += OnDayChanged;
            }
            if (Game.Weather != null) Game.Weather.Changed += OnWeatherChanged;
            if (Game.UI != null) Game.UI.InputArea.Tapped += OnTapped;
        }

        void OnDestroy()
        {
            if (Game.Clock != null)
            {
                Game.Clock.PeriodChanged -= OnPeriodChanged;
                Game.Clock.DayChanged -= OnDayChanged;
            }
            if (Game.Weather != null) Game.Weather.Changed -= OnWeatherChanged;
        }

        void OnTapped()
        {
            if (IsBusy) _skip = true;
        }

        void Update()
        {
            if (IsBusy && InputBridge.Down(InputBridge.KeyId.Action)) _skip = true;
        }

        // ------------------------------------------------------------- start

        public void StartGame()
        {
            var gm = Game.State;
            if (gm.Save.introSeen) Run(Greeting());
            else Run(Intro(false));
        }

        public void PlayIntro(bool replay)
        {
            Run(Intro(replay));
        }

        void Run(IEnumerator routine)
        {
            if (_running != null) StopCoroutine(_running);
            _running = StartCoroutine(routine);
        }

        IEnumerator Wait(float seconds)
        {
            float end = Time.unscaledTime + seconds;
            while (Time.unscaledTime < end && !_skip) yield return null;
        }

        IEnumerator Intro(bool replay)
        {
            IsBusy = true;
            _skip = false;
            var ui = Game.UI;
            var gm = Game.State;
            Game.Fishing.EnterBusy();
            ui.CloseAllModals();
            ui.Fader.SetBlack(1f);
            ui.SetHudVisible(false);
            ui.Intro.Letterbox(true, 0.01f);

            // 인트로는 언제나 와이키키 해변 도착
            var beach = gm.Database.StarterLocation;
            if (beach != null && gm.Location != beach)
            {
                gm.SetLocation(beach);
                Game.World.BuildLocation(beach);
            }
            var L = Game.World.Layout;
            Game.Player.PlaceAt(new Vector2(L.playerX - 7f, L.groundY));
            Game.Cat.PlaceAt(new Vector2(L.catX - 7.5f, L.groundY));
            Game.Cat.SetHome(L.catX);
            yield return null;

            ui.Fader.FadeTo(0f, 1.1f);
            ui.Intro.Caption("하와이 · 와이키키 해변", 2.6f);
            Game.Player.WalkTo(L.playerX, 2.4f, null);
            Game.Cat.WalkTo(L.catX, 2.7f);
            yield return Wait(2.8f);
            if (!_skip)
            {
                ui.PlayerBubble.Show("드디어 하와이다! 휴가다!", 1.6f);
                yield return Wait(2f);
            }
            if (!_skip)
            {
                ui.PlayerBubble.Show("휴가 왔는데… 낚싯대밖에 안 챙겼다.", 2.2f);
                yield return Wait(2.8f);
            }
            if (!_skip)
            {
                Game.Cat.React(CatCompanion.Mood.Happy, 1.5f, 0.2f);
                Game.Cat.Say("냥. 그럼 낚시하면 되냥. (화관은 챙겼다냥)", 2.4f);
                yield return Wait(2.8f);
            }
            // 스킵했든 아니든 정리
            Game.Player.PlaceAt(new Vector2(L.playerX, L.groundY));
            Game.Cat.PlaceAt(new Vector2(L.catX, L.groundY));
            ui.Fader.FadeTo(0f, 0.2f);
            ui.Intro.Letterbox(false, 0.5f);
            ui.Intro.HideCaption();
            ui.Intro.ShowTitle(2.4f);
            ui.SetHudVisible(true);
            _skip = false;
            gm.Save.introSeen = true;
            if (Game.Saver != null) Game.Saver.MarkDirty();
            IsBusy = false;
            Game.Fishing.ExitBusy();
            ui.Announcer.Toast(replay ? "다시 하와이 도착!" : "꾹 눌러서 던져 보세요!");
            _running = null;
        }

        IEnumerator Greeting()
        {
            IsBusy = true;
            _skip = false;
            var ui = Game.UI;
            Game.Fishing.EnterBusy();
            ui.Fader.SetBlack(1f);
            ui.SetHudVisible(true);
            yield return null;
            ui.Fader.FadeTo(0f, 0.8f);
            var loc = Game.State.Location;
            if (loc != null) ui.Intro.Caption(loc.arrivalCaption, 1.8f);
            yield return Wait(0.6f);
            Game.Cat.Say(LineType.CatGreeting, 2.6f);
            IsBusy = false;
            _skip = false;
            Game.Fishing.ExitBusy();
            _running = null;
        }

        // ------------------------------------------------------------- travel

        public void Travel(LocationData loc)
        {
            if (loc == null || IsBusy) return;
            Run(TravelRoutine(loc));
        }

        IEnumerator TravelRoutine(LocationData loc)
        {
            IsBusy = true;
            _skip = false;
            var ui = Game.UI;
            Game.Fishing.EnterBusy();
            bool done = false;
            ui.Fader.FadeTo(1f, 0.4f, () => done = true);
            while (!done) yield return null;
            Game.State.SetLocation(loc);
            Game.World.BuildLocation(loc);
            yield return null;
            done = false;
            ui.Fader.FadeTo(0f, 0.6f, () => done = true);
            ui.Intro.Caption(loc.arrivalCaption, 2.2f);
            while (!done) yield return null;
            if (!string.IsNullOrEmpty(loc.arrivalLine)) Game.Cat.Say(loc.arrivalLine, 2.8f);
            IsBusy = false;
            _skip = false;
            Game.Fishing.ExitBusy();
            _running = null;
        }

        // ------------------------------------------------------------- announcements

        bool CatFree => Game.Cat != null && !Game.Cat.RecentlySpoke(6f) && Game.Fishing != null && Game.Fishing.IsCalm && !IsBusy;

        void OnPeriodChanged(TimeOfDay p)
        {
            if (Game.UI == null) return;
            switch (p)
            {
                case TimeOfDay.Sunset:
                    Game.UI.Announcer.Toast("노을이 진다… 다른 녀석들이 나오기 시작한다");
                    if (CatFree) Game.Cat.Say(LineType.CatSunset);
                    break;
                case TimeOfDay.Night:
                    Game.UI.Announcer.Toast("밤이 되었다");
                    if (CatFree) Game.Cat.Say(LineType.CatNight);
                    break;
                default:
                    Game.UI.Announcer.Toast("아침이 밝았다");
                    if (CatFree) Game.Cat.Say(LineType.CatDay);
                    break;
            }
        }

        void OnDayChanged(int day)
        {
            if (Game.UI == null || Game.Clock == null) return;
            var wd = Game.Clock.Weekday;
            if (wd == Weekday.Mon)
            {
                Game.UI.Announcer.Toast("월요일이다… (출근하기 싫은 붕어는 오늘 안 나온다)");
                if (CatFree) Game.Cat.Say(LineType.CatMonday);
            }
            else
            {
                Game.UI.Announcer.Toast("휴가 " + (day + 1) + "일차 · " + wd.Korean() + "요일");
            }
        }

        void OnWeatherChanged(WeatherType w)
        {
            if (Game.UI == null) return;
            if (w == WeatherType.Rain)
            {
                Game.UI.Announcer.Toast("비가 내리기 시작했다 (비 오는 날 특별한 녀석들이…)");
                if (CatFree) Game.Cat.Say(LineType.CatRain);
            }
            else
            {
                Game.UI.Announcer.Toast("비가 그쳤다");
                if (CatFree) Game.Cat.Say(LineType.CatRainStop);
            }
        }

        // ------------------------------------------------------------- reset

        public void ResetSaveAndRestart()
        {
            if (Game.Saver != null) Game.Saver.enabled = false;
            SaveManager.Delete();
            if (GameBootstrap.Instance != null) GameBootstrap.Instance.Restart(true);
        }
    }
}
