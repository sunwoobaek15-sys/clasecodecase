using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>
    /// 도감: 왼쪽 격자(못 잡은 건 실루엣 + ???), 오른쪽 상세(최고 기록, 잡은 수, 설명 또는 출현 힌트).
    /// </summary>
    public sealed class EncyclopediaPanel : ModalPanel
    {
        sealed class Cell
        {
            public CatchData data;
            public Image bg;
            public Image icon;
            public Text label;
            public Button button;
        }

        readonly List<Cell> _cells = new List<Cell>();
        Text _progress;
        RectTransform _progressFill;
        Image _detailIcon;
        Text _detailName;
        Image _detailRarityPill;
        Text _detailRarity;
        Text _detailRecord;
        Text _detailDesc;
        Text _detailHint;
        CatchData _selected;

        public static EncyclopediaPanel Create(RectTransform parent)
        {
            var p = CreateOn<EncyclopediaPanel>(parent, "Encyclopedia (도감)");
            p.Build();
            return p;
        }

        void Build()
        {
            BuildFrame("도감", new Vector2(1560f, 900f));

            var bar = UIBuilder.Image(Window, "ProgressBar", SpriteFactory.Get("ui.pill"), UIColors.PanelDark);
            UIBuilder.Place(bar.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(40f, -70f), new Vector2(560f, 40f));
            UIBuilder.AddOutline(bar, UIColors.Ink.WithAlpha(0.5f), 2f);
            var fill = UIBuilder.Image(bar.rectTransform, "Fill", SpriteFactory.Get("ui.pill"), UIColors.Teal);
            _progressFill = fill.rectTransform;
            _progressFill.anchorMin = Vector2.zero;
            _progressFill.anchorMax = new Vector2(0.3f, 1f);
            _progressFill.offsetMin = new Vector2(4f, 4f);
            _progressFill.offsetMax = new Vector2(-4f, -4f);
            _progress = UIBuilder.Text(bar.rectTransform, "Text", "", 26, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(_progress.rectTransform);
            _progress.horizontalOverflow = HorizontalWrapMode.Overflow;
            UIBuilder.AddOutline(_progress, Color.white, 2f);

            RectTransform content;
            var scroll = UIBuilder.ScrollView(Window, "Grid", out content);
            var srt = (RectTransform)scroll.transform;
            srt.anchorMin = new Vector2(0f, 0f);
            srt.anchorMax = new Vector2(0f, 1f);
            srt.pivot = new Vector2(0f, 0.5f);
            srt.offsetMin = new Vector2(34f, 30f);
            srt.offsetMax = new Vector2(34f + 1000f, -120f);
            var grid = content.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(150f, 176f);
            grid.spacing = new Vector2(14f, 14f);
            grid.padding = new RectOffset(10, 10, 10, 10);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 6;
            var fitter = content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;

            foreach (var c in Game.State.Catches)
            {
                var cell = new Cell { data = c };
                cell.bg = UIBuilder.Panel(content, "Cell_" + c.id, Color.white, UIColors.Ink.WithAlpha(0.7f), false, true);
                cell.button = cell.bg.gameObject.AddComponent<Button>();
                cell.button.targetGraphic = cell.bg;
                var captured = c;
                cell.button.onClick.AddListener(() => Select(captured));
                cell.icon = UIBuilder.Icon(cell.bg.rectTransform, "Icon", SpriteFactory.Icon(c), new Vector2(112f, 112f));
                UIBuilder.Place(cell.icon.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -8f), new Vector2(112f, 112f));
                cell.label = UIBuilder.Text(cell.bg.rectTransform, "Name", "", 22, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
                UIBuilder.Place(cell.label.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 6f), new Vector2(140f, 50f));
                cell.label.resizeTextForBestFit = true;
                cell.label.resizeTextMinSize = 12;
                cell.label.resizeTextMaxSize = 22;
                cell.label.verticalOverflow = VerticalWrapMode.Truncate;
                _cells.Add(cell);
            }

            // 상세
            var detail = UIBuilder.Panel(Window, "Detail", Color.white, UIColors.Ink.WithAlpha(0.6f), false, false);
            var drt = detail.rectTransform;
            drt.anchorMin = new Vector2(1f, 0f);
            drt.anchorMax = new Vector2(1f, 1f);
            drt.pivot = new Vector2(1f, 0.5f);
            drt.offsetMin = new Vector2(-490f, 30f);
            drt.offsetMax = new Vector2(-34f, -70f);
            _detailIcon = UIBuilder.Icon(drt, "Icon", null, new Vector2(260f, 260f));
            UIBuilder.Place(_detailIcon.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(260f, 260f));
            _detailRarityPill = UIBuilder.Image(drt, "RarityPill", SpriteFactory.Get("ui.pill"), UIColors.Rarity(CatchRarity.Common));
            UIBuilder.Place(_detailRarityPill.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -300f), new Vector2(150f, 46f));
            _detailRarity = UIBuilder.Text(_detailRarityPill.rectTransform, "Text", "", 26, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Stretch(_detailRarity.rectTransform);
            UIBuilder.AddOutline(_detailRarity, UIColors.Ink.WithAlpha(0.6f), 2f);
            _detailName = UIBuilder.Text(drt, "Name", "", 40, UIColors.Text, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(_detailName.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -356f), new Vector2(430f, 60f));
            _detailName.resizeTextForBestFit = true;
            _detailName.resizeTextMinSize = 22;
            _detailName.resizeTextMaxSize = 40;
            _detailName.verticalOverflow = VerticalWrapMode.Truncate;
            _detailRecord = UIBuilder.Text(drt, "Record", "", 26, UIColors.SubText, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIBuilder.Place(_detailRecord.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -420f), new Vector2(430f, 40f));
            _detailDesc = UIBuilder.Text(drt, "Desc", "", 28, UIColors.Text, TextAnchor.UpperCenter);
            UIBuilder.Place(_detailDesc.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -470f), new Vector2(410f, 200f));
            _detailHint = UIBuilder.Text(drt, "Hint", "", 24, UIColors.TealDark, TextAnchor.LowerCenter, FontStyle.Bold);
            UIBuilder.Place(_detailHint.rectTransform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(420f, 110f));
        }

        protected override void OnOpened()
        {
            Refresh();
            if (_selected == null && Game.State.Catches.Count > 0) _selected = Game.State.Catches[0];
            Select(_selected);
        }

        void Refresh()
        {
            var gm = Game.State;
            int found = gm.DiscoveredCount;
            int total = gm.TotalSpecies;
            _progress.text = "발견 " + found + " / " + total + "  (" + Mathf.RoundToInt(total > 0 ? found * 100f / total : 0f) + "%)";
            _progressFill.anchorMax = new Vector2(Mathf.Max(0.04f, total > 0 ? found / (float)total : 0f), 1f);
            foreach (var cell in _cells)
            {
                bool has = gm.IsDiscovered(cell.data);
                cell.icon.color = has ? Color.white : new Color(0.12f, 0.1f, 0.16f, 0.85f);
                cell.label.text = has ? cell.data.displayName : cell.data.hiddenName;
                Color rc = UIColors.Rarity(cell.data.rarity);
                cell.bg.color = has ? Color.Lerp(Color.white, rc, 0.28f) : UIColors.PanelDark;
            }
        }

        void Select(CatchData c)
        {
            if (c == null) return;
            _selected = c;
            var gm = Game.State;
            bool has = gm.IsDiscovered(c);
            _detailIcon.sprite = SpriteFactory.Icon(c);
            _detailIcon.color = has ? Color.white : new Color(0.12f, 0.1f, 0.16f, 0.85f);
            _detailName.text = has ? c.displayName : c.hiddenName;
            _detailRarityPill.color = UIColors.Rarity(c.rarity);
            _detailRarity.text = c.rarity == CatchRarity.Mystery ? "???" : c.rarity.Korean();
            var rec = gm.GetRecord(c);
            if (has && rec != null)
            {
                _detailRecord.text = "최고 " + rec.bestSizeCm.ToString("0.0") + "cm  ·  " + rec.count + "번 잡음";
                _detailDesc.text = c.description;
            }
            else
            {
                _detailRecord.text = "아직 못 잡았다";
                _detailDesc.text = c.rarity == CatchRarity.Mystery ? "도감의 마지막 칸. 비 오는 밤… 황금빛 무언가가 필요하다는 소문." : "어떤 녀석일까…?";
            }
            _detailHint.text = "출현: " + CatchTable.HintText(c);
            foreach (var cell in _cells)
            {
                var outline = cell.bg.transform.Find("Border");
                if (outline != null) outline.GetComponent<Image>().color = cell.data == c ? UIColors.Coral : UIColors.Ink.WithAlpha(0.7f);
            }
            Tweens.Punch(_detailIcon.transform, 0.12f, 0.25f);
        }
    }
}
