using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>낚싯대. 릴 감기 초록 바 크기, 감는 힘, 비거리, 운에 영향.</summary>
    [CreateAssetMenu(menuName = "오늘도 꽝/Rod Data", fileName = "NewRod", order = 1)]
    public class RodData : ScriptableObject
    {
        [Header("기본 정보")]
        public string id = "new_rod";
        public string displayName = "새 낚싯대";
        [TextArea(2, 4)] public string description = "";
        [Min(0)] public int price;
        public int shopOrder;

        [Header("성능")]
        [Tooltip("릴 감기 초록 바의 높이 (트랙 대비 비율)")]
        [Range(0.12f, 0.5f)] public float barSize = 0.22f;
        [Tooltip("초록 바 안에 있을 때 게이지가 차는 속도 배율")]
        [Min(0.1f)] public float reelPower = 1f;
        [Tooltip("최대 비거리 배율")]
        [Min(0.5f)] public float castDistance = 1f;
        [Tooltip("희귀/전설 확률과 크기에 붙는 보너스 (0~1)")]
        [Range(0f, 1f)] public float luck;

        [Header("아트")]
        public Color rodColor = new Color(0.55f, 0.36f, 0.2f);
        public Color accentColor = new Color(0.95f, 0.8f, 0.3f);
        [Tooltip("비워두면 코드로 생성")]
        public Sprite icon;

        public string StatLine()
        {
            return $"바 {Mathf.RoundToInt(barSize * 100f)}% · 힘 x{reelPower:0.00} · 비거리 x{castDistance:0.00} · 운 +{Mathf.RoundToInt(luck * 100f)}%";
        }
    }
}
