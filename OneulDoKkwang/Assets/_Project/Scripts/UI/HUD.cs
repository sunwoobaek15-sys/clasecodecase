using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>상단: 돈 / 도감 / 연속, 시계(요일·시각·시간대·날씨) / 장소, 메뉴 버튼. 하단: 힌트, 장비.</summary>
    public sealed class HUD : MonoBehaviour
    {
        Text _money;
        Text _dex;
        Text _streak;
        RectTransform _streakPill;
        Text _clock;
        Image _periodIcon;
        Image _weatherIcon;
        Text _weather;
        Text _location;
        Text _hint;
        RectTransform _hintPill;
        CanvasGroup _hintGroup;
        Text _gear;
        RectTransform _moneyPill;

        long _shownMoney;
        long _targetMoney;
        float _moneyAnim;
        long _animFrom;
        int _clockTaps;
        float _clockTapTime;
        TimeOfDay _lastPeriod = (TimeOfDay)(-1);
        int _lastWeather = -1;

        public Button DexButton { get; private set; }
        public Button ShopButton { get; private set; }
        public Button MapButton { get; private set; }
        public Button SettingsButton { get; private set; }

        public static HUD Create(RectTransform parent, GameUI ui)
        {
            var root = UIBuilder.Rect(parent, "HUD");
            UIBuilder.Stretch(root);
            var h = root.gameObject.AddComponent<HUD>();

            // ---- 왼쪽 위: 돈
            var money = UIBuilder.Panel(root, "MoneyPill", UIColors.Panel, UIColors.Ink, true, false);
            money.sprite = SpriteFactory.Get("ui.pill");
            h._moneyPill = money.rectTransform;
            UIBuilder.Place(h._moneyPill, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(28f, -26f), new Vector2(330f, 74f));
            var coin = UIBuilder.Icon(money.rectTransform, "Coin", SpriteFactory.Get("ui.coin"), new Vector2(58f, 58f));
            UIBuilder.Place(coin.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(10f, 0f), new Vector2(58f, 58f));
            h._money = UIBuilder.Text(money.rectTransform, "Money", "0원", 36, UIColors.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            UIBuilder.Place(h._money.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(78f, 0f), new Vector2(240f, 60f));
            h._money.horizontalOverflow = HorizontalWrapMode.Overflow;

            var dexPill = UIBuilder.Panel(root, "DexPill", UIColors.Panel.WithAlpha(0.92f), UIColors.Ink, false, false);
            dexPill.sprite = SpriteFactory.Get("ui.pill");
            UIBuilder.Place(dexPill.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(34f, -110f), new Vector2(230f, 50f));
            h._dex = UIBuilder.Text(dexPill.rectTransform, "Dex", "도감 0/0", 26, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(h._dex.rectTransform, 4f);

            var streak = UIBuilder.Panel(root, "StreakPill", UIColors.Coral, UIColors.Ink, false, false);
            streak.sprite = SpriteFactory.Get("ui.pill");
            h._streakPill = streak.rectTransform;
            UIBuilder.Place(h._streakPill, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(274f, -110f), new Vector2(150f, 50f));
            h._streak = UIBuilder.Text(streak.rectTransform, "Streak", "", 26, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(h._streak.rectTransform, 4f);

            // ---- 가운데 위: 시계 + 장소
            var clock = UIBuilder.Panel(root, "ClockPill", UIColors.Panel, UIColors.Ink, true, true);
            clock.sprite = SpriteFactory.Get("ui.pill");
            UIBuilder.Place(clock.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -26f), new Vector2(430f, 74f));
            var clockBtn = clock.gameObject.AddComponent<Button>();
            clockBtn.transition = Selectable.Transition.None;
            clockBtn.onClick.AddListener(h.OnClockTapped);
            h._periodIcon = UIBuilder.Icon(clock.rectTransform, "Period", SpriteFactory.Get("ui.sun"), new Vector2(56f, 56f));
            UIBuilder.Place(h._periodIcon.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(14f, 0f), new Vector2(56f, 56f));
            h._clock = UIBuilder.Text(clock.rectTransform, "Clock", "금 15:00", 34, UIColors.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            UIBuilder.Place(h._clock.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(80f, 0f), new Vector2(220f, 60f));
            h._clock.horizontalOverflow = HorizontalWrapMode.Overflow;
            h._weatherIcon = UIBuilder.Icon(clock.rectTransform, "Weather", SpriteFactory.Get("ui.sun"), new Vector2(50f, 50f));
            UIBuilder.Place(h._weatherIcon.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-96f, 0f), new Vector2(50f, 50f));
            h._weather = UIBuilder.Text(clock.rectTransform, "WeatherText", "맑음", 28, UIColors.SubText, TextAnchor.MiddleLeft, FontStyle.Bold);
            UIBuilder.Place(h._weather.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-14f, 0f), new Vector2(80f, 50f));
            h._weather.horizontalOverflow = HorizontalWrapMode.Overflow;

            h._location = UIBuilder.Text(root, "Location", "", 28, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(h._location.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -106f), new Vector2(700f, 44f));
            h._location.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(h._location, UIColors.Ink, 3f);

            // ---- 오른쪽 위: 메뉴 버튼
            h.DexButton = h.MenuButton(root, "도감", "ui.book", 0, () => ui.OpenEncyclopedia());
            h.ShopButton = h.MenuButton(root, "상점", "ui.bag", 1, () => ui.OpenShop(ShopPanel.Tab.Rods));
            h.MapButton = h.MenuButton(root, "이동", "ui.map", 2, () => ui.OpenShop(ShopPanel.Tab.Places));
            h.SettingsButton = h.MenuButton(root, "설정", "ui.gear", 3, () => ui.OpenSettings());

            // ---- 아래: 힌트 + 장비
            var hint = UIBuilder.Panel(root, "HintPill", UIColors.Ink.WithAlpha(0.72f), new Color(0, 0, 0, 0), false, false);
            hint.sprite = SpriteFactory.Get("ui.pill");
            h._hintPill = hint.rectTransform;
            UIBuilder.Place(h._hintPill, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 34f), new Vector2(900f, 66f));
            h._hint = UIBuilder.Text(hint.rectTransform, "Hint", "", 30, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(h._hint.rectTransform, 8f);
            h._hint.horizontalOverflow = HorizontalWrapMode.Overflow;
            h._hintGroup = UIBuilder.Group(hint.gameObject);
            h._hintGroup.blocksRaycasts = false;

            h._gear = UIBuilder.Text(root, "Gear", "", 24, Color.white, TextAnchor.LowerLeft, FontStyle.Bold);
            UIBuilder.Place(h._gear.rectTransform, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(30f, 26f), new Vector2(520f, 70f));
            UIBuilder.AddOutline(h._gear, UIColors.Ink, 2.5f);
            return h;
        }

        Button MenuButton(RectTransform root, string label, string icon, int index, System.Action onClick)
        {
            var b = UIBuilder.Button(root, "Btn_" + label, null, UIColors.Panel, UIColors.Text, new Vector2(112f, 112f), onClick);
            var rt = (RectTransform)b.transform;
            UIBuilder.Place(rt, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-28f - (3 - index) * 126f, -20f), new Vector2(112f, 112f));
            var img = UIBuilder.Icon(rt, "Icon", SpriteFactory.Get(icon), new Vector2(62f, 62f));
            UIBuilder.Place(img.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -10f), new Vector2(62f, 62f));
            var t = UIBuilder.Text(rt, "Label", label, 24, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(t.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 6f), new Vector2(110f, 32f));
            return b;
        }

        public void Init()
        {
            var gm = Game.State;
            _shownMoney = _targetMoney = gm.Money;
            _money.text = UIBuilder.Money(_shownMoney);
            gm.MoneyChanged += OnMoneyChanged;
            gm.EquipmentChanged += Refresh;
            gm.LocationChanged += Refresh;
            gm.ProgressChanged += Refresh;
            gm.CatchRegistered += r => Refresh();
            Refresh();
            UpdateClock(true);
        }

        void OnDestroy()
        {
            if (Game.State == null) return;
            Game.State.MoneyChanged -= OnMoneyChanged;
            Game.State.EquipmentChanged -= Refresh;
            Game.State.LocationChanged -= Refresh;
            Game.State.ProgressChanged -= Refresh;
        }

        public void Refresh()
        {
            var gm = Game.State;
            if (gm == null) return;
            _dex.text = "도감 " + gm.DiscoveredCount + "/" + gm.TotalSpecies;
            int s = gm.Streak;
            _streakPill.gameObject.SetActive(s >= 2);
            _streak.text = s + "연속!";
            _location.text = gm.Location != null ? gm.Location.displayName : "";
            _gear.text = (gm.Rod != null ? gm.Rod.displayName : "-") + "  ·  " + (gm.Bait != null ? gm.Bait.displayName : "-");
        }

        void OnMoneyChanged(long before, long after)
        {
            _animFrom = _shownMoney;
            _targetMoney = after;
            _moneyAnim = 0f;
            Tweens.Punch(_moneyPill, after > before ? 0.12f : -0.06f, 0.3f);
        }

        public void SetHint(string text)
        {
            if (_hint.text == text) return;
            _hint.text = text ?? "";
            bool on = !string.IsNullOrEmpty(text);
            float w = Mathf.Clamp(_hint.preferredWidth + 80f, 320f, 1500f);
            _hintPill.sizeDelta = new Vector2(w, 66f);
            Tweens.Fade(_hintGroup, on ? 1f : 0f, 0.15f);
        }

        void OnClockTapped()
        {
            // 시계를 5번 빠르게 누르면 개발자 도구(설정 패널) 열기
            if (Time.unscaledTime - _clockTapTime > 0.6f) _clockTaps = 0;
            _clockTapTime = Time.unscaledTime;
            _clockTaps++;
            if (_clockTaps >= 5)
            {
                _clockTaps = 0;
                if (Game.UI != null) Game.UI.OpenSettings();
            }
        }

        void UpdateClock(bool force)
        {
            var clock = Game.Clock;
            if (clock == null) return;
            _clock.text = clock.Formatted;
            var p = clock.Period;
            if (force || p != _lastPeriod)
            {
                _lastPeriod = p;
                _periodIcon.sprite = SpriteFactory.Get(p == TimeOfDay.Day ? "ui.sun" : (p == TimeOfDay.Sunset ? "ui.sunset" : "ui.moon"));
            }
            int w = Game.Weather != null ? (int)Game.Weather.Current : 0;
            if (force || w != _lastWeather)
            {
                _lastWeather = w;
                bool rain = w == (int)WeatherType.Rain;
                _weatherIcon.sprite = SpriteFactory.Get(rain ? "ui.rain" : (p == TimeOfDay.Night ? "ui.moon" : "ui.sun"));
                _weather.text = rain ? "비" : "맑음";
            }
        }

        void Update()
        {
            UpdateClock(false);
            if (_shownMoney != _targetMoney)
            {
                _moneyAnim += Time.unscaledDeltaTime / 0.6f;
                float k = Ease.OutCubic(Mathf.Clamp01(_moneyAnim));
                _shownMoney = _moneyAnim >= 1f ? _targetMoney : (long)Mathf.Lerp(_animFrom, _targetMoney, k);
                _money.text = UIBuilder.Money(_shownMoney);
            }
        }
    }
}
