using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    public enum BannerStyle
    {
        Normal,
        Good,
        Fail,
        Legend,
        Caption,
    }

    /// <summary>화면 중앙 배너("퍼펙트!", "전설 출현!"), 상단 토스트, 떠오르는 숫자(+120원) 등 알림.</summary>
    public sealed class Announcer : MonoBehaviour
    {
        RectTransform _root;
        RectTransform _canvasRt;
        Text _banner;
        Outline _bannerOutline;
        CanvasGroup _bannerGroup;
        Text _sub;
        RectTransform _toast;
        Text _toastText;
        CanvasGroup _toastGroup;
        readonly Queue<string> _toasts = new Queue<string>();
        float _toastUntil;
        bool _toastShowing;
        float _bannerUntil;

        public static Announcer Create(RectTransform parent, RectTransform canvasRt)
        {
            var root = UIBuilder.Rect(parent, "Announcer");
            UIBuilder.Stretch(root);
            var a = root.gameObject.AddComponent<Announcer>();
            a._root = root;
            a._canvasRt = canvasRt;

            a._banner = UIBuilder.Text(root, "Banner", "", 78, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(a._banner.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 250f), new Vector2(1600f, 140f));
            a._banner.horizontalOverflow = HorizontalWrapMode.Overflow;
            a._bannerOutline = UIBuilder.AddOutline(a._banner, UIColors.Ink, 4f);
            UIBuilder.AddShadow(a._banner, new Color(0f, 0f, 0f, 0.35f), new Vector2(0f, -7f));
            a._sub = UIBuilder.Text(a._banner.rectTransform, "Sub", "", 36, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(a._sub.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 1f), new Vector2(0f, 0f), new Vector2(1500f, 60f));
            UIBuilder.AddOutline(a._sub, UIColors.Ink, 3f);
            a._bannerGroup = UIBuilder.Group(a._banner.gameObject);
            a._bannerGroup.alpha = 0f;
            a._bannerGroup.blocksRaycasts = false;

            var toastBg = UIBuilder.Panel(root, "Toast", UIColors.Ink.WithAlpha(0.88f), new Color(0, 0, 0, 0), false, false);
            a._toast = toastBg.rectTransform;
            toastBg.sprite = SpriteFactory.Get("ui.pill");
            UIBuilder.Place(a._toast, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -150f), new Vector2(640f, 62f));
            a._toastText = UIBuilder.Text(a._toast, "Text", "", 28, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(a._toastText.rectTransform, 8f);
            a._toastText.horizontalOverflow = HorizontalWrapMode.Overflow;
            a._toastGroup = UIBuilder.Group(toastBg.gameObject);
            a._toastGroup.alpha = 0f;
            a._toastGroup.blocksRaycasts = false;
            return a;
        }

        public void Banner(string text, BannerStyle style = BannerStyle.Normal, float seconds = 1.6f, string sub = null)
        {
            Color c, o;
            switch (style)
            {
                case BannerStyle.Good: c = UIColors.Yellow; o = UIColors.Ink; break;
                case BannerStyle.Fail: c = Hex.C("#DDE7FF"); o = Hex.C("#2B3A67"); break;
                case BannerStyle.Legend: c = Hex.C("#FFE066"); o = Hex.C("#7A1F00"); break;
                case BannerStyle.Caption: c = Color.white; o = UIColors.Ink; break;
                default: c = Color.white; o = UIColors.Ink; break;
            }
            _banner.text = text;
            _banner.color = c;
            _banner.fontSize = style == BannerStyle.Caption ? 52 : (style == BannerStyle.Fail ? 52 : 78);
            _bannerOutline.effectColor = o;
            _sub.text = sub ?? "";
            _banner.rectTransform.anchoredPosition = new Vector2(0f, style == BannerStyle.Caption ? 330f : 250f);
            _bannerUntil = Time.unscaledTime + seconds;
            Tweens.Fade(_bannerGroup, 1f, 0.12f);
            Tweens.Scale(_banner.transform, new Vector3(0.4f, 0.4f, 1f), Vector3.one, 0.38f, style == BannerStyle.Fail ? Ease.OutCubic : Ease.OutElastic);
        }

        public void Toast(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            if (_toasts.Count > 3) _toasts.Dequeue();
            _toasts.Enqueue(text);
        }

        /// <summary>월드 위치에서 떠오르는 텍스트 (+120원 등).</summary>
        public void FloatText(Vector3 world, string text, Color color, int size = 40)
        {
            if (Game.Cam == null || Game.Cam.Cam == null) return;
            Vector2 screen = RectTransformUtility.WorldToScreenPoint(Game.Cam.Cam, world);
            Vector2 local;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(_canvasRt, screen, null, out local)) return;
            var t = UIBuilder.Text(_root, "Float", text, size, color, TextAnchor.MiddleCenter, FontStyle.Bold);
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(t, UIColors.Ink, 3f);
            var rt = t.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(400f, 60f);
            rt.anchoredPosition = local;
            var g = UIBuilder.Group(t.gameObject);
            Tweens.Scale(rt, new Vector3(0.5f, 0.5f, 1f), Vector3.one, 0.3f, Ease.OutBack);
            var start = local;
            if (TweenRunner.Instance != null)
            {
                TweenRunner.Instance.To(rt, 1.3f, p =>
                {
                    if (rt == null) return;
                    rt.anchoredPosition = start + new Vector2(0f, 110f * p);
                    g.alpha = p < 0.6f ? 1f : 1f - (p - 0.6f) / 0.4f;
                }, Ease.OutQuad, () => { if (rt != null) Destroy(rt.gameObject); });
            }
            else
            {
                Destroy(rt.gameObject, 1.3f);
            }
        }

        void Update()
        {
            if (_bannerGroup.alpha > 0f && Time.unscaledTime > _bannerUntil && TweenRunner.Instance != null && !TweenRunner.Instance.IsRunning(_bannerGroup))
                Tweens.Fade(_bannerGroup, 0f, 0.3f);

            if (_toastShowing && Time.unscaledTime > _toastUntil)
            {
                _toastShowing = false;
                Tweens.Fade(_toastGroup, 0f, 0.25f);
            }
            if (!_toastShowing && _toasts.Count > 0 && (_toastGroup.alpha <= 0.01f))
            {
                var msg = _toasts.Dequeue();
                _toastText.text = msg;
                float w = Mathf.Clamp(_toastText.preferredWidth + 70f, 280f, 1200f);
                _toast.sizeDelta = new Vector2(w, 62f);
                _toastShowing = true;
                _toastUntil = Time.unscaledTime + 1.9f;
                Tweens.Fade(_toastGroup, 1f, 0.15f);
                Tweens.Scale(_toast, new Vector3(0.8f, 0.8f, 1f), Vector3.one, 0.25f, Ease.OutBack);
            }
        }
    }
}
