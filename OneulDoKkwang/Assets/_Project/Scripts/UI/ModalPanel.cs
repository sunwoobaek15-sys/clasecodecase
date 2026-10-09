using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>
    /// 모달 창 공통: 어두운 배경 + 가운데 창 + 닫기 버튼. 열려 있는 동안 게임이 일시정지된다(GameUI 가 관리).
    /// </summary>
    public abstract class ModalPanel : MonoBehaviour
    {
        protected GameObject Root;
        protected RectTransform Window;
        protected Text Title;
        protected CanvasGroup Group;
        bool _open;

        public bool IsOpen => _open;

        /// <summary>parent 아래에 이름이 name 인 전체화면 오브젝트를 만들고 T 컴포넌트를 붙인다.</summary>
        protected static T CreateOn<T>(RectTransform parent, string name) where T : ModalPanel
        {
            var rt = UIBuilder.Rect(parent, name);
            UIBuilder.Stretch(rt);
            return rt.gameObject.AddComponent<T>();
        }

        /// <summary>자기 자신(전체화면 RectTransform) 안에 어두운 배경 + 창 + 제목 + 닫기 버튼을 만든다.</summary>
        protected void BuildFrame(string title, Vector2 size)
        {
            var rootRt = (RectTransform)transform;
            Root = gameObject;
            Group = UIBuilder.Group(Root);
            var dim = UIBuilder.Image(rootRt, "Dim", null, UIColors.Dim, true);
            UIBuilder.Stretch(dim.rectTransform);
            var dimBtn = dim.gameObject.AddComponent<Button>();
            dimBtn.transition = Selectable.Transition.None;
            dimBtn.onClick.AddListener(Close);

            var win = UIBuilder.Panel(rootRt, "Window", UIColors.Panel, UIColors.Ink, true, true);
            Window = win.rectTransform;
            UIBuilder.Place(Window, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -20f), size);

            var header = UIBuilder.Image(Window, "Header", SpriteFactory.Get("ui.round"), UIColors.Teal);
            UIBuilder.Place(header.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f), new Vector2(0f, 0f), new Vector2(360f, 84f));
            UIBuilder.AddOutline(header, UIColors.Ink, 3f);
            Title = UIBuilder.Text(header.rectTransform, "Title", title, 42, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(Title.rectTransform, 4f);
            UIBuilder.AddOutline(Title, UIColors.Ink.WithAlpha(0.7f), 2.5f);

            var close = UIBuilder.Button(Window, "Close", "X", UIColors.Coral, Color.white, new Vector2(78f, 78f), Close, 40);
            UIBuilder.Place((RectTransform)close.transform, new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-14f, -14f), new Vector2(78f, 78f));
            Root.SetActive(false);
        }

        public virtual void Open()
        {
            if (_open) return;
            _open = true;
            Root.SetActive(true);
            Root.transform.SetAsLastSibling();
            if (Game.UI != null) Game.UI.ModalOpened(this);
            Group.alpha = 0f;
            Tweens.Fade(Group, 1f, 0.15f);
            Tweens.Scale(Window, new Vector3(0.7f, 0.7f, 1f), Vector3.one, 0.32f, Ease.OutBack);
            OnOpened();
        }

        public virtual void Close()
        {
            if (!_open) return;
            _open = false;
            if (Game.UI != null) Game.UI.ModalClosed(this);
            Tweens.Fade(Group, 0f, 0.12f, () => { if (!_open && this != null) Root.SetActive(false); });
            OnClosed();
        }

        protected virtual void OnOpened() { }
        protected virtual void OnClosed() { }

        protected virtual void Update()
        {
            if (_open && InputBridge.Down(InputBridge.KeyId.Cancel)) Close();
        }
    }
}
