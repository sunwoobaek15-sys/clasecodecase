using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>캐릭터 머리 위 말풍선 (타자기 효과, 자동 사라짐). 월드 앵커를 따라다닌다.</summary>
    public sealed class DialogueBubble : MonoBehaviour
    {
        const float MaxWidth = 560f;
        const float PadX = 26f;
        const float PadY = 18f;

        RectTransform _rt;
        RectTransform _canvasRt;
        RectTransform _tail;
        Text _text;
        CanvasGroup _group;
        Transform _anchor;
        string _full = "";
        float _shown;
        float _hideAt;
        bool _visible;
        float _charsPerSec = 30f;

        public bool Visible => _visible;

        public static DialogueBubble Create(RectTransform parent, RectTransform canvasRt, Transform anchor, Color fill, Color textColor, string name)
        {
            var bg = UIBuilder.Panel(parent, name, fill, UIColors.Ink, false, false);
            var b = bg.gameObject.AddComponent<DialogueBubble>();
            b._rt = bg.rectTransform;
            b._rt.anchorMin = b._rt.anchorMax = new Vector2(0.5f, 0.5f);
            b._rt.pivot = new Vector2(0.18f, 0f);
            b._canvasRt = canvasRt;
            b._anchor = anchor;
            var tail = UIBuilder.Image(b._rt, "Tail", SpriteFactory.Get("ui.tail"), fill);
            tail.rectTransform.anchorMin = tail.rectTransform.anchorMax = new Vector2(0.18f, 0f);
            tail.rectTransform.pivot = new Vector2(0.2f, 1f);
            tail.rectTransform.sizeDelta = new Vector2(34f, 26f);
            tail.rectTransform.anchoredPosition = new Vector2(0f, 3f);
            b._tail = tail.rectTransform;
            var tailOutline = UIBuilder.AddOutline(tail, UIColors.Ink, 2f);
            tailOutline.useGraphicAlpha = true;
            b._text = UIBuilder.Text(b._rt, "Text", "", 28, textColor, TextAnchor.UpperLeft);
            b._text.rectTransform.anchorMin = new Vector2(0f, 0f);
            b._text.rectTransform.anchorMax = new Vector2(1f, 1f);
            b._text.rectTransform.offsetMin = new Vector2(PadX, PadY - 4f);
            b._text.rectTransform.offsetMax = new Vector2(-PadX, -PadY + 4f);
            b._text.supportRichText = false;
            b._group = UIBuilder.Group(bg.gameObject);
            b._group.alpha = 0f;
            b._group.blocksRaycasts = false;
            b._group.interactable = false;
            bg.gameObject.SetActive(false);
            return b;
        }

        public void SetAnchor(Transform anchor)
        {
            _anchor = anchor;
        }

        public void Show(string text, float seconds = 2.8f)
        {
            if (string.IsNullOrEmpty(text)) return;
            gameObject.SetActive(true);
            transform.SetAsLastSibling();
            _full = text;
            _shown = 0f;
            _visible = true;
            _hideAt = Time.unscaledTime + seconds + text.Length / _charsPerSec;

            // 크기: 한 줄 폭 → 최대폭으로 줄바꿈 → 높이
            _text.text = text;
            float pref = _text.preferredWidth;
            float width = Mathf.Min(pref, MaxWidth - PadX * 2f) + PadX * 2f;
            _rt.sizeDelta = new Vector2(Mathf.Max(120f, width), 80f);
            float h = _text.preferredHeight;
            _rt.sizeDelta = new Vector2(_rt.sizeDelta.x, Mathf.Max(64f, h + PadY * 2f));
            _text.text = "";

            Tweens.Fade(_group, 1f, 0.12f);
            Tweens.Scale(transform, new Vector3(0.6f, 0.6f, 1f), Vector3.one, 0.28f, Ease.OutBack);
            Position();
        }

        public void Hide()
        {
            if (!_visible) return;
            _visible = false;
            Tweens.Fade(_group, 0f, 0.2f, () => { if (!_visible && this != null) gameObject.SetActive(false); });
        }

        void Position()
        {
            if (_anchor == null || Game.Cam == null || Game.Cam.Cam == null) return;
            Vector2 screen = RectTransformUtility.WorldToScreenPoint(Game.Cam.Cam, _anchor.position);
            Vector2 local;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(_canvasRt, screen, null, out local)) return;
            var size = _rt.sizeDelta;
            var half = _canvasRt.rect.size * 0.5f;
            float minX = -half.x + 16f + size.x * _rt.pivot.x;
            float maxX = half.x - 16f - size.x * (1f - _rt.pivot.x);
            float x = Mathf.Clamp(local.x, minX, Mathf.Max(minX, maxX));
            float y = Mathf.Clamp(local.y + 14f, -half.y + 20f, half.y - 140f - size.y);
            _rt.anchoredPosition = new Vector2(x, y);
            // 꼬리는 실제 앵커 쪽을 가리키게
            float tailX = Mathf.Clamp(local.x - (x - size.x * _rt.pivot.x), 24f, size.x - 40f);
            _tail.anchorMin = _tail.anchorMax = new Vector2(tailX / Mathf.Max(1f, size.x), 0f);
        }

        void LateUpdate()
        {
            if (!_visible) return;
            if (_shown < _full.Length)
            {
                _shown += Time.unscaledDeltaTime * _charsPerSec;
                int n = Mathf.Min(_full.Length, Mathf.FloorToInt(_shown));
                _text.text = _full.Substring(0, n);
            }
            Position();
            if (Time.unscaledTime >= _hideAt) Hide();
        }
    }
}
