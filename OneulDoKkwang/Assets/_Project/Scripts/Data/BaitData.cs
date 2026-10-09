using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>미끼. 입질 속도, 등급 확률, 특정 태그 선호도를 바꾼다.</summary>
    [CreateAssetMenu(menuName = "오늘도 꽝/Bait Data", fileName = "NewBait", order = 2)]
    public class BaitData : ScriptableObject
    {
        [Header("기본 정보")]
        public string id = "new_bait";
        public string displayName = "새 미끼";
        [TextArea(2, 4)] public string description = "";
        [Min(0)] public int price;
        public int shopOrder;

        [Header("효과")]
        [Tooltip("입질까지 기다리는 시간 배율 (작을수록 빨리 문다)")]
        [Min(0.1f)] public float biteSpeed = 1f;
        [Tooltip("희귀 등급 출현 배율")]
        [Min(0f)] public float rareMultiplier = 1f;
        [Tooltip("전설 등급 출현 배율")]
        [Min(0f)] public float legendaryMultiplier = 1f;
        [Tooltip("이 태그를 가진 대상의 출현 배율이 올라간다")]
        public CatchTags favoredTags = CatchTags.None;
        [Min(0f)] public float favoredMultiplier = 1f;
        [Tooltip("??? 출현 조건에 필요한 황금 미끼인가")]
        public bool isGolden;

        [Header("아트")]
        public BaitShape shape = BaitShape.Worm;
        public Color color = new Color(0.95f, 0.55f, 0.6f);
        public Color accentColor = Color.white;
        [Tooltip("비워두면 코드로 생성")]
        public Sprite icon;

        public string StatLine()
        {
            string s = $"입질 x{1f / Mathf.Max(0.1f, biteSpeed):0.0}";
            if (rareMultiplier > 1.01f) s += $" · 희귀 x{rareMultiplier:0.0}";
            if (legendaryMultiplier > 1.01f) s += $" · 전설 x{legendaryMultiplier:0.0}";
            if (favoredTags != CatchTags.None && favoredMultiplier > 1.01f) s += $" · {TagText(favoredTags)} x{favoredMultiplier:0.0}";
            if (isGolden) s += " · ???";
            return s;
        }

        public static string TagText(CatchTags tags)
        {
            var parts = new System.Collections.Generic.List<string>();
            if ((tags & CatchTags.Fish) != 0) parts.Add("물고기");
            if ((tags & CatchTags.Junk) != 0) parts.Add("잡동사니");
            if ((tags & CatchTags.Food) != 0) parts.Add("음식");
            if ((tags & CatchTags.Tropical) != 0) parts.Add("열대");
            if ((tags & CatchTags.Grilled) != 0) parts.Add("구이");
            if ((tags & CatchTags.Weird) != 0) parts.Add("이상한 것");
            if ((tags & CatchTags.Sea) != 0) parts.Add("바다 생물");
            return string.Join("/", parts);
        }
    }
}
