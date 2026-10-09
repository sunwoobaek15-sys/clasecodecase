using System.Collections.Generic;

namespace OneulDoKkwang
{
    /// <summary>던진 순간의 조건. 확률 테이블 계산에 쓰인다.</summary>
    public struct FishingContext
    {
        public LocationTheme location;
        public TimeOfDay time;
        public WeatherType weather;
        public Weekday weekday;
        public BaitData bait;
        public RodData rod;
        /// <summary>0~1 캐스팅 파워.</summary>
        public float castPower;
        public bool perfectCast;
    }

    /// <summary>
    /// 확률 테이블: 장소 × 시간대 × 날씨 × 미끼(+ 낚싯대 운, 캐스팅 파워)로 가중치를 계산한다.
    /// 순수 C# (UnityEngine 호출 없음) → 에디터 검증 메뉴와 오프라인 테스트에서도 같은 코드를 쓴다.
    /// </summary>
    public static class CatchTable
    {
        public static float RarityBase(CatchRarity rarity)
        {
            switch (rarity)
            {
                case CatchRarity.Common: return 100f;
                case CatchRarity.Rare: return 30f;
                case CatchRarity.Legendary: return 10f;
                default: return 40f; // Mystery: 조건이 맞으면 꽤 자주 (조건 자체가 어려움)
            }
        }

        /// <summary>조건 불충족 사유. 0 가중치일 때 도감 힌트/검증 로그에 쓴다.</summary>
        public static string BlockReason(CatchData c, in FishingContext ctx)
        {
            if (c == null) return "데이터 없음";
            if ((c.locations & ctx.location.ToMask()) == 0) return "장소";
            if ((c.times & ctx.time.ToMask()) == 0) return "시간대";
            if (c.weather == WeatherRule.RainOnly && ctx.weather != WeatherType.Rain) return "날씨(비)";
            if (c.weather == WeatherRule.ClearOnly && ctx.weather != WeatherType.Clear) return "날씨(맑음)";
            if (c.neverOnMonday && ctx.weekday == Weekday.Mon) return "월요일";
            if (c.requiresGoldenBait && (ctx.bait == null || !ctx.bait.isGolden)) return "황금 미끼";
            if (ctx.castPower + 0.0001f < c.minCastPower) return "비거리";
            return null;
        }

        public static float Weight(CatchData c, in FishingContext ctx)
        {
            if (BlockReason(c, ctx) != null) return 0f;

            float w = RarityBase(c.rarity) * c.spawnWeight;
            if (ctx.weather == WeatherType.Rain) w *= c.rainMultiplier;

            float luck = ctx.rod != null ? ctx.rod.luck : 0f;
            switch (c.rarity)
            {
                case CatchRarity.Rare:
                    w *= (ctx.bait != null ? ctx.bait.rareMultiplier : 1f) * (1f + luck);
                    w *= ctx.perfectCast ? 1.25f : 1f;
                    w *= 0.75f + 0.5f * Clamp01(ctx.castPower);
                    break;
                case CatchRarity.Legendary:
                    w *= (ctx.bait != null ? ctx.bait.legendaryMultiplier : 1f) * (1f + 2f * luck);
                    w *= ctx.perfectCast ? 1.5f : 1f;
                    w *= 0.75f + 0.5f * Clamp01(ctx.castPower);
                    break;
            }

            if (ctx.bait != null && ctx.bait.favoredTags != CatchTags.None && (c.tags & ctx.bait.favoredTags) != 0)
                w *= ctx.bait.favoredMultiplier;

            return w < 0f ? 0f : w;
        }

        /// <summary>가중치 랜덤 뽑기. 후보가 하나도 없으면 null.</summary>
        public static CatchData Roll(IList<CatchData> all, in FishingContext ctx, System.Random rng)
        {
            float total = 0f;
            for (int i = 0; i < all.Count; i++) total += Weight(all[i], ctx);
            if (total <= 0f) return null;
            double r = rng.NextDouble() * total;
            CatchData lastValid = null;
            for (int i = 0; i < all.Count; i++)
            {
                float w = Weight(all[i], ctx);
                if (w <= 0f) continue;
                lastValid = all[i];
                r -= w;
                if (r <= 0) return all[i];
            }
            return lastValid;
        }

        /// <summary>현재 조건에서의 출현 확률표 (0~1). 디버그/검증용.</summary>
        public static List<KeyValuePair<CatchData, float>> Distribution(IList<CatchData> all, in FishingContext ctx)
        {
            var list = new List<KeyValuePair<CatchData, float>>();
            float total = 0f;
            for (int i = 0; i < all.Count; i++) total += Weight(all[i], ctx);
            if (total <= 0f) return list;
            for (int i = 0; i < all.Count; i++)
            {
                float w = Weight(all[i], ctx);
                if (w > 0f) list.Add(new KeyValuePair<CatchData, float>(all[i], w / total));
            }
            list.Sort((a, b) => b.Value.CompareTo(a.Value));
            return list;
        }

        /// <summary>
        /// 어떤 조건에서든 잡을 수 있는지(가중치 > 0) 검사하고, 가장 잘 나오는 조건과 확률을 돌려준다.
        /// "25종 전부 잡을 수 있다"는 완료 기준을 검증하는 데 쓴다.
        /// </summary>
        public static bool FindBestCondition(IList<CatchData> all, CatchData target, IList<BaitData> baits, IList<RodData> rods,
            out FishingContext best, out float bestChance)
        {
            best = default(FishingContext);
            bestChance = 0f;
            RodData bestRod = null;
            foreach (var r in rods) if (r != null && (bestRod == null || r.luck > bestRod.luck)) bestRod = r;
            for (int loc = 0; loc < 4; loc++)
                for (int time = 0; time < 3; time++)
                    for (int weather = 0; weather < 2; weather++)
                        for (int day = 0; day < 7; day++)
                            foreach (var bait in baits)
                            {
                                var ctx = new FishingContext
                                {
                                    location = (LocationTheme)loc,
                                    time = (TimeOfDay)time,
                                    weather = (WeatherType)weather,
                                    weekday = (Weekday)day,
                                    bait = bait,
                                    rod = bestRod,
                                    castPower = 1f,
                                    perfectCast = true,
                                };
                                float total = 0f;
                                for (int i = 0; i < all.Count; i++) total += Weight(all[i], ctx);
                                if (total <= 0f) continue;
                                float chance = Weight(target, ctx) / total;
                                if (chance > bestChance)
                                {
                                    bestChance = chance;
                                    best = ctx;
                                }
                            }
            return bestChance > 0f;
        }

        /// <summary>도감 힌트: 언제 어디서 나오는지 사람이 읽을 수 있게.</summary>
        public static string HintText(CatchData c)
        {
            if (c == null) return "";
            var parts = new List<string>();
            parts.Add(LocationText(c.locations));
            parts.Add(TimeText(c.times));
            if (c.weather == WeatherRule.RainOnly) parts.Add("비 오는 날");
            else if (c.weather == WeatherRule.ClearOnly) parts.Add("맑은 날");
            else if (c.rainMultiplier > 1.5f) parts.Add("비 오면 자주");
            if (c.neverOnMonday) parts.Add("월요일 제외");
            if (c.requiresGoldenBait) parts.Add("황금 미끼");
            if (c.minCastPower > 0.01f) parts.Add("아주 멀리 던지기");
            return string.Join(" · ", parts);
        }

        public static string LocationText(LocationMask m)
        {
            if (m == LocationMask.All) return "모든 장소";
            var parts = new List<string>();
            if ((m & LocationMask.Beach) != 0) parts.Add("해변");
            if ((m & LocationMask.Pier) != 0) parts.Add("부두");
            if ((m & LocationMask.Volcano) != 0) parts.Add("용암");
            if ((m & LocationMask.Cloud) != 0) parts.Add("구름");
            return parts.Count == 0 ? "어디에도 없음" : string.Join("/", parts);
        }

        public static string TimeText(TimeMask m)
        {
            if (m == TimeMask.All) return "하루 종일";
            var parts = new List<string>();
            if ((m & TimeMask.Day) != 0) parts.Add("낮");
            if ((m & TimeMask.Sunset) != 0) parts.Add("노을");
            if ((m & TimeMask.Night) != 0) parts.Add("밤");
            return parts.Count == 0 ? "없음" : string.Join("/", parts);
        }

        static float Clamp01(float v)
        {
            return v < 0f ? 0f : (v > 1f ? 1f : v);
        }
    }
}
