using System;
using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>
    /// 결과 카드: 이름 + 등급 + 크기(cm) + 판매가 + 병맛 설명 한 줄 (+ NEW / 최고기록 뱃지).
    /// 팝업 트윈(OutBack) + 아이콘 흔들기 + 희귀 이상은 회전하는 햇살.
    /// </summary>
    public sealed class ResultCard : MonoBehaviour
    {
        GameObject _root;
        CanvasGroup _group;
        RectTransform _card;
        Image _cardImg;
        Image _burst;
        Image _icon;
        Image _rarityPill;
        Text _rarity;
        Text _name;
        Text _stats;
        Text _desc;
        Text _flavor;
        RectTransform _newBadge;
        RectTransform _recordBadge;
        Button _ok;
        Text _okLabel;

        Action _onClose;
        float _openedAt;
        bool _open;
        CatchResult _result;

        public bool IsOpen => _open;

        public static ResultCard Create(RectTransform parent)
        {
            var rootRt = UIBuilder.Rect(parent, "ResultCard (결과 카드)");
            UIBuilder.Stretch(rootRt);
            var rc = rootRt.gameObject.AddComponent<ResultCard>();
            rc._root = rootRt.gameObject;
            rc._group = UIBuilder.Group(rc._root);

            var dim = UIBuilder.Image(rootRt, "Dim", null, UIColors.Dim, true);
            UIBuilder.Stretch(dim.rectTransform);
            var dimBtn = dim.gameObject.AddComponent<Button>();
            dimBtn.transition = Selectable.Transition.None;
            dimBtn.onClick.AddListener(rc.TryClose);

            rc._cardImg = UIBuilder.Panel(rootRt, "Card", UIColors.Panel, UIColors.Ink, true, true);
            rc._card = rc._cardImg.rectTransform;
            var cardBtn = rc._cardImg.gameObject.AddComponent<Button>();
            cardBtn.transition = Selectable.Transition.None;
            cardBtn.onClick.AddListener(rc.TryClose);
            UIBuilder.Place(rc._card, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -10f), new Vector2(760f, 860f));

            rc._burst = UIBuilder.Image(rc._card, "Burst", SpriteFactory.Get("ui.burst"), new Color(1f, 0.85f, 0.3f, 0.5f));
            UIBuilder.Place(rc._burst.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f), new Vector2(0f, -280f), new Vector2(560f, 560f));

            rc._rarityPill = UIBuilder.Image(rc._card, "RarityPill", SpriteFactory.Get("ui.pill"), UIColors.Rarity(CatchRarity.Common));
            UIBuilder.Place(rc._rarityPill.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f), new Vector2(0f, -36f), new Vector2(220f, 62f));
            UIBuilder.AddOutline(rc._rarityPill, UIColors.Ink, 3f);
            rc._rarity = UIBuilder.Text(rc._rarityPill.rectTransform, "Rarity", "흔함", 32, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(rc._rarity.rectTransform, 4f);
            UIBuilder.AddOutline(rc._rarity, UIColors.Ink.WithAlpha(0.6f), 2f);

            rc._icon = UIBuilder.Icon(rc._card, "Icon", null, new Vector2(330f, 330f));
            UIBuilder.Place(rc._icon.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f), new Vector2(0f, -280f), new Vector2(330f, 330f));

            rc._newBadge = rc.Badge("NEW!", UIColors.Coral, new Vector2(-250f, -120f), -14f);
            rc._recordBadge = rc.Badge("최고 기록!", UIColors.Purple, new Vector2(240f, -120f), 12f);

            rc._name = UIBuilder.Text(rc._card, "Name", "", 54, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(rc._name.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -460f), new Vector2(700f, 70f));
            rc._name.resizeTextForBestFit = true;
            rc._name.resizeTextMinSize = 28;
            rc._name.resizeTextMaxSize = 54;
            rc._name.verticalOverflow = VerticalWrapMode.Truncate;

            rc._stats = UIBuilder.Text(rc._card, "Stats", "", 36, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(rc._stats.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -534f), new Vector2(700f, 50f));
            rc._stats.horizontalOverflow = HorizontalWrapMode.Overflow;

            rc._desc = UIBuilder.Text(rc._card, "Desc", "", 32, UIColors.Text, TextAnchor.UpperCenter);
            UIBuilder.Place(rc._desc.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -596f), new Vector2(660f, 120f));

            rc._flavor = UIBuilder.Text(rc._card, "Flavor", "", 26, UIColors.SubText, TextAnchor.MiddleCenter, FontStyle.Italic);
            UIBuilder.Place(rc._flavor.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 128f), new Vector2(680f, 40f));
            rc._flavor.horizontalOverflow = HorizontalWrapMode.Overflow;

            rc._ok = UIBuilder.Button(rc._card, "OK", "한 번 더!", UIColors.Coral, Color.white, new Vector2(360f, 92f), rc.TryClose, 38);
            UIBuilder.Place((RectTransform)rc._ok.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 26f), new Vector2(360f, 92f));
            rc._okLabel = UIBuilder.ButtonLabel(rc._ok);

            rc._root.SetActive(false);
            return rc;
        }

        RectTransform Badge(string text, Color color, Vector2 pos, float rot)
        {
            var img = UIBuilder.Image(_card, "Badge", SpriteFactory.Get("ui.pill"), color);
            UIBuilder.Place(img.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f), pos, new Vector2(190f, 58f));
            img.rectTransform.localRotation = Quaternion.Euler(0f, 0f, rot);
            UIBuilder.AddOutline(img, UIColors.Ink, 3f);
            var t = UIBuilder.Text(img.rectTransform, "Text", text, 30, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(t.rectTransform, 2f);
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(t, UIColors.Ink.WithAlpha(0.6f), 2f);
            return img.rectTransform;
        }

        public void Show(CatchResult r, Action onClose)
        {
            _result = r;
            _onClose = onClose;
            _open = true;
            _openedAt = Time.unscaledTime;
            _root.SetActive(true);
            _root.transform.SetAsLastSibling();
            var c = r.data;

            _icon.sprite = SpriteFactory.Icon(c);
            Color rc = UIColors.Rarity(c.rarity);
            _rarityPill.color = rc;
            _rarity.text = c.rarity == CatchRarity.Mystery ? "???" : c.rarity.Korean() + (c.rarity == CatchRarity.Common ? "" : "!");
            _burst.gameObject.SetActive(c.rarity != CatchRarity.Common || r.isNew);
            _burst.color = c.rarity == CatchRarity.Common ? new Color(1f, 0.95f, 0.7f, 0.45f) : new Color(rc.r, rc.g, rc.b, 0.55f);
            _cardImg.color = c.IsBigEvent ? Hex.C("#FFF4D6") : UIColors.Panel;

            _name.text = c.displayName;
            if (r.released)
                _stats.text = r.sizeCm.ToString("0.0") + "cm  ·  <color=#2B8A3E>방생 완료!</color>";
            else
                _stats.text = r.sizeCm.ToString("0.0") + "cm  ·  <color=#E67700>+" + UIBuilder.Money(r.price) + "</color>";
            _desc.text = c.description;
            _flavor.text = r.flavor ?? "";
            _newBadge.gameObject.SetActive(r.isNew);
            _recordBadge.gameObject.SetActive(r.isRecord);
            if (_okLabel != null) _okLabel.text = FunnyLines.Get(LineType.ResultButton);

            _group.alpha = 0f;
            Tweens.Fade(_group, 1f, 0.15f);
            Tweens.Scale(_card, new Vector3(0.45f, 0.45f, 1f), Vector3.one, 0.42f, Ease.OutBack);
            Tweens.Scale(_icon.rectTransform, new Vector3(0.2f, 0.2f, 1f), Vector3.one, 0.55f, Ease.OutElastic, null, 0.08f);
            if (r.isNew) Tweens.Scale(_newBadge, Vector3.zero, Vector3.one, 0.35f, Ease.OutBack, null, 0.35f);
            if (r.isRecord) Tweens.Scale(_recordBadge, Vector3.zero, Vector3.one, 0.35f, Ease.OutBack, null, 0.45f);
        }

        void TryClose()
        {
            if (!_open || Time.unscaledTime - _openedAt < 0.45f) return;
            Close();
        }

        public void Close()
        {
            if (!_open) return;
            _open = false;
            var cb = _onClose;
            _onClose = null;
            Tweens.Fade(_group, 0f, 0.15f, () => { if (!_open && this != null) _root.SetActive(false); });
            Tweens.Scale(_card, Vector3.one, new Vector3(0.85f, 0.85f, 1f), 0.15f, Ease.InQuad);
            if (cb != null) cb();
        }

        void Update()
        {
            if (!_open) return;
            if (_burst.gameObject.activeSelf) _burst.rectTransform.localRotation = Quaternion.Euler(0f, 0f, Time.unscaledTime * 18f);
            float wob = Mathf.Exp(-(Time.unscaledTime - _openedAt) * 2.5f) * 8f;
            _icon.rectTransform.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(Time.unscaledTime * 10f) * wob);
            if (InputBridge.Down(InputBridge.KeyId.Action) || InputBridge.Down(InputBridge.KeyId.Cancel)) TryClose();
        }
    }
}
