using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>
    /// UI 루트. 캔버스(1920x1080 기준 스케일)와 모든 패널을 코드로 만들고, 모달이 열리면 게임을 멈춘다.
    /// 뒤 → 앞 순서: 입력 영역 → 말풍선 → 파워 게이지 → 릴 감기 → HUD → 알림 → 결과 카드 → 모달 → 인트로 → 화면 효과.
    /// </summary>
    public sealed class GameUI : MonoBehaviour
    {
        public Canvas Canvas { get; private set; }
        public RectTransform Root { get; private set; }
        public FishingInput Input { get; } = new FishingInput();
        public FishingInputArea InputArea { get; private set; }
        public HUD Hud { get; private set; }
        public PowerGauge Power { get; private set; }
        public ReelMinigame Reel { get; private set; }
        public ResultCard Result { get; private set; }
        public EncyclopediaPanel Encyclopedia { get; private set; }
        public ShopPanel Shop { get; private set; }
        public SettingsPanel Settings { get; private set; }
        public Announcer Announcer { get; private set; }
        public DialogueBubble PlayerBubble { get; private set; }
        public DialogueBubble CatBubble { get; private set; }
        public ScreenFader Fader { get; private set; }
        public IntroOverlay Intro { get; private set; }

        readonly List<ModalPanel> _modals = new List<ModalPanel>();

        public bool IsModalOpen => _modals.Count > 0;

        public static GameUI Build(Transform parent)
        {
            var go = new GameObject("UI (Canvas)", typeof(RectTransform));
            if (parent != null) go.transform.SetParent(parent, false);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            canvas.pixelPerfect = false;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();
            InputBridge.EnsureEventSystem();

            var ui = go.AddComponent<GameUI>();
            ui.Canvas = canvas;
            ui.Root = (RectTransform)go.transform;
            ui.BuildChildren();
            return ui;
        }

        void BuildChildren()
        {
            var area = UIBuilder.Image(Root, "FishingInputArea (화면 전체 탭)", null, new Color(0f, 0f, 0f, 0f), true);
            UIBuilder.Stretch(area.rectTransform);
            InputArea = area.gameObject.AddComponent<FishingInputArea>();
            InputArea.input = Input;

            var worldLayer = UIBuilder.Rect(Root, "WorldLayer (말풍선)");
            UIBuilder.Stretch(worldLayer);
            PlayerBubble = DialogueBubble.Create(worldLayer, Root, null, Color.white, UIColors.Text, "PlayerBubble");
            CatBubble = DialogueBubble.Create(worldLayer, Root, null, Hex.C("#FFF0F5"), UIColors.Text, "CatBubble");

            Power = PowerGauge.Create(Root, Root);
            Reel = ReelMinigame.Create(Root);
            Hud = HUD.Create(Root, this);
            Announcer = Announcer.Create(Root, Root);
            Result = ResultCard.Create(Root);
            Encyclopedia = EncyclopediaPanel.Create(Root);
            Shop = ShopPanel.Create(Root);
            Settings = SettingsPanel.Create(Root);
            Intro = IntroOverlay.Create(Root);
            Fader = ScreenFader.Create(Root);
        }

        public void BindAnchors(Transform playerAnchor, Transform catAnchor)
        {
            PlayerBubble.SetAnchor(playerAnchor);
            CatBubble.SetAnchor(catAnchor);
        }

        // ------------------------------------------------------------- modal / pause

        public void ModalOpened(ModalPanel p)
        {
            if (_modals.Contains(p)) return;
            _modals.Add(p);
            if (_modals.Count == 1 && Game.TimeScale != null) Game.TimeScale.PushPause();
            Input.ResetAll();
        }

        public void ModalClosed(ModalPanel p)
        {
            if (!_modals.Remove(p)) return;
            if (_modals.Count == 0 && Game.TimeScale != null) Game.TimeScale.PopPause();
            Input.ResetAll();
        }

        bool CanOpenMenus()
        {
            if (Result.IsOpen) return false;
            if (Game.Director != null && Game.Director.IsBusy) return false;
            if (Game.Fishing != null && !Game.Fishing.CanOpenMenus)
            {
                Announcer.Toast("낚시 중에는 잠깐만요!");
                return false;
            }
            return true;
        }

        public void OpenEncyclopedia()
        {
            if (!CanOpenMenus()) return;
            CloseAllModals();
            Encyclopedia.Open();
        }

        public void OpenShop(ShopPanel.Tab tab)
        {
            if (!CanOpenMenus()) return;
            CloseAllModals();
            Shop.OpenAt(tab);
        }

        public void OpenSettings()
        {
            if (Result.IsOpen) return;
            CloseAllModals();
            Settings.Open();
        }

        public void CloseAllModals()
        {
            var copy = new List<ModalPanel>(_modals);
            foreach (var m in copy) m.Close();
        }

        public void Hint(string text)
        {
            if (Hud != null) Hud.SetHint(text);
        }

        public void SetHudVisible(bool visible)
        {
            if (Hud == null) return;
            var g = UIBuilder.Group(Hud.gameObject);
            g.blocksRaycasts = visible;
            g.interactable = visible;
            Tweens.Fade(g, visible ? 1f : 0f, 0.35f);
        }

        void Update()
        {
            if (IsModalOpen || Result.IsOpen) return;
            if (InputBridge.Down(InputBridge.KeyId.Debug)) OpenSettings();
            else if (InputBridge.Down(InputBridge.KeyId.Encyclopedia)) OpenEncyclopedia();
            else if (InputBridge.Down(InputBridge.KeyId.Shop)) OpenShop(ShopPanel.Tab.Rods);
            else if (InputBridge.Down(InputBridge.KeyId.Map)) OpenShop(ShopPanel.Tab.Places);
        }
    }
}
