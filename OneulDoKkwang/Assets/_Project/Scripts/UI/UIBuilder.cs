using System;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>UI 색상 팔레트.</summary>
    public static class UIColors
    {
        public static readonly Color Ink = Hex.C("#3B2C35");
        public static readonly Color Text = Hex.C("#4A3B42");
        public static readonly Color SubText = Hex.C("#8A7A80");
        public static readonly Color Panel = Hex.C("#FFF8EC");
        public static readonly Color PanelDark = Hex.C("#F3E6CF");
        public static readonly Color Coral = Hex.C("#FF7B6B");
        public static readonly Color CoralDark = Hex.C("#E85D4A");
        public static readonly Color Teal = Hex.C("#2EC4B6");
        public static readonly Color TealDark = Hex.C("#1E9C90");
        public static readonly Color Yellow = Hex.C("#FFD166");
        public static readonly Color Gold = Hex.C("#F59F00");
        public static readonly Color Purple = Hex.C("#9775FA");
        public static readonly Color Green = Hex.C("#51CF66");
        public static readonly Color Disabled = Hex.C("#CFC6BB");
        public static readonly Color Dim = new Color(0.08f, 0.05f, 0.12f, 0.62f);

        public static Color Rarity(CatchRarity r)
        {
            switch (r)
            {
                case CatchRarity.Common: return Hex.C("#8CA0B3");
                case CatchRarity.Rare: return Hex.C("#4DABF7");
                case CatchRarity.Legendary: return Hex.C("#FFB703");
                default: return Hex.C("#E64980");
            }
        }
    }

    /// <summary>uGUI 를 코드로 조립하는 헬퍼 (레거시 Text + OS 한글 폰트).</summary>
    public static class UIBuilder
    {
        public static RectTransform Rect(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static RectTransform Stretch(RectTransform rt, float inset = 0f)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(inset, inset);
            rt.offsetMax = new Vector2(-inset, -inset);
            return rt;
        }

        /// <summary>앵커 한 점 기준 배치.</summary>
        public static RectTransform Place(RectTransform rt, Vector2 anchor, Vector2 pivot, Vector2 pos, Vector2 size)
        {
            rt.anchorMin = anchor;
            rt.anchorMax = anchor;
            rt.pivot = pivot;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        public static Image Image(Transform parent, string name, Sprite sprite, Color color, bool raycast = false)
        {
            var rt = Rect(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            img.raycastTarget = raycast;
            if (sprite != null && sprite.border.sqrMagnitude > 0f) img.type = UnityEngine.UI.Image.Type.Sliced;
            return img;
        }

        public static Image Icon(Transform parent, string name, Sprite sprite, Vector2 size)
        {
            var img = Image(parent, name, sprite, Color.white);
            img.preserveAspect = true;
            img.rectTransform.sizeDelta = size;
            return img;
        }

        public static Text Text(Transform parent, string name, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleCenter, FontStyle style = FontStyle.Normal)
        {
            var rt = Rect(parent, name);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = UIFonts.Main;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.fontStyle = style;
            t.supportRichText = true;
            t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.lineSpacing = 1.05f;
            return t;
        }

        public static Outline AddOutline(Graphic g, Color c, float dist)
        {
            var o = g.gameObject.AddComponent<Outline>();
            o.effectColor = c;
            o.effectDistance = new Vector2(dist, -dist);
            return o;
        }

        public static Shadow AddShadow(Graphic g, Color c, Vector2 dist)
        {
            var s = g.gameObject.AddComponent<Shadow>();
            s.effectColor = c;
            s.effectDistance = dist;
            return s;
        }

        /// <summary>둥근 패널 (+ 테두리 + 그림자).</summary>
        public static Image Panel(Transform parent, string name, Color fill, Color border, bool shadow = true, bool raycast = true)
        {
            var rt = Rect(parent, name);
            var bg = rt.gameObject.AddComponent<Image>();
            bg.sprite = SpriteFactory.Get("ui.round");
            bg.type = UnityEngine.UI.Image.Type.Sliced;
            bg.color = fill;
            bg.raycastTarget = raycast;
            // uGUI 는 자식이 부모 위에 그려지므로, 그림자는 자식 이미지가 아니라 Shadow 효과로 (부모 메시 뒤에 그려짐)
            if (shadow) AddShadow(bg, new Color(0f, 0f, 0f, 0.22f), new Vector2(0f, -7f));
            if (border.a > 0f)
            {
                var bd = Image(rt, "Border", SpriteFactory.Get("ui.outline"), border);
                Stretch(bd.rectTransform);
            }
            return bg;
        }

        public static Button Button(Transform parent, string name, string label, Color fill, Color textColor, Vector2 size, Action onClick, int fontSize = 32)
        {
            var img = Panel(parent, name, fill, UIColors.Ink.WithAlpha(0.85f), true, true);
            img.rectTransform.sizeDelta = size;
            var btn = img.gameObject.AddComponent<Button>();
            btn.targetGraphic = img;
            var colors = btn.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1f, 1f, 1f, 1f);
            colors.pressedColor = new Color(0.85f, 0.85f, 0.85f, 1f);
            colors.disabledColor = new Color(0.75f, 0.75f, 0.75f, 0.8f);
            colors.colorMultiplier = 1f;
            colors.fadeDuration = 0.08f;
            btn.colors = colors;
            if (!string.IsNullOrEmpty(label))
            {
                var t = Text(img.transform, "Label", label, fontSize, textColor, TextAnchor.MiddleCenter, FontStyle.Bold);
                Stretch(t.rectTransform, 6f);
                t.resizeTextForBestFit = true;
                t.resizeTextMinSize = 16;
                t.resizeTextMaxSize = fontSize;
                t.horizontalOverflow = HorizontalWrapMode.Wrap;
                t.verticalOverflow = VerticalWrapMode.Truncate;
            }
            if (onClick != null)
            {
                btn.onClick.AddListener(new UnityAction(() =>
                {
                    Tweens.Punch(img.transform, 0.08f, 0.18f);
                    onClick();
                }));
            }
            return btn;
        }

        public static Text ButtonLabel(Button b)
        {
            var t = b.transform.Find("Label");
            return t != null ? t.GetComponent<Text>() : null;
        }

        /// <summary>세로 스크롤 리스트. content 에 자식을 넣으면 된다 (레이아웃 그룹은 호출자가 붙임).</summary>
        public static ScrollRect ScrollView(Transform parent, string name, out RectTransform content)
        {
            var root = Rect(parent, name);
            var sr = root.gameObject.AddComponent<ScrollRect>();
            var bg = root.gameObject.AddComponent<Image>();
            bg.color = new Color(0f, 0f, 0f, 0.0001f);
            bg.raycastTarget = true;
            var viewport = Rect(root, "Viewport");
            Stretch(viewport);
            viewport.gameObject.AddComponent<RectMask2D>();
            var vpImg = viewport.gameObject.AddComponent<Image>();
            vpImg.color = new Color(0f, 0f, 0f, 0.0001f);
            vpImg.raycastTarget = true;
            content = Rect(viewport, "Content");
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0.5f, 1f);
            content.anchoredPosition = Vector2.zero;
            content.sizeDelta = new Vector2(0f, 0f);
            sr.viewport = viewport;
            sr.content = content;
            sr.horizontal = false;
            sr.vertical = true;
            sr.movementType = ScrollRect.MovementType.Elastic;
            sr.scrollSensitivity = 40f;
            sr.inertia = true;
            return sr;
        }

        public static Slider Slider(Transform parent, string name, float value, Action<float> onChange)
        {
            var root = Rect(parent, name);
            root.sizeDelta = new Vector2(420f, 44f);
            var bg = Image(root, "Background", SpriteFactory.Get("ui.pill"), UIColors.PanelDark);
            Stretch(bg.rectTransform);
            bg.rectTransform.offsetMin = new Vector2(0f, 12f);
            bg.rectTransform.offsetMax = new Vector2(0f, -12f);
            var fillArea = Rect(root, "Fill Area");
            Stretch(fillArea);
            fillArea.offsetMin = new Vector2(10f, 12f);
            fillArea.offsetMax = new Vector2(-10f, -12f);
            var fill = Image(fillArea, "Fill", SpriteFactory.Get("ui.pill"), UIColors.Teal);
            fill.rectTransform.anchorMin = Vector2.zero;
            fill.rectTransform.anchorMax = new Vector2(0f, 1f);
            fill.rectTransform.sizeDelta = new Vector2(10f, 0f);
            var handleArea = Rect(root, "Handle Slide Area");
            Stretch(handleArea);
            handleArea.offsetMin = new Vector2(16f, 0f);
            handleArea.offsetMax = new Vector2(-16f, 0f);
            var handle = Image(handleArea, "Handle", SpriteFactory.Get("ui.circle"), Color.white, true);
            handle.rectTransform.sizeDelta = new Vector2(40f, 40f);
            AddOutline(handle, UIColors.Ink, 2f);
            var s = root.gameObject.AddComponent<Slider>();
            s.fillRect = fill.rectTransform;
            s.handleRect = handle.rectTransform;
            s.targetGraphic = handle;
            s.direction = UnityEngine.UI.Slider.Direction.LeftToRight;
            s.minValue = 0f;
            s.maxValue = 1f;
            s.value = value;
            if (onChange != null) s.onValueChanged.AddListener(new UnityAction<float>(v => onChange(v)));
            return s;
        }

        public static CanvasGroup Group(GameObject go)
        {
            var g = go.GetComponent<CanvasGroup>();
            if (g == null) g = go.AddComponent<CanvasGroup>();
            return g;
        }

        public static string Money(long v)
        {
            return v.ToString("N0") + "원";
        }
    }
}
