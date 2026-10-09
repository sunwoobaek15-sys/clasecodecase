using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>확률 테이블로 무엇이 물지 정하고, 낚아 올리면 크기·가격을 굴려 결과를 만든다.</summary>
    public sealed class CatchResolver : MonoBehaviour
    {
        public FishingContext LastContext { get; private set; }

        public CatchData Roll(FishingContext ctx)
        {
            LastContext = ctx;
            var gm = Game.State;
            if (gm == null) return null;
            if (gm.DebugForcedCatch != null)
            {
                var forced = gm.DebugForcedCatch;
                gm.DebugForcedCatch = null;
                return forced;
            }
            var c = CatchTable.Roll(gm.Catches, ctx, Game.Rng);
            if (c != null) return c;
            // 조건에 맞는 게 하나도 없으면(데이터를 지운 경우 등) 아무거나 흔한 것
            foreach (var x in gm.Catches) if (x.rarity == CatchRarity.Common) return x;
            return gm.Catches.Count > 0 ? gm.Catches[0] : null;
        }

        public CatchResult Finalize(CatchData c)
        {
            var gm = Game.State;
            float luck = gm != null && gm.Rod != null ? gm.Rod.luck : 0f;
            float t = CatchMath.RollSizeT(Game.Rng, luck);
            var result = gm.RegisterCatch(c, t);
            result.flavor = MakeFlavor(result);
            return result;
        }

        static string MakeFlavor(CatchResult r)
        {
            if (r.released) return "보호종은 바로 방생! 선행 포인트 +1";
            if (r.data.rarity == CatchRarity.Mystery) return "도감 마지막 칸이 채워졌다…?";
            if (r.streak >= 2)
            {
                int bonus = Mathf.Min(r.streak - 1, 5) * 10;
                return $"{r.streak}연속 낚시! 판매가 +{bonus}%";
            }
            return FunnyLines.Get(LineType.ResultFlavor);
        }
    }
}
