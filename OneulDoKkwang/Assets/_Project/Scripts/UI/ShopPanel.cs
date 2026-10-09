using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>상점: 낚싯대 / 미끼 / 장소(해금·이동) 탭.</summary>
    public sealed class ShopPanel : ModalPanel
    {
        public enum Tab { Rods, Baits, Places }

        Tab _tab;
        RectTransform _content;
        ScrollRect _scroll;
        Text _money;
        readonly Dictionary<Tab, Button> _tabButtons = new Dictionary<Tab, Button>();
        readonly List<GameObject> _rows = new List<GameObject>();

        public static ShopPanel Create(RectTransform parent)
        {
            var p = CreateOn<ShopPanel>(parent, "Shop (상점)");
            p.Build();
            return p;
        }

        void Build()
        {
            BuildFrame("상점", new Vector2(1440f, 900f));
            _money = UIBuilder.Text(Window, "Money", "", 32, UIColors.Gold, TextAnchor.MiddleRight, FontStyle.Bold);
            UIBuilder.Place(_money.rectTransform, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-110f, -62f), new Vector2(420f, 50f));
            _money.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(_money, Color.white, 2f);

            AddTab(Tab.Rods, "낚싯대", 0);
            AddTab(Tab.Baits, "미끼", 1);
            AddTab(Tab.Places, "장소", 2);

            _scroll = UIBuilder.ScrollView(Window, "List", out _content);
            var srt = (RectTransform)_scroll.transform;
            srt.anchorMin = new Vector2(0f, 0f);
            srt.anchorMax = new Vector2(1f, 1f);
            srt.offsetMin = new Vector2(36f, 30f);
            srt.offsetMax = new Vector2(-36f, -190f);
            var vlg = _content.gameObject.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = 14f;
            vlg.padding = new RectOffset(6, 6, 6, 6);
            vlg.childControlWidth = true;
            vlg.childControlHeight = false;
            vlg.childForceExpandWidth = true;
            vlg.childForceExpandHeight = false;
            var fitter = _content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        }

        void AddTab(Tab tab, string label, int index)
        {
            var b = UIBuilder.Button(Window, "Tab_" + label, label, UIColors.Panel, UIColors.Text, new Vector2(220f, 76f), () => Show(tab), 32);
            UIBuilder.Place((RectTransform)b.transform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(40f + index * 236f, -86f), new Vector2(220f, 76f));
            _tabButtons[tab] = b;
        }

        public void OpenAt(Tab tab)
        {
            _tab = tab;
            Open();
        }

        protected override void OnOpened()
        {
            Show(_tab);
        }

        public void Show(Tab tab)
        {
            _tab = tab;
            foreach (var kv in _tabButtons)
            {
                bool on = kv.Key == tab;
                ((Image)kv.Value.targetGraphic).color = on ? UIColors.Teal : UIColors.Panel;
                var l = UIBuilder.ButtonLabel(kv.Value);
                if (l != null) l.color = on ? Color.white : UIColors.Text;
            }
            Rebuild();
            _scroll.verticalNormalizedPosition = 1f;
        }

        void Rebuild()
        {
            foreach (var r in _rows)
            {
                r.SetActive(false);
                Destroy(r);
            }
            _rows.Clear();
            var gm = Game.State;
            _money.text = "보유 " + UIBuilder.Money(gm.Money);
            switch (_tab)
            {
                case Tab.Rods:
                    foreach (var r in gm.Rods)
                    {
                        bool owned = gm.OwnsRod(r);
                        bool equipped = gm.Rod == r;
                        var rod = r;
                        AddRow(SpriteFactory.RodIcon(r), r.displayName, r.StatLine(), r.description,
                            equipped ? "장착 중" : (owned ? "장착" : "구매 " + UIBuilder.Money(r.price)),
                            !equipped, owned ? UIColors.Teal : UIColors.Coral, equipped,
                            () => OnRod(rod));
                    }
                    break;
                case Tab.Baits:
                    foreach (var b in gm.Baits)
                    {
                        bool owned = gm.OwnsBait(b);
                        bool equipped = gm.Bait == b;
                        var bait = b;
                        AddRow(SpriteFactory.BaitIcon(b), b.displayName, b.StatLine(), b.description,
                            equipped ? "장착 중" : (owned ? "장착" : "구매 " + UIBuilder.Money(b.price)),
                            !equipped, owned ? UIColors.Teal : UIColors.Coral, equipped,
                            () => OnBait(bait));
                    }
                    break;
                default:
                    foreach (var l in gm.Locations)
                    {
                        bool unlocked = gm.IsUnlocked(l);
                        bool here = gm.Location == l;
                        bool req = gm.MeetsRequirement(l);
                        string label;
                        Color color;
                        if (here) { label = "현재 위치"; color = UIColors.Teal; }
                        else if (unlocked) { label = "이동"; color = UIColors.Teal; }
                        else if (!req) { label = "도감 " + l.requiredDiscoveries + "종 필요"; color = UIColors.Disabled; }
                        else { label = "해금 " + UIBuilder.Money(l.unlockPrice); color = UIColors.Coral; }
                        string stat = unlocked ? "해금됨" : (l.requiredDiscoveries > 0 ? "조건: 도감 " + l.requiredDiscoveries + "종 + " + UIBuilder.Money(l.unlockPrice) : "해금 " + UIBuilder.Money(l.unlockPrice));
                        var loc = l;
                        AddRow(SpriteFactory.LocationThumb(l), l.displayName, stat, l.description, label, !here, color, here, () => OnPlace(loc), new Vector2(190f, 120f));
                    }
                    break;
            }
        }

        void AddRow(Sprite icon, string name, string stat, string desc, string action, bool actionEnabled, Color actionColor, bool tagged, System.Action onAction, Vector2? iconSize = null)
        {
            var row = UIBuilder.Panel(_content, "Row_" + name, Color.white, UIColors.Ink.WithAlpha(0.55f), false, false);
            var rt = row.rectTransform;
            rt.sizeDelta = new Vector2(0f, 156f);
            var le = row.gameObject.AddComponent<LayoutElement>();
            le.preferredHeight = 156f;
            le.minHeight = 156f;
            _rows.Add(row.gameObject);

            var size = iconSize ?? new Vector2(124f, 124f);
            var img = UIBuilder.Icon(rt, "Icon", icon, size);
            UIBuilder.Place(img.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(18f, 0f), size);
            float x0 = 30f + size.x;

            var n = UIBuilder.Text(rt, "Name", name, 34, UIColors.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            UIBuilder.Place(n.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(x0, -10f), new Vector2(620f, 46f));
            n.horizontalOverflow = HorizontalWrapMode.Overflow;
            if (tagged)
            {
                var tag = UIBuilder.Image(rt, "Tag", SpriteFactory.Get("ui.check"), Color.white);
                UIBuilder.Place(tag.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(x0 + Mathf.Min(560f, n.preferredWidth + 10f), -8f), new Vector2(44f, 44f));
            }
            var s = UIBuilder.Text(rt, "Stat", stat, 24, UIColors.TealDark, TextAnchor.MiddleLeft, FontStyle.Bold);
            UIBuilder.Place(s.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(x0, -56f), new Vector2(820f, 34f));
            s.horizontalOverflow = HorizontalWrapMode.Overflow;
            var d = UIBuilder.Text(rt, "Desc", desc, 24, UIColors.SubText, TextAnchor.UpperLeft);
            UIBuilder.Place(d.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(x0, -92f), new Vector2(820f, 60f));

            var b = UIBuilder.Button(rt, "Action", action, actionColor, Color.white, new Vector2(250f, 80f), onAction, 30);
            UIBuilder.Place((RectTransform)b.transform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-22f, 0f), new Vector2(250f, 80f));
            b.interactable = actionEnabled;
        }

        void OnRod(RodData r)
        {
            var gm = Game.State;
            if (gm.OwnsRod(r)) { gm.EquipRod(r); Feedback("장착: " + r.displayName); }
            else Purchase(gm.BuyRod(r), r.displayName, r.price);
            Rebuild();
        }

        void OnBait(BaitData b)
        {
            var gm = Game.State;
            if (gm.OwnsBait(b)) { gm.EquipBait(b); Feedback("장착: " + b.displayName); }
            else Purchase(gm.BuyBait(b), b.displayName, b.price);
            Rebuild();
        }

        void OnPlace(LocationData l)
        {
            var gm = Game.State;
            if (gm.IsUnlocked(l))
            {
                if (gm.Location == l) return;
                Close();
                if (Game.Director != null) Game.Director.Travel(l);
                return;
            }
            var res = gm.UnlockLocation(l);
            if (res == ShopResult.Ok)
            {
                Feedback("새 장소 해금! " + l.displayName);
                if (Game.Cat != null) Game.Cat.Say(LineType.CatUnlock);
            }
            else if (res == ShopResult.Locked) Feedback("도감을 " + l.requiredDiscoveries + "종 이상 채워야 한다");
            else if (res == ShopResult.NotEnoughMoney) Feedback("돈이 부족하다… (" + UIBuilder.Money(l.unlockPrice - gm.Money) + " 더 필요)");
            Rebuild();
        }

        void Purchase(ShopResult res, string name, int price)
        {
            switch (res)
            {
                case ShopResult.Ok:
                    Feedback("구매 완료! " + name);
                    if (Game.Cat != null) Game.Cat.Say(LineType.CatPurchase);
                    break;
                case ShopResult.NotEnoughMoney:
                    Feedback("돈이 부족하다… (" + UIBuilder.Money(price - Game.State.Money) + " 더 필요)");
                    break;
            }
        }

        void Feedback(string msg)
        {
            if (Game.UI != null) Game.UI.Announcer.Toast(msg);
        }
    }
}
