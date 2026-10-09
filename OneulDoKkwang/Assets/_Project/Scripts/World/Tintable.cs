using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 시간대/날씨 색조를 받는 스프라이트. EnvironmentController 가 전역 색을 정하면 매 프레임 반영한다.
    /// (URP 2D 라이트 없이도 낮/노을/밤 분위기를 내기 위한 방식)
    /// </summary>
    [DefaultExecutionOrder(120)]
    public sealed class Tintable : MonoBehaviour
    {
        public enum Mode
        {
            Near = 0,
            Far = 1,
            Cloud = 2,
            Underwater = 3,
        }

        public static Color NearTint = Color.white;
        public static Color FarTint = Color.white;
        public static Color CloudTint = Color.white;
        public static Color UnderwaterTint = Color.white;

        public Color baseColor = Color.white;
        public Mode mode = Mode.Near;
        /// <summary>추가 알파 배율 (페이드 연출용).</summary>
        public float alpha = 1f;

        SpriteRenderer _sr;

        public static Tintable Attach(SpriteRenderer sr, Mode mode, Color? baseColor = null)
        {
            var t = sr.gameObject.GetComponent<Tintable>();
            if (t == null) t = sr.gameObject.AddComponent<Tintable>();
            t._sr = sr;
            t.mode = mode;
            t.baseColor = baseColor ?? sr.color;
            t.Apply();
            return t;
        }

        void Awake()
        {
            if (_sr == null) _sr = GetComponent<SpriteRenderer>();
        }

        void LateUpdate()
        {
            Apply();
        }

        public void Apply()
        {
            if (_sr == null) return;
            Color t;
            switch (mode)
            {
                case Mode.Far: t = FarTint; break;
                case Mode.Cloud: t = CloudTint; break;
                case Mode.Underwater: t = UnderwaterTint; break;
                default: t = NearTint; break;
            }
            var c = baseColor * t;
            c.a = baseColor.a * alpha;
            _sr.color = c;
        }
    }
}
