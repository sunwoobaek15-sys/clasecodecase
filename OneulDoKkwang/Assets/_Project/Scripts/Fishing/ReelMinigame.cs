using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>
    /// 스타듀밸리식 릴 감기 UI. 세로 트랙 안에서 물고기 아이콘(실루엣)이 도망다니고,
    /// 홀드하면 초록 바가 올라간다. 겹치면 오른쪽 게이지 상승, 벗어나면 하락. (로직은 ReelModel)
    /// </summary>
    public sealed class ReelMinigame : MonoBehaviour
    {
        RectTransform _panel;
        RectTransform _track;
        RectTransform _zone;
        Image _zoneImg;
        RectTransform _fish;
        Image _fishImg;
        Text _status;
        RectTransform _progressFill;
        Image _progressImg;
        Image _trackImg;
        Text _title;
        Text _hint;
        CanvasGroup _group;
        Image _frame;

        ReelModel _model;
        CatchData _catch;
        float _shake;
        float _blink;
        Vector2 _basePos;
        bool _visible;

        public bool Visible => _visible;

        static readonly Color ZoneOn = Hex.C("#51CF66", 0.92f);
        static readonly Color ZoneOff = Hex.C("#8CE99A", 0.55f);

        public static ReelMinigame Create(RectTransform parent)
        {
            var frame = UIBuilder.Panel(parent, "ReelMinigame (릴 감기)", UIColors.Panel, UIColors.Ink, true, false);
            var r = frame.gameObject.AddComponent<ReelMinigame>();
            r._frame = frame;
            r._panel = frame.rectTransform;
            r._basePos = new Vector2(0f, 10f);
            UIBuilder.Place(r._panel, new Vector2(0.37f, 0.5f), new Vector2(0.5f, 0.5f), r._basePos, new Vector2(250f, 720f));

            r._title = UIBuilder.Text(r._panel, "Title", "릴 감기!", 32, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(r._title.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -14f), new Vector2(240f, 44f));
            r._title.horizontalOverflow = HorizontalWrapMode.Overflow;

            r._trackImg = UIBuilder.Image(r._panel, "Track", SpriteFactory.Get("ui.round"), Hex.C("#2BB3C0"));
            r._track = r._trackImg.rectTransform;
            UIBuilder.Place(r._track, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(26f, 66f), new Vector2(128f, 580f));
            var shade = UIBuilder.Image(r._track, "Shade", SpriteFactory.Get("ui.gradient"), new Color(0f, 0f, 0.1f, 0.25f));
            UIBuilder.Stretch(shade.rectTransform, 6f);

            r._zoneImg = UIBuilder.Image(r._track, "CatchZone (초록 바)", SpriteFactory.Get("ui.round"), ZoneOn);
            r._zone = r._zoneImg.rectTransform;
            r._zone.anchorMin = new Vector2(0f, 0f);
            r._zone.anchorMax = new Vector2(1f, 0.25f);
            r._zone.offsetMin = new Vector2(8f, 0f);
            r._zone.offsetMax = new Vector2(-8f, 0f);
            UIBuilder.AddOutline(r._zoneImg, Hex.C("#2B8A3E"), 3f);

            r._fishImg = UIBuilder.Image(r._track, "Fish", null, new Color(0.08f, 0.1f, 0.18f, 0.92f));
            r._fishImg.preserveAspect = true;
            r._fish = r._fishImg.rectTransform;
            r._fish.anchorMin = r._fish.anchorMax = new Vector2(0.5f, 0.5f);
            r._fish.pivot = new Vector2(0.5f, 0.5f);
            r._fish.sizeDelta = new Vector2(100f, 100f);

            r._status = UIBuilder.Text(r._panel, "Status", "", 30, Color.white, TextAnchor.MiddleRight, FontStyle.Bold);
            r._status.horizontalOverflow = HorizontalWrapMode.Overflow;
            r._status.rectTransform.anchorMin = r._status.rectTransform.anchorMax = new Vector2(0f, 0f);
            r._status.rectTransform.pivot = new Vector2(1f, 0.5f);
            r._status.rectTransform.sizeDelta = new Vector2(300f, 50f);
            UIBuilder.AddOutline(r._status, UIColors.Ink, 3f);

            var bar = UIBuilder.Image(r._panel, "ProgressTrack", SpriteFactory.Get("ui.pill"), UIColors.PanelDark);
            UIBuilder.Place(bar.rectTransform, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(172f, 66f), new Vector2(50f, 580f));
            UIBuilder.AddOutline(bar, UIColors.Ink.WithAlpha(0.6f), 2f);
            r._progressImg = UIBuilder.Image(bar.rectTransform, "ProgressFill", SpriteFactory.Get("ui.pill"), UIColors.Yellow);
            r._progressFill = r._progressImg.rectTransform;
            r._progressFill.anchorMin = Vector2.zero;
            r._progressFill.anchorMax = new Vector2(1f, 0.3f);
            r._progressFill.offsetMin = new Vector2(6f, 6f);
            r._progressFill.offsetMax = new Vector2(-6f, -6f);

            r._hint = UIBuilder.Text(r._panel, "Hint", "꾹 누르면 초록 바 ↑", 22, UIColors.SubText, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(r._hint.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 16f), new Vector2(240f, 40f));
            r._hint.horizontalOverflow = HorizontalWrapMode.Overflow;

            r._group = UIBuilder.Group(frame.gameObject);
            r._group.alpha = 0f;
            r._group.blocksRaycasts = false;
            frame.gameObject.SetActive(false);
            return r;
        }

        public void Show(ReelModel model, CatchData c, Color waterColor)
        {
            _model = model;
            _catch = c;
            _visible = true;
            gameObject.SetActive(true);
            _fishImg.sprite = SpriteFactory.Icon(c);
            _trackImg.color = Color.Lerp(waterColor, Hex.C("#1C3A66"), 0.25f);
            bool big = c != null && c.IsBigEvent;
            _frame.color = big ? Hex.C("#FFF1C2") : UIColors.Panel;
            _title.text = c != null && c.rarity == CatchRarity.Legendary ? "1페이즈: 왕의 위엄" : (big ? "???" : "릴 감기!");
            _title.color = big ? UIColors.Gold : UIColors.Text;
            _status.text = "";
            Tweens.Fade(_group, 1f, 0.15f);
            Tweens.Scale(_panel, new Vector3(0.6f, 0.6f, 1f), Vector3.one, 0.3f, Ease.OutBack);
            Render(0f);
        }

        public void Hide()
        {
            if (!_visible) return;
            _visible = false;
            Tweens.Fade(_group, 0f, 0.2f, () => { if (!_visible && this != null) gameObject.SetActive(false); });
        }

        public void SetPhase(int phase)
        {
            if (_catch == null || _catch.rarity != CatchRarity.Legendary) return;
            _title.text = phase == 2 ? "2페이즈: 왕의 분노!" : "3페이즈: 왕관 던지기!!";
            _title.color = phase == 2 ? Hex.C("#F76707") : Hex.C("#E03131");
            Tweens.Punch(_title.transform, 0.35f, 0.4f);
            _shake = 1f;
        }

        public void Render(float dt)
        {
            if (_model == null) return;
            var m = _model;
            _zone.anchorMin = new Vector2(0f, m.BarPos);
            _zone.anchorMax = new Vector2(1f, Mathf.Min(1f, m.BarPos + m.BarSize));
            _zone.offsetMin = new Vector2(8f, 0f);
            _zone.offsetMax = new Vector2(-8f, 0f);
            _zoneImg.color = m.InZone ? ZoneOn : ZoneOff;

            float fy = m.Fish.Pos;
            _fish.anchorMin = _fish.anchorMax = new Vector2(0.5f, fy);
            _fish.anchoredPosition = Vector2.zero;
            float wiggle = m.InZone ? Mathf.Sin(Time.unscaledTime * 30f) * 10f : Mathf.Sin(Time.unscaledTime * 8f) * 5f;
            _fish.localRotation = Quaternion.Euler(0f, 0f, wiggle);
            if (m.Fish.Blinked) _blink = 0.25f;
            if (_blink > 0f)
            {
                _blink -= Time.unscaledDeltaTime;
                _fishImg.color = new Color(1f, 1f, 1f, 0.9f);
            }
            else
            {
                _fishImg.color = new Color(0.08f, 0.1f, 0.18f, 0.92f);
            }

            string st = m.Fish.Status;
            if (!string.IsNullOrEmpty(st) && _catch != null && _catch.movePattern == MovePattern.Teleport && _catch.id == "wifi_router") st = "연결 끊김!";
            _status.text = st ?? "";
            _status.rectTransform.anchoredPosition = new Vector2(20f, 66f + fy * 580f);

            float p = m.Progress;
            _progressFill.anchorMax = new Vector2(1f, Mathf.Max(0.05f, p));
            _progressImg.color = p < 0.5f ? Color.Lerp(UIColors.Coral, UIColors.Yellow, p * 2f) : Color.Lerp(UIColors.Yellow, UIColors.Green, (p - 0.5f) * 2f);

            if (!m.InZone && m.Elapsed > 0.7f) _shake = Mathf.Max(_shake, 0.35f);
            _shake = Mathf.MoveTowards(_shake, 0f, Time.unscaledDeltaTime * 2f);
            float sx = (Mathf.PerlinNoise(Time.unscaledTime * 25f, 1f) - 0.5f) * 14f * _shake;
            _panel.anchoredPosition = _basePos + new Vector2(sx, 0f);
        }
    }
}
