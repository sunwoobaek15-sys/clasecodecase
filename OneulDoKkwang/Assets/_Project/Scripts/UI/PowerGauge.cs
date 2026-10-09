using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>던지기 파워 게이지 (주인공 옆에 세로로). 꼭대기 근처는 퍼펙트 구간.</summary>
    public sealed class PowerGauge : MonoBehaviour
    {
        RectTransform _rt;
        RectTransform _canvasRt;
        RectTransform _fill;
        Image _fillImg;
        Text _label;
        CanvasGroup _group;
        bool _visible;
        float _perfectThreshold = 0.92f;

        public static PowerGauge Create(RectTransform parent, RectTransform canvasRt)
        {
            var frame = UIBuilder.Panel(parent, "PowerGauge", UIColors.Panel, UIColors.Ink, true, false);
            var g = frame.gameObject.AddComponent<PowerGauge>();
            g._rt = frame.rectTransform;
            g._canvasRt = canvasRt;
            g._rt.anchorMin = g._rt.anchorMax = new Vector2(0.5f, 0.5f);
            g._rt.pivot = new Vector2(0.5f, 0f);
            g._rt.sizeDelta = new Vector2(78f, 330f);

            var track = UIBuilder.Image(g._rt, "Track", SpriteFactory.Get("ui.pill"), UIColors.PanelDark);
            UIBuilder.Place(track.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 16f), new Vector2(40f, 270f));
            var band = UIBuilder.Image(track.rectTransform, "PerfectZone", SpriteFactory.Get("ui.pill"), UIColors.Yellow.WithAlpha(0.65f));
            band.rectTransform.anchorMin = new Vector2(0f, g._perfectThreshold);
            band.rectTransform.anchorMax = new Vector2(1f, 1f);
            band.rectTransform.offsetMin = band.rectTransform.offsetMax = Vector2.zero;
            g._fillImg = UIBuilder.Image(track.rectTransform, "Fill", SpriteFactory.Get("ui.pill"), UIColors.Green);
            g._fill = g._fillImg.rectTransform;
            g._fill.anchorMin = Vector2.zero;
            g._fill.anchorMax = new Vector2(1f, 0f);
            g._fill.offsetMin = new Vector2(5f, 5f);
            g._fill.offsetMax = new Vector2(-5f, 0f);

            g._label = UIBuilder.Text(g._rt, "Label", "파워", 26, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(g._label.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 0f), new Vector2(0f, 6f), new Vector2(220f, 40f));
            g._label.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(g._label, Color.white, 2f);
            g._group = UIBuilder.Group(frame.gameObject);
            g._group.alpha = 0f;
            g._group.blocksRaycasts = false;
            frame.gameObject.SetActive(false);
            return g;
        }

        public void SetPerfectThreshold(float t)
        {
            _perfectThreshold = t;
        }

        public void Show()
        {
            _visible = true;
            gameObject.SetActive(true);
            Tweens.Fade(_group, 1f, 0.1f);
            Tweens.Scale(_rt, new Vector3(0.7f, 0.7f, 1f), Vector3.one, 0.2f, Ease.OutBack);
            Set(0f);
            Follow();
        }

        public void Hide()
        {
            if (!_visible) return;
            _visible = false;
            Tweens.Fade(_group, 0f, 0.15f, () => { if (!_visible && this != null) gameObject.SetActive(false); });
        }

        public void Set(float power)
        {
            power = Mathf.Clamp01(power);
            _fill.anchorMax = new Vector2(1f, Mathf.Max(0.04f, power));
            bool perfect = power >= _perfectThreshold;
            Color c = power < 0.5f ? Color.Lerp(UIColors.Green, UIColors.Yellow, power * 2f) : Color.Lerp(UIColors.Yellow, UIColors.Coral, (power - 0.5f) * 2f);
            if (perfect) c = Color.Lerp(UIColors.Gold, Color.white, 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * 30f));
            _fillImg.color = c;
            _label.text = perfect ? "퍼펙트!" : "파워 " + Mathf.RoundToInt(power * 100f) + "%";
            _label.color = perfect ? UIColors.Gold : UIColors.Text;
        }

        void Follow()
        {
            if (Game.Player == null || Game.Cam == null || Game.Cam.Cam == null) return;
            // 낚싯대는 뒤(왼쪽)로 젖혀지므로 게이지는 주인공 오른쪽(양동이 위)에 띄운다
            var world = Game.Player.transform.position + new Vector3(1.1f, 0.55f, 0f);
            Vector2 screen = RectTransformUtility.WorldToScreenPoint(Game.Cam.Cam, world);
            Vector2 local;
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(_canvasRt, screen, null, out local))
            {
                var half = _canvasRt.rect.size * 0.5f;
                local.x = Mathf.Clamp(local.x, -half.x + 60f, half.x - 60f);
                _rt.anchoredPosition = local;
            }
        }

        void LateUpdate()
        {
            if (_visible) Follow();
        }
    }
}
