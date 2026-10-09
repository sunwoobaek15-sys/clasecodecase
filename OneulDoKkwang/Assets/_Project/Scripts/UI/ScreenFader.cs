using System;
using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>화면 페이드(검정)와 플래시(흰색), 전설 연출용 비네트.</summary>
    public sealed class ScreenFader : MonoBehaviour
    {
        Image _black;
        Image _flash;
        Image _vignette;
        float _vignetteTarget;

        public static ScreenFader Create(RectTransform parent)
        {
            var root = UIBuilder.Rect(parent, "ScreenFx");
            UIBuilder.Stretch(root);
            var f = root.gameObject.AddComponent<ScreenFader>();
            f._vignette = UIBuilder.Image(root, "Vignette", SpriteFactory.Get("ui.vignette"), new Color(0.25f, 0.05f, 0.1f, 0f));
            UIBuilder.Stretch(f._vignette.rectTransform, -40f);
            f._flash = UIBuilder.Image(root, "Flash", null, new Color(1f, 1f, 1f, 0f));
            UIBuilder.Stretch(f._flash.rectTransform);
            f._black = UIBuilder.Image(root, "Black", null, new Color(0f, 0f, 0f, 0f));
            UIBuilder.Stretch(f._black.rectTransform);
            return f;
        }

        public bool IsBlack => _black.color.a > 0.98f;

        public void SetBlack(float a)
        {
            _black.color = new Color(0f, 0f, 0f, a);
            _black.raycastTarget = a > 0.01f;
        }

        public void FadeTo(float alpha, float seconds, Action done = null)
        {
            var r = TweenRunner.Instance;
            float from = _black.color.a;
            _black.raycastTarget = true;
            if (r == null) { SetBlack(alpha); if (done != null) done(); return; }
            r.Kill(_black);
            r.To(_black, seconds, p => SetBlack(Mathf.Lerp(from, alpha, p)), Ease.InOutQuad, () =>
            {
                SetBlack(alpha);
                if (done != null) done();
            });
        }

        public void Flash(float strength = 0.8f, float seconds = 0.45f, Color? color = null)
        {
            var c = color ?? Color.white;
            var r = TweenRunner.Instance;
            if (r == null) return;
            r.Kill(_flash);
            r.To(_flash, seconds, p => _flash.color = new Color(c.r, c.g, c.b, strength * (1f - p)), Ease.OutQuad);
        }

        /// <summary>0~1. 전설 대결 중 화면 가장자리를 어둡게.</summary>
        public void Vignette(float amount)
        {
            _vignetteTarget = amount;
        }

        void Update()
        {
            var c = _vignette.color;
            c.a = Mathf.MoveTowards(c.a, _vignetteTarget * 0.85f, Time.unscaledDeltaTime * 1.5f);
            _vignette.color = c;
        }
    }
}
