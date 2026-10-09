using System;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 코드로 그리는 아이콘의 파라미터. CatchData.icon 이 비어 있을 때만 사용된다.
    /// </summary>
    [Serializable]
    public struct IconStyle
    {
        public IconShape shape;
        public Color primary;
        public Color secondary;
        public Color accent;
        [Tooltip("모양별 변형 값 (0~1). 줄무늬 개수, 길쭉함 등")]
        [Range(0f, 1f)] public float variant;

        public IconStyle(IconShape shape, Color primary, Color secondary, Color accent, float variant = 0f)
        {
            this.shape = shape;
            this.primary = primary;
            this.secondary = secondary;
            this.accent = accent;
            this.variant = variant;
        }
    }

    /// <summary>
    /// 낚을 수 있는 것 하나(물고기든 장화든)의 데이터.
    /// </summary>
    [CreateAssetMenu(menuName = "오늘도 꽝/Catch Data", fileName = "NewCatch", order = 0)]
    public class CatchData : ScriptableObject
    {
        [Header("기본 정보")]
        public string id = "new_catch";
        public string displayName = "새 물고기";
        [Tooltip("도감에서 아직 못 잡았을 때 보이는 이름")]
        public string hiddenName = "???";
        public CatchRarity rarity = CatchRarity.Common;
        [Tooltip("도감 정렬 순서")]
        public int encyclopediaOrder;
        [TextArea(2, 4)] public string description = "";

        [Header("출현 조건")]
        public LocationMask locations = LocationMask.Beach;
        public TimeMask times = TimeMask.All;
        public WeatherRule weather = WeatherRule.Any;
        [Tooltip("비가 올 때 출현 가중치 배율")]
        [Min(0f)] public float rainMultiplier = 1f;
        [Tooltip("월요일에는 절대 안 물림")]
        public bool neverOnMonday;
        [Tooltip("황금 미끼를 끼워야만 등장")]
        public bool requiresGoldenBait;
        [Tooltip("이 파워 이상으로 멀리 던져야 등장 (0~1)")]
        [Range(0f, 1f)] public float minCastPower;
        [Tooltip("같은 등급 안에서의 상대 출현 가중치")]
        [Min(0f)] public float spawnWeight = 1f;
        public CatchTags tags = CatchTags.Fish;

        [Header("크기 · 가격")]
        [Tooltip("x = 최소 cm, y = 최대 cm")]
        public Vector2 sizeRangeCm = new Vector2(10f, 30f);
        [Min(0)] public int basePrice = 10;

        [Header("릴 감기")]
        public MovePattern movePattern = MovePattern.Calm;
        [Range(0f, 1f)] public float difficulty = 0.3f;

        [Header("연출 · 대사")]
        public CatchSpecial special = CatchSpecial.None;
        [Tooltip("놓쳤을 때 전용 대사 (비우면 공통 병맛 대사)")]
        [TextArea(1, 3)] public string escapeLine = "";
        [Tooltip("릴 감는 동안 주인공이 외치는 말 (선택)")]
        public string reelShout = "";

        [Header("아트 (비워두면 코드로 생성)")]
        public Sprite icon;
        public IconStyle iconStyle = new IconStyle(IconShape.Fish, Color.gray, Color.white, Color.black);

        public bool IsReleaseOnly => special == CatchSpecial.Release;
        public bool IsBigEvent => rarity == CatchRarity.Legendary || rarity == CatchRarity.Mystery;

        public string NameFor(bool discovered)
        {
            return discovered ? displayName : hiddenName;
        }
    }
}
