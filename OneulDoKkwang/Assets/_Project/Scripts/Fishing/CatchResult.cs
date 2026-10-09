using System;

namespace OneulDoKkwang
{
    /// <summary>한 번 낚아 올린 결과 (결과 카드에 그대로 표시).</summary>
    public sealed class CatchResult
    {
        public CatchData data;
        public float sizeCm;
        public int price;
        public bool isNew;
        public bool isRecord;
        public bool released;
        public int streak;
        public string flavor;
        public LocationTheme location;
    }

    /// <summary>크기·가격 계산 (순수 C#).</summary>
    public static class CatchMath
    {
        /// <summary>0~1. 낚싯대 운이 높을수록 큰 쪽으로 치우친다.</summary>
        public static float RollSizeT(System.Random rng, float luck)
        {
            double r = rng.NextDouble();
            double exponent = 1.0 / (1.0 + Math.Max(0f, luck) * 1.5);
            return (float)Math.Pow(r, exponent);
        }

        public static float SizeFromT(CatchData c, float t)
        {
            float min = Math.Min(c.sizeRangeCm.x, c.sizeRangeCm.y);
            float max = Math.Max(c.sizeRangeCm.x, c.sizeRangeCm.y);
            float size = min + (max - min) * t;
            return (float)Math.Round(size, 1);
        }

        /// <summary>판매가: 기본가 × 크기 보정(0.75~1.35) × 연속 보너스(최대 +50%).</summary>
        public static int Price(CatchData c, float t, int streak)
        {
            if (c == null || c.special == CatchSpecial.Release || c.basePrice <= 0) return 0;
            if (c.special == CatchSpecial.Mystery) return c.basePrice; // 7777원 고정
            float sizeMul = 0.75f + 0.6f * t;
            float streakMul = 1f + Math.Min(Math.Max(streak - 1, 0), 5) * 0.1f;
            float raw = c.basePrice * sizeMul * streakMul;
            int price = (int)Math.Round(raw);
            if (price >= 100) price = (int)(Math.Round(raw / 10.0) * 10);
            return Math.Max(1, price);
        }
    }
}
