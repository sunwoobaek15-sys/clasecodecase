using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 스프라이트 키 → 코드로 그린 그림. (순수 C#: 오프라인 미리보기에서도 사용)
    /// 실제 Sprite 생성/캐시/교체(ArtLibrary)는 SpriteFactory 가 담당.
    /// </summary>
    public static class SpriteCatalog
    {
        public static bool TryPaint(string key, out PaintedSprite ps)
        {
            ps = default(PaintedSprite);
            switch (key)
            {
                case SpriteKeys.PlayerBody: ps = WorldPainter.PlayerBody(); return true;
                case SpriteKeys.PlayerHead: ps = WorldPainter.PlayerHead(); return true;
                case SpriteKeys.PlayerFaceOpen: ps = WorldPainter.PlayerFace(WorldPainter.Face.Open); return true;
                case SpriteKeys.PlayerFaceSleep: ps = WorldPainter.PlayerFace(WorldPainter.Face.Sleep); return true;
                case SpriteKeys.PlayerFaceSurprised: ps = WorldPainter.PlayerFace(WorldPainter.Face.Surprised); return true;
                case SpriteKeys.Rod: ps = WorldPainter.Rod(Hex.C("#C8A165"), Hex.C("#5E8C31")); return true;
                case SpriteKeys.CatBody: ps = WorldPainter.CatBody(); return true;
                case SpriteKeys.CatTail: ps = WorldPainter.CatTail(); return true;
                case SpriteKeys.CatFaceOpen: ps = WorldPainter.CatFaceSprite(WorldPainter.CatFace.Open); return true;
                case SpriteKeys.CatFaceHappy: ps = WorldPainter.CatFaceSprite(WorldPainter.CatFace.Happy); return true;
                case SpriteKeys.CatFaceSurprised: ps = WorldPainter.CatFaceSprite(WorldPainter.CatFace.Surprised); return true;
                case SpriteKeys.CatFaceSleep: ps = WorldPainter.CatFaceSprite(WorldPainter.CatFace.Sleep); return true;
                case SpriteKeys.Bobber: ps = WorldPainter.Bobber(); return true;
                case SpriteKeys.Hook: ps = WorldPainter.Hook(); return true;
                case SpriteKeys.Bucket: ps = WorldPainter.Bucket(); return true;
                case SpriteKeys.HulaDancer: ps = WorldPainter.HulaDancer(); return true;
                case SpriteKeys.Sun: ps = WorldPainter.Sun(); return true;
                case SpriteKeys.Moon: ps = WorldPainter.Moon(); return true;
                case SpriteKeys.Turtle:
                {
                    var cv = IconPainter.PaintCatch(new IconStyle(IconShape.Turtle, Hex.C("#6A994E"), Hex.C("#A7C957"), Hex.C("#386641")), 160);
                    ps = new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 100f);
                    return true;
                }

                case "decor.palm.0": ps = WorldPainter.PalmTree(0.85f); return true;
                case "decor.palm.1": ps = WorldPainter.PalmTree(0.25f); return true;
                case "decor.surfboard.0": ps = ScenicPainter.Surfboard(Hex.C("#F25F5C"), Color.white); return true;
                case "decor.surfboard.1": ps = ScenicPainter.Surfboard(Hex.C("#3FB8AF"), Hex.C("#FFE066")); return true;
                case "decor.surfboard.2": ps = ScenicPainter.Surfboard(Hex.C("#FFD166"), Hex.C("#FF8FAB")); return true;

                // ---- 사진처럼 그린 하와이 배경 (ScenicPainter)
                case "decor.tallpalm.0": ps = ScenicPainter.TallPalm(0); return true;
                case "decor.tallpalm.1": ps = ScenicPainter.TallPalm(1); return true;
                case "decor.tallpalm.2": ps = ScenicPainter.TallPalm(2); return true;
                case "decor.tallpalm.3": ps = ScenicPainter.TallPalm(3); return true;
                case "decor.leanpalm": ps = ScenicPainter.LeaningPalmTree(); return true;
                case "decor.farpalm.0": ps = ScenicPainter.DistantPalm(0); return true;
                case "decor.farpalm.1": ps = ScenicPainter.DistantPalm(1); return true;
                case "decor.cornerfronds": ps = ScenicPainter.CornerFronds(); return true;
                case "decor.cumulus.0": ps = ScenicPainter.Cumulus(1, 520f, 200f); return true;
                case "decor.cumulus.1": ps = ScenicPainter.Cumulus(2, 380f, 150f); return true;
                case "decor.cumulus.2": ps = ScenicPainter.Cumulus(7, 640f, 240f); return true;
                case "decor.cumulus.3": ps = ScenicPainter.Cumulus(8, 300f, 120f); return true;
                case "decor.wisps.0": ps = ScenicPainter.Wisps(4); return true;
                case "decor.wisps.1": ps = ScenicPainter.Wisps(12); return true;
                case "decor.surf.beach": ps = ScenicPainter.SurfLines(3, 2600f, 105f); return true;
                case "decor.surf.pier": ps = ScenicPainter.SurfLines(17, 2600f, 90f); return true;
                case "decor.reef": ps = ScenicPainter.ReefPatches(9, 2600f, 90f); return true;
                case "decor.sailboat.far": ps = ScenicPainter.SailboatFar(); return true;
                case "decor.backbeach": ps = ScenicPainter.BackBeach(5, 1200f, 36f, 260f); return true;
                case "decor.lifeguard": ps = ScenicPainter.LifeguardTower(); return true;
                case "decor.tent.blue": ps = ScenicPainter.DomeTent(Hex.C("#2F6FC8")); return true;
                case "decor.canopy.teal": ps = ScenicPainter.Canopy(Hex.C("#2BA58C")); return true;
                case "decor.people.0": ps = ScenicPainter.Beachgoer(0); return true;
                case "decor.people.1": ps = ScenicPainter.Beachgoer(1); return true;
                case "decor.people.2": ps = ScenicPainter.Beachgoer(2); return true;
                case "decor.people.3": ps = ScenicPainter.Beachgoer(3); return true;
                case "decor.palmshadow.0": ps = ScenicPainter.PalmShadow(1); return true;
                case "decor.palmshadow.1": ps = ScenicPainter.PalmShadow(2); return true;
                case "decor.kualoa": ps = ScenicPainter.KualoaRidge(5); return true;
                case "decor.coast": ps = ScenicPainter.CoastTrees(6, 1800f); return true;
                case "decor.lavarocks.0": ps = ScenicPainter.LavaRocks(3); return true;
                case "decor.lavarocks.1": ps = ScenicPainter.LavaRocks(8); return true;
                case "decor.lavarocks.face": ps = ScenicPainter.LavaRocks(21, false); return true;
                case "decor.grass": ps = ScenicPainter.GrassEdge(2, 900f); return true;
                case "decor.towel.0": ps = ScenicPainter.TowelSunbather(0); return true;
                case "decor.towel.1": ps = ScenicPainter.TowelSunbather(1); return true;
                case "decor.towel.2": ps = ScenicPainter.TowelSunbather(2); return true;
                case "decor.towel.3": ps = ScenicPainter.TowelSunbather(3); return true;
                case "decor.umbrella": ps = WorldPainter.Umbrella(); return true;
                case "decor.diamondhead": ps = WorldPainter.DiamondHead(); return true;
                case "decor.sailboat": ps = WorldPainter.Sailboat(); return true;
                case "decor.pier.plank": ps = WorldPainter.PierPlank(); return true;
                case "decor.pier.post": ps = WorldPainter.PierPost(); return true;
                case "decor.coral.0": ps = WorldPainter.Coral(0, Hex.C("#FF8FAB")); return true;
                case "decor.coral.1": ps = WorldPainter.Coral(1, Hex.C("#FFA94D")); return true;
                case "decor.coral.2": ps = WorldPainter.Coral(2, Hex.C("#B197FC")); return true;
                case "decor.coral.3": ps = WorldPainter.Coral(0, Hex.C("#FF6B6B")); return true;
                case "decor.seaweed": ps = WorldPainter.Seaweed(); return true;
                case "decor.starfish": ps = WorldPainter.Starfish(); return true;
                case "decor.shell": ps = WorldPainter.Shell(); return true;
                case "decor.rock.0": ps = WorldPainter.Rock(Hex.C("#868E96"), 0f); return true;
                case "decor.rock.1": ps = WorldPainter.Rock(Hex.C("#A69B8F"), 1f); return true;
                case "decor.lavarock.0": ps = WorldPainter.LavaRock(0f); return true;
                case "decor.lavarock.1": ps = WorldPainter.LavaRock(1f); return true;
                case "decor.fish": ps = WorldPainter.FishSilhouette(); return true;
                case "decor.volcano": ps = WorldPainter.Volcano(); return true;
                case "decor.cloud.0": ps = WorldPainter.CloudPuff(0); return true;
                case "decor.cloud.1": ps = WorldPainter.CloudPuff(1); return true;
                case "decor.cloudplatform": ps = WorldPainter.CloudPlatform(); return true;
                case "decor.island": ps = WorldPainter.FloatingIsland(); return true;
                case "decor.rainbow": ps = WorldPainter.Rainbow(); return true;

                case "fx.soft": ps = WorldPainter.SoftCircle(); return true;
                case "fx.circle": ps = WorldPainter.Circle(); return true;
                case "fx.ring": ps = WorldPainter.RingSprite(); return true;
                case "fx.drop": ps = WorldPainter.DropSprite(); return true;
                case "fx.spark": ps = WorldPainter.SparkSprite(); return true;
                case "fx.confetti": ps = WorldPainter.ConfettiSprite(); return true;
                case "fx.rain": ps = WorldPainter.RainStreak(); return true;
                case "fx.exclaim": ps = WorldPainter.Exclamation(); return true;
                case "fx.z": ps = WorldPainter.ZLetter(); return true;
                case "fx.heart": ps = WorldPainter.Heart(); return true;
                case "fx.shadow": ps = WorldPainter.Shadow(); return true;
                case "fx.reflection": ps = WorldPainter.Reflection(); return true;

                case "ui.round": ps = UIPainter.RoundRect(); return true;
                case "ui.outline": ps = UIPainter.RoundOutline(); return true;
                case "ui.pill": ps = UIPainter.Pill(); return true;
                case "ui.circle": ps = UIPainter.Circle(); return true;
                case "ui.shadow": ps = UIPainter.Shadow(); return true;
                case "ui.tail": ps = UIPainter.BubbleTail(); return true;
                case "ui.gradient": ps = UIPainter.GradientV(); return true;
                case "ui.coin": ps = UIPainter.Coin(); return true;
                case "ui.book": ps = UIPainter.Book(); return true;
                case "ui.bag": ps = UIPainter.Bag(); return true;
                case "ui.map": ps = UIPainter.Map(); return true;
                case "ui.gear": ps = UIPainter.Gear(); return true;
                case "ui.sun": ps = UIPainter.SunIcon(); return true;
                case "ui.sunset": ps = UIPainter.SunsetIcon(); return true;
                case "ui.moon": ps = UIPainter.MoonIcon(); return true;
                case "ui.rain": ps = UIPainter.RainIcon(); return true;
                case "ui.burst": ps = UIPainter.Burst(); return true;
                case "ui.lock": ps = UIPainter.Lock(); return true;
                case "ui.check": ps = UIPainter.Check(); return true;
                case "ui.star": ps = UIPainter.Star(); return true;
                case "ui.hand": ps = UIPainter.Hand(); return true;
                case "ui.vignette": ps = UIPainter.Vignette(); return true;
            }
            return false;
        }
    }
}
