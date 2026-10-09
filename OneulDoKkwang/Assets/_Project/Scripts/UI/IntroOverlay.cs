using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>인트로/장소 도착용 자막과 타이틀 카드 ("오늘도 꽝").</summary>
    public sealed class IntroOverlay : MonoBehaviour
    {
        RectTransform _title;
        CanvasGroup _titleGroup;
        Text _titleText;
        Text _subtitle;
        Text _caption;
        CanvasGroup _captionGroup;
        Text _tapHint;
        CanvasGroup _tapGroup;
        Image _letterTop;
        Image _letterBottom;

        public static IntroOverlay Create(RectTransform parent)
        {
            var root = UIBuilder.Rect(parent, "IntroOverlay");
            UIBuilder.Stretch(root);
            var o = root.gameObject.AddComponent<IntroOverlay>();

            o._letterTop = UIBuilder.Image(root, "LetterboxTop", null, new Color(0f, 0f, 0f, 0.85f));
            UIBuilder.Place(o._letterTop.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 0f), new Vector2(4000f, 0f));
            o._letterBottom = UIBuilder.Image(root, "LetterboxBottom", null, new Color(0f, 0f, 0f, 0.85f));
            UIBuilder.Place(o._letterBottom.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 0f), new Vector2(4000f, 0f));

            o._title = UIBuilder.Rect(root, "Title");
            UIBuilder.Place(o._title, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 140f), new Vector2(1400f, 300f));
            o._titleGroup = UIBuilder.Group(o._title.gameObject);
            o._titleGroup.alpha = 0f;
            o._titleGroup.blocksRaycasts = false;
            o._titleText = UIBuilder.Text(o._title, "TitleText", "오늘도 꽝", 150, UIColors.Yellow, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(o._titleText.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 30f), new Vector2(1400f, 200f));
            o._titleText.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(o._titleText, UIColors.Ink, 7f);
            UIBuilder.AddShadow(o._titleText, new Color(0f, 0f, 0f, 0.4f), new Vector2(0f, -12f));
            o._subtitle = UIBuilder.Text(o._title, "Subtitle", "~ 하와이 휴가 편 ~", 46, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(o._subtitle.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0.5f), new Vector2(0f, 20f), new Vector2(1200f, 70f));
            o._subtitle.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(o._subtitle, UIColors.Ink, 4f);

            o._caption = UIBuilder.Text(root, "Caption", "", 46, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(o._caption.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -190f), new Vector2(1600f, 80f));
            o._caption.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(o._caption, UIColors.Ink, 4f);
            o._captionGroup = UIBuilder.Group(o._caption.gameObject);
            o._captionGroup.alpha = 0f;

            o._tapHint = UIBuilder.Text(root, "TapHint", "화면을 탭하면 넘어가요", 28, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(o._tapHint.rectTransform, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-40f, 30f), new Vector2(500f, 50f));
            o._tapHint.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(o._tapHint, UIColors.Ink, 2.5f);
            o._tapGroup = UIBuilder.Group(o._tapHint.gameObject);
            o._tapGroup.alpha = 0f;
            return o;
        }

        public void Letterbox(bool on, float seconds = 0.5f)
        {
            float target = on ? 110f : 0f;
            var top = _letterTop.rectTransform;
            var bottom = _letterBottom.rectTransform;
            float from = top.sizeDelta.y;
            if (TweenRunner.Instance == null) { top.sizeDelta = bottom.sizeDelta = new Vector2(4000f, target); return; }
            TweenRunner.Instance.To(top, seconds, p =>
            {
                float h = Mathf.Lerp(from, target, p);
                top.sizeDelta = new Vector2(4000f, h);
                bottom.sizeDelta = new Vector2(4000f, h);
            }, Ease.InOutQuad);
            Tweens.Fade(_tapGroup, on ? 0.85f : 0f, 0.3f);
        }

        public void Caption(string text, float hold = 2.2f)
        {
            _caption.text = text;
            Tweens.Fade(_captionGroup, 1f, 0.3f);
            Tweens.Scale(_caption.transform, new Vector3(0.9f, 0.9f, 1f), Vector3.one, 0.4f, Ease.OutCubic);
            Tweens.Wait(_caption, hold, () => Tweens.Fade(_captionGroup, 0f, 0.4f));
        }

        public void HideCaption()
        {
            Tweens.Fade(_captionGroup, 0f, 0.2f);
        }

        public void ShowTitle(float hold = 2.4f)
        {
            Tweens.Fade(_titleGroup, 1f, 0.15f);
            Tweens.Scale(_title, new Vector3(0.2f, 0.2f, 1f), Vector3.one, 0.8f, Ease.OutElastic);
            Tweens.Wait(_title, hold, () => Tweens.Fade(_titleGroup, 0f, 0.5f));
        }

        public void HideAll()
        {
            Tweens.Fade(_titleGroup, 0f, 0.2f);
            Tweens.Fade(_captionGroup, 0f, 0.2f);
            Letterbox(false, 0.3f);
        }
    }
}
