using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>코드로 그린 스프라이트 한 장 + 피벗 + PPU.</summary>
    public struct PaintedSprite
    {
        public SdfCanvas canvas;
        /// <summary>0~1 정규화 피벗.</summary>
        public Vector2 pivot;
        public float pixelsPerUnit;
        /// <summary>9-slice 테두리 (px). UI용.</summary>
        public Vector4 border;

        public PaintedSprite(SdfCanvas canvas, Vector2 pivot, float ppu)
        {
            this.canvas = canvas;
            this.pivot = pivot;
            pixelsPerUnit = ppu;
            border = new Vector4(0, 0, 0, 0);
        }
    }

    /// <summary>
    /// 월드 스프라이트(캐릭터, 배경, 이펙트)를 코드로 그린다.
    /// 캐릭터 계열: 디자인 1단위 = 월드 0.016 (PPU 100, k = 1.6px/단위).
    /// </summary>
    public static class WorldPainter
    {
        static readonly Color Ink = IconPainter.Ink;
        static readonly Color Shine = new Color(1f, 1f, 1f, 0.35f);
        const float OL = 2.2f;

        // 주인공 파츠 기준점 (디자인 좌표, 몸통 스프라이트 기준)
        public const float CharDesignToWorld = 0.016f;
        public static readonly Vector2 PlayerHandDesign = new Vector2(82f, 68f);
        public static readonly Vector2 PlayerNeckDesign = new Vector2(50f, 89f);
        public const float PlayerBodyDesignW = 100f;
        public static readonly Vector2 CatTailBaseDesign = new Vector2(24f, 22f);

        static SdfCanvas NewCanvas(float designW, float designH, float pxPerUnit)
        {
            return new SdfCanvas(Mathf.Max(1, Mathf.RoundToInt(designW * pxPerUnit)), Mathf.Max(1, Mathf.RoundToInt(designH * pxPerUnit)), designW);
        }

        // ================================================================ player

        public static readonly Color Skin = Hex.C("#F2C29B");
        public static readonly Color Shirt = Hex.C("#FF6F59");
        public static readonly Color Shorts = Hex.C("#2A9D8F");

        public static PaintedSprite PlayerBody()
        {
            var cv = NewCanvas(100, 96, 1.6f);
            var sandal = Hex.C("#6B4F3A");
            var backArm = Sd.Capsule(36, 78, 31, 57, 5.4f, 5f);
            var legL = Sd.Capsule(43, 8, 43, 34, 6.2f);
            var legR = Sd.Capsule(57, 8, 57, 34, 6.2f);
            var sandL = Sd.Ellipse(42, 4.6f, 9, 3.6f);
            var sandR = Sd.Ellipse(60, 4.6f, 9, 3.6f);
            var shorts = Sd.Box(50, 40, 16.5f, 10, 4);
            var shirt = Sd.Box(50, 64, 19, 21, 8);
            var sleeveL = Sd.Ellipse(33, 79, 7.5f, 6.5f, 20);
            var sleeveR = Sd.Ellipse(67, 79, 7.5f, 6.5f, -20);
            var neck = Sd.Box(50, 88, 5, 5, 2);
            var frontArm = Sd.Capsule(67, 77, 80, 69, 5.5f, 5f);
            var hand = Sd.Circle(82, 68, 6.2f);
            cv.Sticker(Ink, OL,
                new Part(backArm, Skin), new Part(legL, Skin), new Part(legR, Skin), new Part(sandL, sandal), new Part(sandR, sandal),
                new Part(shorts, Shorts), new Part(neck, Skin), new Part(shirt, Shirt), new Part(sleeveL, Shirt), new Part(sleeveR, Shirt),
                new Part(frontArm, Skin), new Part(hand, Skin));
            // 반바지 줄무늬
            cv.Fill(Sd.Intersect(shorts, Sd.Box(50, 36, 17, 1.6f)), Shorts.Shade(1.3f));
            // 히비스커스 무늬
            float[] fx = { 40, 56, 46, 62, 38, 54 };
            float[] fy = { 74, 76, 62, 58, 50, 46 };
            var shirtAll = Sd.Union(shirt, sleeveL, sleeveR);
            for (int i = 0; i < fx.Length; i++)
            {
                var petal = i % 2 == 0 ? Color.white : Hex.C("#FFE066");
                for (int k = 0; k < 5; k++)
                {
                    float a = (90f + k * 72f + i * 17f) * Mathf.Deg2Rad;
                    cv.Fill(Sd.Intersect(shirtAll, Sd.Circle(fx[i] + Mathf.Cos(a) * 2.6f, fy[i] + Mathf.Sin(a) * 2.6f, 2.1f)), petal.WithAlpha(0.95f));
                }
                cv.Fill(Sd.Intersect(shirtAll, Sd.Circle(fx[i], fy[i], 1.2f)), Hex.C("#E8590C"));
            }
            cv.Fill(Sd.Intersect(shirt, Sd.Box(50, 64, 1.2f, 21)), Shirt.Shade(0.8f));
            // 레이 (꽃 목걸이)
            string[] lei = { "#FF6B9D", "#FFD43B", "#FFFFFF", "#FF6B9D", "#FFD43B", "#FFFFFF", "#FF6B9D" };
            for (int i = 0; i < lei.Length; i++)
            {
                float t = i / (float)(lei.Length - 1);
                float a = Mathf.Lerp(200f, 340f, t) * Mathf.Deg2Rad;
                float x = 50 + Mathf.Cos(a) * 12f, y = 88 + Mathf.Sin(a) * 9f;
                cv.Fill(Sd.Circle(x, y, 3f), Ink, 1f);
                cv.Fill(Sd.Circle(x, y, 3f), Hex.C(lei[i]));
            }
            cv.Fill(Sd.Intersect(shirt, Sd.Ellipse(42, 74, 6, 12, 10)), Shine);
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 100f);
        }

        public static PaintedSprite PlayerHead()
        {
            var cv = NewCanvas(64, 70, 1.6f);
            var hair = Sd.Circle(29, 32, 21);
            var face = Sd.Circle(33, 28, 19.5f);
            var ear = Sd.Circle(20, 27, 4.5f);
            var brim = Sd.Ellipse(32, 44, 31, 5.5f, -4);
            var dome = Sd.Intersect(Sd.Ellipse(31, 50, 17.5f, 13), Sd.HalfPlane(0, 44, 0, -1));
            var straw = Hex.C("#E9C46A");
            cv.Sticker(Ink, OL, new Part(hair, Hex.C("#3D2B1F")), new Part(face, Skin), new Part(ear, Skin), new Part(brim, straw), new Part(dome, straw));
            cv.Fill(Sd.Intersect(dome, Sd.Box(31, 47.5f, 18, 2.4f)), Hex.C("#E63946"));
            for (int i = 0; i < 5; i++) cv.Fill(Sd.Intersect(brim, Sd.Capsule(6 + i * 13, 41.5f, 12 + i * 13, 46.5f, 0.6f)), straw.Shade(0.8f));
            cv.Fill(Sd.Intersect(face, Sd.Circle(22, 24, 2f)), Skin.Shade(0.85f));
            cv.Fill(Sd.Intersect(dome, Sd.Ellipse(26, 54, 6, 3, 10)), Shine);
            return new PaintedSprite(cv, new Vector2(32f / 64f, 8f / 70f), 100f);
        }

        public enum Face { Open, Sleep, Surprised }

        public static PaintedSprite PlayerFace(Face face)
        {
            var cv = NewCanvas(64, 70, 1.6f);
            var blush = new Color(1f, 0.45f, 0.45f, 0.4f);
            cv.Fill(Sd.Ellipse(33, 22, 3.6f, 2.2f), blush);
            cv.Fill(Sd.Ellipse(50, 22, 3.6f, 2.2f), blush);
            switch (face)
            {
                case Face.Open:
                    cv.Fill(Sd.Ellipse(38, 30, 2.2f, 3f), Ink);
                    cv.Fill(Sd.Ellipse(47, 30, 2.2f, 3f), Ink);
                    cv.Fill(Sd.Circle(38.7f, 31.2f, 0.8f), Color.white);
                    cv.Fill(Sd.Circle(47.7f, 31.2f, 0.8f), Color.white);
                    cv.Fill(Sd.Arc(43, 23, 3.4f, 1.3f, 200f, 340f), Ink);
                    cv.Fill(Sd.Capsule(35, 36, 40, 36.5f, 0.8f), Hex.C("#3D2B1F"));
                    cv.Fill(Sd.Capsule(45, 36.5f, 50, 36, 0.8f), Hex.C("#3D2B1F"));
                    break;
                case Face.Sleep:
                    cv.Fill(Sd.Arc(38, 31, 2.6f, 1.2f, 200f, 340f), Ink);
                    cv.Fill(Sd.Arc(47, 31, 2.6f, 1.2f, 200f, 340f), Ink);
                    cv.Fill(Sd.Ellipse(43, 21, 1.8f, 2.2f), Ink);
                    cv.Fill(Sd.Union(Sd.Circle(47, 17, 1.4f), Sd.Poly(45.8f, 17.6f, 47, 20, 48.2f, 17.6f)), Hex.C("#A5D8FF"));
                    break;
                default:
                    cv.Fill(Sd.Circle(38, 30, 3.4f), Ink, 1f);
                    cv.Fill(Sd.Circle(47, 30, 3.4f), Ink, 1f);
                    cv.Fill(Sd.Circle(38, 30, 3.4f), Color.white);
                    cv.Fill(Sd.Circle(47, 30, 3.4f), Color.white);
                    cv.Fill(Sd.Circle(38.6f, 30, 1.4f), Ink);
                    cv.Fill(Sd.Circle(47.6f, 30, 1.4f), Ink);
                    cv.Fill(Sd.Ellipse(43, 20.5f, 2.6f, 3.4f), Ink);
                    cv.Fill(Sd.Capsule(35, 38, 40, 39, 0.8f), Hex.C("#3D2B1F"));
                    cv.Fill(Sd.Capsule(45, 39, 50, 38, 0.8f), Hex.C("#3D2B1F"));
                    break;
            }
            return new PaintedSprite(cv, new Vector2(32f / 64f, 8f / 70f), 100f);
        }

        /// <summary>낚싯대: 디자인 260 x 12 (월드 2.6). 피벗 = 손잡이 (x 30).</summary>
        public static PaintedSprite Rod(Color body, Color accent)
        {
            var cv = NewCanvas(260, 14, 2f);
            var rod = Sd.Capsule(6, 7, 256, 7, 2.6f, 1f);
            var grip = Sd.Capsule(4, 7, 40, 7, 3.8f);
            cv.Sticker(Ink, 1.2f, new Part(rod, body), new Part(grip, body.Shade(0.55f)));
            for (int i = 0; i < 4; i++) cv.Fill(Sd.Box(64 + i * 48, 7, 1.6f, 2.6f - i * 0.35f, 0.5f), accent);
            cv.Fill(Sd.Capsule(44, 8.2f, 250, 7.6f, 0.5f), Shine);
            return new PaintedSprite(cv, new Vector2(30f / 260f, 0.5f), 200f);
        }

        /// <summary>낚싯대 끝 (피벗 기준 로컬 x, 월드 단위).</summary>
        public const float RodTipLocalX = (256f - 30f) * 2f / 200f;

        public static PaintedSprite Reel(Color accent)
        {
            var cv = NewCanvas(20, 20, 2f);
            cv.Sticker(Ink, 1.2f, new Part(Sd.Circle(10, 10, 7), accent));
            cv.Fill(Sd.Circle(10, 10, 3.2f), accent.Shade(0.7f));
            cv.Fill(Sd.Capsule(10, 10, 15, 5, 1f), Ink);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 100f);
        }

        // ================================================================ cat

        public static readonly Color CatFur = Hex.C("#FFF1D6");
        public static readonly Color CatPatch = Hex.C("#F4A261");

        public static PaintedSprite CatBody()
        {
            var cv = NewCanvas(100, 100, 1.28f);
            var haunch = Sd.Ellipse(36, 24, 22, 17);
            var body = Sd.Ellipse(47, 34, 21, 25);
            var legA = Sd.Capsule(56, 7, 57, 26, 5.4f);
            var legB = Sd.Capsule(66, 7, 64, 24, 5.4f);
            var pawA = Sd.Ellipse(57, 5, 7, 4);
            var pawB = Sd.Ellipse(67, 5, 7, 4);
            var head = Sd.Circle(63, 63, 21);
            var earL = Sd.Poly(46, 76, 43, 96, 60, 84);
            var earR = Sd.Poly(67, 85, 81, 97, 82, 75);
            cv.Sticker(Ink, OL, new Part(haunch, CatFur), new Part(body, CatFur), new Part(legA, CatFur), new Part(legB, CatFur),
                new Part(pawA, CatFur), new Part(pawB, CatFur), new Part(earL, CatFur), new Part(earR, CatFur), new Part(head, CatFur));
            var pink = Hex.C("#FFB3C1");
            cv.Fill(Sd.Poly(48.5f, 79, 46.5f, 91, 56, 83.5f), pink);
            cv.Fill(Sd.Poly(69.5f, 85, 79, 92.5f, 79.5f, 78.5f), pink);
            cv.Fill(Sd.Intersect(head, Sd.Ellipse(52, 76, 14, 10, 20)), CatPatch);
            cv.Fill(Sd.Intersect(Sd.Union(body, haunch), Sd.Ellipse(30, 38, 14, 18, 20)), CatPatch);
            cv.Fill(Sd.Intersect(body, Sd.Ellipse(58, 34, 10, 15)), Color.white);
            cv.Fill(Sd.Capsule(54, 6, 54, 9, 0.6f), Ink);
            cv.Fill(Sd.Capsule(64, 6, 64, 9, 0.6f), Ink);
            // 화관
            string[] flowers = { "#FF6B9D", "#FFD43B", "#FFFFFF", "#FF6B9D", "#FFD43B", "#B197FC" };
            for (int i = 0; i < flowers.Length; i++)
            {
                float a = Mathf.Lerp(158f, 30f, i / (float)(flowers.Length - 1)) * Mathf.Deg2Rad;
                float x = 63 + Mathf.Cos(a) * 20.5f, y = 63 + Mathf.Sin(a) * 20.5f;
                if (i < flowers.Length - 1)
                {
                    float b = Mathf.Lerp(158f, 30f, (i + 0.5f) / (flowers.Length - 1)) * Mathf.Deg2Rad;
                    cv.Fill(Sd.Ellipse(63 + Mathf.Cos(b) * 21.5f, 63 + Mathf.Sin(b) * 21.5f, 3.2f, 1.8f, b * Mathf.Rad2Deg + 90f), Hex.C("#51CF66"));
                }
                var fc = Hex.C(flowers[i]);
                for (int k = 0; k < 5; k++)
                {
                    float pa = (90f + k * 72f) * Mathf.Deg2Rad;
                    cv.Fill(Sd.Circle(x + Mathf.Cos(pa) * 2.4f, y + Mathf.Sin(pa) * 2.4f, 2.2f), Ink, 0.8f);
                }
                for (int k = 0; k < 5; k++)
                {
                    float pa = (90f + k * 72f) * Mathf.Deg2Rad;
                    cv.Fill(Sd.Circle(x + Mathf.Cos(pa) * 2.4f, y + Mathf.Sin(pa) * 2.4f, 2.2f), fc);
                }
                cv.Fill(Sd.Circle(x, y, 1.3f), Hex.C("#F08C00"));
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 135f);
        }

        public enum CatFace { Open, Happy, Surprised, Sleep }

        public static PaintedSprite CatFaceSprite(CatFace face)
        {
            var cv = NewCanvas(100, 100, 1.28f);
            var blush = new Color(1f, 0.5f, 0.55f, 0.45f);
            cv.Fill(Sd.Ellipse(55, 56, 3.6f, 2.2f), blush);
            cv.Fill(Sd.Ellipse(77, 56, 3.4f, 2.2f), blush);
            switch (face)
            {
                case CatFace.Open:
                    cv.Fill(Sd.Ellipse(60, 64, 2.6f, 3.4f), Ink);
                    cv.Fill(Sd.Ellipse(72, 64, 2.6f, 3.4f), Ink);
                    cv.Fill(Sd.Circle(60.8f, 65.4f, 0.9f), Color.white);
                    cv.Fill(Sd.Circle(72.8f, 65.4f, 0.9f), Color.white);
                    break;
                case CatFace.Happy:
                    cv.Fill(Sd.Arc(60, 62, 3.2f, 1.4f, 20f, 160f), Ink);
                    cv.Fill(Sd.Arc(72, 62, 3.2f, 1.4f, 20f, 160f), Ink);
                    break;
                case CatFace.Surprised:
                    cv.Fill(Sd.Circle(60, 65, 4.6f), Ink, 1f);
                    cv.Fill(Sd.Circle(72, 65, 4.6f), Ink, 1f);
                    cv.Fill(Sd.Circle(60, 65, 4.6f), Color.white);
                    cv.Fill(Sd.Circle(72, 65, 4.6f), Color.white);
                    cv.Fill(Sd.Circle(60.5f, 65, 1.8f), Ink);
                    cv.Fill(Sd.Circle(72.5f, 65, 1.8f), Ink);
                    break;
                default:
                    cv.Fill(Sd.Arc(60, 65, 3f, 1.3f, 200f, 340f), Ink);
                    cv.Fill(Sd.Arc(72, 65, 3f, 1.3f, 200f, 340f), Ink);
                    break;
            }
            cv.Fill(Sd.Poly(64.5f, 59.5f, 68.5f, 59.5f, 66.5f, 57), Hex.C("#FF8FA3"));
            if (face == CatFace.Surprised)
            {
                cv.Fill(Sd.Ellipse(66.5f, 52.5f, 2f, 2.6f), Ink);
            }
            else
            {
                cv.Fill(Sd.Arc(64.5f, 56.5f, 2f, 1f, 200f, 340f), Ink);
                cv.Fill(Sd.Arc(68.5f, 56.5f, 2f, 1f, 200f, 340f), Ink);
            }
            var wh = Ink.WithAlpha(0.7f);
            cv.Fill(Sd.Capsule(76, 59, 86, 61, 0.45f), wh);
            cv.Fill(Sd.Capsule(76, 57, 86, 56, 0.45f), wh);
            cv.Fill(Sd.Capsule(56, 59, 47, 61, 0.45f), wh);
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 135f);
        }

        public static PaintedSprite CatTail()
        {
            var cv = NewCanvas(50, 70, 1.28f);
            var tail = Sd.Path(6f, 4.2f, 40, 8, 30, 18, 16, 30, 11, 46, 17, 60);
            cv.Sticker(Ink, OL, new Part(tail, CatFur));
            cv.Fill(Sd.Intersect(tail, Sd.Circle(17, 60, 8)), CatPatch);
            cv.Fill(Sd.Intersect(tail, Sd.Circle(14, 38, 4)), CatPatch);
            return new PaintedSprite(cv, new Vector2(40f / 50f, 8f / 70f), 135f);
        }

        // ================================================================ props

        public static PaintedSprite Bobber()
        {
            var cv = NewCanvas(40, 60, 2f);
            var antenna = Sd.Capsule(20, 44, 20, 57, 1.6f);
            var tip = Sd.Circle(20, 57, 2.6f);
            var bodyShape = Sd.Ellipse(20, 30, 12, 15);
            var stem = Sd.Capsule(20, 15, 20, 7, 1.4f);
            cv.Sticker(Ink, 1.8f, new Part(antenna, Hex.C("#495057")), new Part(stem, Hex.C("#495057")), new Part(tip, Hex.C("#FFD43B")), new Part(bodyShape, Color.white));
            cv.Fill(Sd.Intersect(bodyShape, Sd.HalfPlane(0, 30, 0, -1)), Hex.C("#E63946"));
            cv.Fill(Sd.Intersect(bodyShape, Sd.Box(20, 30, 13, 1.7f)), Ink);
            cv.Fill(Sd.Intersect(bodyShape, Sd.Ellipse(15, 37, 3.4f, 6, 10)), new Color(1f, 1f, 1f, 0.55f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 200f);
        }

        public static PaintedSprite Hook()
        {
            var cv = NewCanvas(20, 30, 2f);
            var silver = Hex.C("#CED4DA");
            var shank = Sd.Capsule(12, 27, 12, 10, 1.4f);
            var bend = Sd.Arc(8, 10, 4, 2.6f, 180f, 360f);
            var barb = Sd.Poly(3, 10, 6, 15, 5.6f, 9);
            var eye = Sd.Ring(12, 27, 1.8f, 1.2f);
            cv.Sticker(Ink, 1f, new Part(shank, silver), new Part(bend, silver), new Part(barb, silver), new Part(eye, silver));
            return new PaintedSprite(cv, new Vector2(12f / 20f, 28f / 30f), 200f);
        }

        public static PaintedSprite Bucket()
        {
            var cv = NewCanvas(100, 90, 1.33f);
            var blue = Hex.C("#4DABF7");
            var handle = Sd.Arc(50, 68, 30, 2.6f, 15f, 165f);
            var body = Sd.Inflate(Sd.Poly(19, 70, 81, 70, 73, 8, 27, 8), 3f);
            var rim = Sd.Box(50, 72, 34, 4, 3);
            cv.Sticker(Ink, OL, new Part(handle, Hex.C("#868E96")), new Part(body, blue), new Part(rim, blue.Shade(1.3f)));
            cv.Fill(Sd.Ellipse(50, 72.5f, 29, 2.6f), Hex.C("#1C7ED6"));
            cv.Fill(Sd.Intersect(body, Sd.Box(50, 44, 40, 2.2f)), blue.Shade(0.8f));
            cv.Fill(Sd.Intersect(body, Sd.Box(50, 24, 40, 2.2f)), blue.Shade(0.8f));
            cv.Fill(Sd.Intersect(body, Sd.Box(32, 40, 3, 26, 2)), Shine);
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 177f);
        }

        /// <summary>양동이 테두리 높이 (월드 단위, 피벗 기준).</summary>
        public const float BucketRimHeight = 72f * 1.33f / 177f;

        // ================================================================ beach decor

        public static PaintedSprite PalmTree(float variant)
        {
            var cv = NewCanvas(170, 260, 1.2f);
            var trunkColor = Hex.C("#A47148");
            var leaf = Hex.C("#2F9E44");
            float lean = Mathf.Lerp(-1f, 1f, variant);
            var trunk = Sd.Path(10f, 6f, 85, 0, 87 + 4 * lean, 60, 92 + 10 * lean, 120, 100 + 18 * lean, 176, 106 + 24 * lean, 214);
            cv.Sticker(Ink, OL, new Part(trunk, trunkColor));
            for (int i = 0; i < 9; i++)
            {
                float y = 18 + i * 22f;
                float x = 85 + Mathf.Lerp(0, 22 * lean, y / 214f) + (y > 100 ? 4 * lean : 0);
                cv.Fill(Sd.Intersect(trunk, Sd.Arc(x, y + 4, 11, 1.8f, 200f, 340f)), trunkColor.Shade(0.72f));
            }
            float cx = 106 + 24 * lean, cy = 216;
            float[] ang = { 172f, 145f, 115f, 85f, 55f, 25f, -2f };
            float[] len = { 72f, 78f, 70f, 64f, 70f, 78f, 70f };
            var fronds = new Part[ang.Length];
            for (int i = 0; i < ang.Length; i++)
            {
                float a = ang[i] * Mathf.Deg2Rad;
                float ex = cx + Mathf.Cos(a) * len[i];
                float ey = cy + Mathf.Sin(a) * len[i] * 0.55f - 26f;
                float mx = cx + Mathf.Cos(a) * len[i] * 0.55f;
                float my = cy + Mathf.Sin(a) * len[i] * 0.55f + 10f;
                fronds[i] = new Part(Sd.Path(9f, 1.5f, cx, cy, mx, my, ex, ey), i % 2 == 0 ? leaf : leaf.Shade(0.85f));
            }
            cv.Sticker(Ink, OL, fronds);
            for (int i = 0; i < ang.Length; i++)
            {
                float a = ang[i] * Mathf.Deg2Rad;
                float ex = cx + Mathf.Cos(a) * len[i];
                float ey = cy + Mathf.Sin(a) * len[i] * 0.55f - 26f;
                float mx = cx + Mathf.Cos(a) * len[i] * 0.55f;
                float my = cy + Mathf.Sin(a) * len[i] * 0.55f + 10f;
                cv.Fill(Sd.Path(1.2f, 0.4f, cx, cy, mx, my, ex, ey), leaf.Shade(0.65f));
            }
            var nut = Hex.C("#6F4E37");
            cv.Sticker(Ink, OL, new Part(Sd.Circle(cx - 6, cy - 8, 7), nut), new Part(Sd.Circle(cx + 6, cy - 9, 7), nut), new Part(Sd.Circle(cx, cy - 15, 6.5f), nut));
            return new PaintedSprite(cv, new Vector2(85f / 170f, 0f), 64f);
        }

        public static PaintedSprite Surfboard(Color main, Color stripe)
        {
            var cv = NewCanvas(30, 100, 1.2f);
            var board = Sd.Ellipse(15, 50, 12, 47);
            cv.Sticker(Ink, OL, new Part(board, main));
            cv.Fill(Sd.Intersect(board, Sd.Box(15, 50, 2.6f, 50)), stripe);
            cv.Fill(Sd.Intersect(board, Sd.Ellipse(10, 70, 3, 18)), Shine);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.08f), 60f);
        }

        public static PaintedSprite Umbrella()
        {
            var cv = NewCanvas(160, 150, 0.9f);
            var pole = Sd.Capsule(80, 0, 80, 118, 2.6f);
            var canopy = Sd.Intersect(Sd.Ellipse(80, 112, 72, 36), Sd.HalfPlane(0, 108, 0, -1));
            cv.Sticker(Ink, OL, new Part(pole, Hex.C("#E9ECEF")), new Part(canopy, Color.white));
            for (int i = 0; i < 6; i++)
            {
                if (i % 2 == 1) continue;
                float a0 = (180f - i * 30f) * Mathf.Deg2Rad, a1 = (180f - (i + 1) * 30f) * Mathf.Deg2Rad;
                var wedge = Sd.Poly(80, 108, 80 + Mathf.Cos(a0) * 120, 108 + Mathf.Sin(a0) * 120, 80 + Mathf.Cos(a1) * 120, 108 + Mathf.Sin(a1) * 120);
                cv.Fill(Sd.Intersect(canopy, wedge), Hex.C("#FF6B6B"));
            }
            cv.Fill(Sd.Circle(80, 146, 3.4f), Hex.C("#FF6B6B"), 1.4f);
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 50f);
        }

        public static PaintedSprite DiamondHead()
        {
            var cv = NewCanvas(400, 100, 2f);
            var hill = Sd.Poly(0, 0, 40, 18, 90, 44, 140, 66, 180, 80, 214, 86, 236, 83, 262, 77, 292, 62, 330, 38, 372, 16, 400, 0);
            cv.FillGradient(hill, Hex.C("#5E8C61"), Hex.C("#A3C9A0"), 0, 86);
            for (int i = 0; i < 7; i++)
            {
                float x = 120 + i * 30f;
                cv.Fill(Sd.Intersect(hill, Sd.Poly(x, 90, x + 6, 90, x - 14, 0, x - 24, 0)), new Color(0.25f, 0.4f, 0.27f, 0.25f));
            }
            cv.Fill(Sd.Intersect(hill, Sd.Ellipse(226, 88, 30, 6)), new Color(0.3f, 0.45f, 0.3f, 0.5f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 2f * 400f / 9f);
        }

        public static PaintedSprite HulaDancer()
        {
            var cv = NewCanvas(70, 120, 1.4f);
            var skin = Hex.C("#C68B59");
            var hairC = Hex.C("#2B1D16");
            var hairBack = Sd.Path(9f, 5f, 34, 100, 30, 80, 32, 64);
            var legL = Sd.Capsule(30, 6, 31, 34, 4.6f);
            var legR = Sd.Capsule(40, 6, 39, 34, 4.6f);
            var torso = Sd.Box(35, 60, 10, 15, 6);
            var armL = Sd.Path(3.6f, 3.2f, 27, 70, 14, 74, 6, 66);
            var armR = Sd.Path(3.6f, 3.2f, 43, 70, 56, 74, 64, 66);
            var head = Sd.Circle(36, 92, 11);
            cv.Sticker(Ink, 1.8f, new Part(hairBack, hairC), new Part(legL, skin), new Part(legR, skin), new Part(armL, skin), new Part(armR, skin),
                new Part(torso, skin), new Part(head, skin));
            cv.Fill(Sd.Intersect(Sd.Circle(35, 95, 12), Sd.HalfPlane(0, 94, 0, -1)), hairC);
            cv.Fill(Sd.Box(35, 64, 10.5f, 4, 2), Hex.C("#FF6B9D"));
            for (int i = 0; i < 9; i++)
            {
                float x = 23 + i * 3f;
                cv.Fill(Sd.Box(x, 36, 1.6f, 13, 0.8f, (i - 4) * 3f), i % 2 == 0 ? Hex.C("#82C91E") : Hex.C("#FAB005"), 1f);
            }
            for (int i = 0; i < 9; i++)
            {
                float x = 23 + i * 3f;
                cv.Fill(Sd.Box(x, 36, 1.6f, 13, 0.8f, (i - 4) * 3f), i % 2 == 0 ? Hex.C("#82C91E") : Hex.C("#FAB005"));
            }
            cv.Fill(Sd.Circle(44, 98, 4.2f), Hex.C("#FF6B9D"));
            cv.Fill(Sd.Circle(44, 98, 1.6f), Hex.C("#FFD43B"));
            cv.Fill(Sd.Arc(36, 74, 9, 3f, 200f, 340f), Hex.C("#FFD43B"));
            cv.Fill(Sd.Arc(39, 90, 2f, 1f, 20f, 160f), Ink);
            cv.Fill(Sd.Arc(33, 90, 2f, 1f, 20f, 160f), Ink);
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 100f);
        }

        public static PaintedSprite Sailboat()
        {
            var cv = NewCanvas(60, 60, 1.6f);
            var hull = Sd.Poly(6, 14, 54, 14, 46, 4, 14, 4);
            var mast = Sd.Capsule(30, 14, 30, 56, 1.2f);
            var sail = Sd.Poly(32, 54, 32, 18, 52, 18);
            var sail2 = Sd.Poly(28, 50, 28, 18, 12, 18);
            cv.Sticker(Ink, 1.6f, new Part(mast, Hex.C("#868E96")), new Part(sail, Color.white), new Part(sail2, Hex.C("#FFE3E3")), new Part(hull, Hex.C("#FF8787")));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.05f), 90f);
        }

        // ================================================================ pier / reef

        public static PaintedSprite PierPlank()
        {
            var cv = NewCanvas(200, 26, 1f);
            var wood = Hex.C("#B07D4F");
            var plank = Sd.Box(100, 15, 100, 10, 2);
            cv.Fill(plank, Ink, 1.4f);
            cv.Fill(plank, wood);
            for (int i = 1; i < 8; i++) cv.Fill(Sd.Box(i * 25f, 15, 0.8f, 9.5f), wood.Shade(0.7f));
            cv.Fill(Sd.Intersect(plank, Sd.Box(100, 23, 100, 2)), wood.Shade(1.25f));
            cv.Fill(Sd.Box(100, 3, 100, 3), Ink.WithAlpha(0.25f));
            return new PaintedSprite(cv, new Vector2(0.5f, 1f), 100f);
        }

        public static PaintedSprite PierPost()
        {
            var cv = NewCanvas(24, 300, 1f);
            var wood = Hex.C("#7B5134");
            var post = Sd.Box(12, 150, 9, 149, 3);
            cv.Fill(post, Ink, 1.2f);
            cv.FillGradient(post, Hex.C("#4F6B3A"), wood, 0, 170);
            cv.Fill(Sd.Box(12, 286, 10, 3, 1.5f), Hex.C("#E9C46A"));
            cv.Fill(Sd.Box(12, 278, 10, 2, 1), Hex.C("#E9C46A"));
            cv.Fill(Sd.Intersect(post, Sd.Box(8, 150, 2, 150)), Shine);
            return new PaintedSprite(cv, new Vector2(0.5f, 1f), 100f);
        }

        public static PaintedSprite Coral(int kind, Color c)
        {
            var cv = NewCanvas(80, 80, 1.2f);
            switch (kind % 3)
            {
                case 0:
                {
                    var branch = Sd.Union(
                        Sd.Path(5f, 3f, 40, 0, 38, 30, 30, 50, 22, 66),
                        Sd.Path(4f, 2.6f, 38, 28, 50, 46, 56, 64),
                        Sd.Path(3.4f, 2.2f, 31, 48, 40, 62, 38, 74),
                        Sd.Path(3.4f, 2.2f, 49, 44, 62, 50, 70, 58),
                        Sd.Path(3f, 2f, 24, 62, 14, 66));
                    cv.Sticker(Ink, 1.8f, new Part(branch, c));
                    cv.Fill(Sd.Intersect(branch, Sd.Move(branch, -1.5f, -1.5f)), c.Shade(1.2f));
                    break;
                }
                case 1:
                {
                    var brain = Sd.Intersect(Sd.Ellipse(40, 4, 34, 30), Sd.HalfPlane(0, 2, 0, -1));
                    cv.Sticker(Ink, 1.8f, new Part(brain, c));
                    for (int i = 0; i < 4; i++)
                        cv.Fill(Sd.Intersect(brain, Sd.Path(1.2f, 1.2f, 12 + i * 4f, 6 + i * 6f, 24, 10 + i * 6f, 34, 6 + i * 6f, 46, 11 + i * 6f, 58, 7 + i * 6f, 70 - i * 4f, 10 + i * 6f)), c.Shade(0.75f));
                    break;
                }
                default:
                {
                    var fan = Sd.Intersect(Sd.Circle(40, 10, 34), Sd.HalfPlane(0, 12, 0, -1));
                    var stalk = Sd.Capsule(40, 0, 40, 14, 3f);
                    cv.Sticker(Ink, 1.8f, new Part(stalk, c.Shade(0.7f)), new Part(fan, c));
                    for (int i = 0; i < 7; i++)
                    {
                        float a = Mathf.Lerp(20f, 160f, i / 6f) * Mathf.Deg2Rad;
                        cv.Fill(Sd.Intersect(fan, Sd.Capsule(40, 12, 40 + Mathf.Cos(a) * 34, 12 + Mathf.Sin(a) * 34, 0.8f)), c.Shade(0.7f));
                    }
                    cv.Fill(Sd.Intersect(fan, Sd.Ring(40, 12, 22, 1.4f)), c.Shade(0.7f));
                    break;
                }
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 80f);
        }

        public static PaintedSprite Seaweed()
        {
            var cv = NewCanvas(30, 120, 1f);
            var w = Sd.Path(5f, 2f, 15, 0, 10, 30, 19, 60, 11, 90, 17, 116);
            cv.Fill(w, Hex.C("#2B8A3E"));
            cv.Fill(Sd.Intersect(w, Sd.Move(w, -2, 0)), Hex.C("#51CF66"));
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 80f);
        }

        public static PaintedSprite Starfish()
        {
            var cv = NewCanvas(40, 40, 1.6f);
            var star = Sd.Inflate(Sd.Star(20, 20, 16, 7, 5, 90f), 1.5f);
            cv.Sticker(Ink, 1.6f, new Part(star, Hex.C("#FF922B")));
            for (int i = 0; i < 5; i++)
            {
                float a = (90f + i * 72f) * Mathf.Deg2Rad;
                cv.Fill(Sd.Circle(20 + Mathf.Cos(a) * 8, 20 + Mathf.Sin(a) * 8, 1.4f), Hex.C("#FFD8A8"));
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 0.3f), 140f);
        }

        public static PaintedSprite Shell()
        {
            var cv = NewCanvas(40, 36, 1.6f);
            var fan = Sd.Union(Sd.Intersect(Sd.Circle(20, 8, 18), Sd.HalfPlane(0, 8, 0, -1)), Sd.Box(20, 6, 5, 4, 1));
            cv.Sticker(Ink, 1.6f, new Part(fan, Hex.C("#FFC9C9")));
            for (int i = 0; i < 5; i++)
            {
                float a = Mathf.Lerp(35f, 145f, i / 4f) * Mathf.Deg2Rad;
                cv.Fill(Sd.Intersect(fan, Sd.Capsule(20, 8, 20 + Mathf.Cos(a) * 18, 8 + Mathf.Sin(a) * 18, 0.7f)), Hex.C("#FA5252").WithAlpha(0.6f));
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 0.1f), 140f);
        }

        public static PaintedSprite Rock(Color c, float variant)
        {
            var cv = NewCanvas(80, 50, 1.2f);
            var rock = Sd.Union(Sd.Ellipse(36, 14, 30 + variant * 6, 16), Sd.Ellipse(50, 22, 18, 14 + variant * 6, 20));
            var ground = Sd.Intersect(rock, Sd.HalfPlane(0, 2, 0, -1));
            cv.Sticker(Ink, 1.8f, new Part(ground, c));
            cv.Fill(Sd.Intersect(ground, Sd.Move(ground, 3, -4)), c.Shade(0.8f));
            cv.Fill(Sd.Intersect(ground, Sd.Ellipse(36, 26, 12, 3, 10)), Shine);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.04f), 80f);
        }

        /// <summary>배경에서 헤엄치는 물고기 실루엣 (흰색 → 코드에서 색 지정).</summary>
        public static PaintedSprite FishSilhouette()
        {
            var cv = NewCanvas(60, 30, 1.6f);
            var f = Sd.Union(Sd.Ellipse(34, 15, 18, 9), Sd.Poly(18, 15, 4, 25, 7, 15, 4, 5));
            cv.Fill(f, Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 100f);
        }

        // ================================================================ volcano

        public static PaintedSprite Volcano()
        {
            var cv = NewCanvas(400, 225, 2f);
            var mountain = Sd.Poly(0, 0, 110, 110, 158, 168, 174, 180, 226, 180, 242, 168, 290, 110, 400, 0);
            cv.FillGradient(mountain, Hex.C("#2E1B19"), Hex.C("#5A3A33"), 0, 180);
            for (int i = 0; i < 6; i++)
            {
                float x = 120 + i * 32f;
                cv.Fill(Sd.Intersect(mountain, Sd.Poly(x, 180, x + 8, 180, x - 30 + i * 8, 0, x - 44 + i * 8, 0)), new Color(0f, 0f, 0f, 0.18f));
            }
            var crater = Sd.Ellipse(200, 180, 27, 5);
            cv.Glow(crater, new Color(1f, 0.5f, 0.1f, 0.7f), 18f);
            cv.Fill(crater, Hex.C("#FF8C1A"));
            var lava1 = Sd.Path(3f, 6f, 194, 178, 186, 150, 196, 118, 182, 80, 190, 44, 176, 0);
            var lava2 = Sd.Path(2.4f, 4.6f, 212, 176, 222, 146, 214, 110, 232, 70, 240, 30);
            cv.Glow(Sd.Union(lava1, lava2), new Color(1f, 0.45f, 0.05f, 0.5f), 10f);
            cv.Fill(lava1, Hex.C("#FF6B1A"));
            cv.Fill(lava2, Hex.C("#FF6B1A"));
            cv.Fill(Sd.Path(1.2f, 2.4f, 194, 176, 187, 150, 196, 118, 183, 80), Hex.C("#FFD43B"));
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 2f * 400f / 10f);
        }

        public static PaintedSprite LavaRock(float variant)
        {
            var cv = NewCanvas(80, 50, 1.2f);
            var rock = Sd.Intersect(Sd.Union(Sd.Ellipse(36, 12, 30, 15 + variant * 5), Sd.Ellipse(52, 18, 16, 12 + variant * 6, 25)), Sd.HalfPlane(0, 2, 0, -1));
            cv.Sticker(Ink, 1.6f, new Part(rock, Hex.C("#343A40")));
            cv.Fill(Sd.Intersect(rock, Sd.Path(0.9f, 0.6f, 20, 6, 28, 12, 34, 9, 42, 16)), Hex.C("#FF8C1A"));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.04f), 80f);
        }

        // ================================================================ sky

        public static PaintedSprite CloudPuff(int variant)
        {
            var cv = NewCanvas(200, 110, 1f);
            Shape cloud;
            if (variant % 2 == 0)
                cloud = Sd.Union(Sd.Circle(50, 40, 32), Sd.Circle(92, 58, 42), Sd.Circle(140, 46, 34), Sd.Circle(170, 34, 22), Sd.Box(104, 24, 82, 20, 18));
            else
                cloud = Sd.Union(Sd.Circle(60, 44, 30), Sd.Circle(104, 54, 36), Sd.Circle(146, 38, 26), Sd.Box(102, 24, 70, 18, 16));
            cv.Fill(cloud, Color.white);
            cv.Fill(Sd.Intersect(cloud, Sd.HalfPlane(0, 26, 0, 1)), new Color(0.82f, 0.86f, 0.95f, 0.45f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.1f), 60f);
        }

        public static PaintedSprite CloudPlatform()
        {
            var cv = NewCanvas(600, 170, 0.8f);
            var parts = new Shape[16];
            for (int i = 0; i < 14; i++)
            {
                float x = 20 + i * 42f;
                float r = 34 + (i * 37 % 13);
                parts[i] = Sd.Circle(x, 118 - (i % 3) * 5, r);
            }
            parts[14] = Sd.Box(300, 70, 300, 50, 40);
            parts[15] = Sd.Circle(560, 90, 48);
            var cloud = Sd.Union(parts);
            cv.Fill(cloud, Hex.C("#DDE3F7"), 2.5f);
            cv.Fill(cloud, Color.white);
            cv.Fill(Sd.Intersect(cloud, Sd.HalfPlane(0, 60, 0, 1)), new Color(0.84f, 0.86f, 0.98f, 0.6f));
            return new PaintedSprite(cv, new Vector2(0.5f, 150f / 170f), 600f * 0.8f / 9f);
        }

        public static PaintedSprite FloatingIsland()
        {
            var cv = NewCanvas(160, 160, 1f);
            var rock = Sd.Inflate(Sd.Poly(20, 96, 140, 96, 96, 20, 70, 10), 4f);
            var grass = Sd.Ellipse(80, 98, 64, 12);
            var trunk = Sd.Path(4f, 3f, 92, 100, 96, 128, 102, 146);
            cv.Sticker(Ink, 2f, new Part(rock, Hex.C("#8D6E63")), new Part(grass, Hex.C("#69DB7C")), new Part(trunk, Hex.C("#A47148")));
            cv.Fill(Sd.Intersect(rock, Sd.Move(rock, 4, -6)), Hex.C("#6D4C41"));
            for (int i = 0; i < 5; i++)
            {
                float a = (20f + i * 35f) * Mathf.Deg2Rad;
                cv.Fill(Sd.Ellipse(102 + Mathf.Cos(a) * 12, 146 + Mathf.Sin(a) * 5, 14, 4, a * Mathf.Rad2Deg - 90f + 90f), Hex.C("#2F9E44"));
            }
            cv.Fill(Sd.Path(2.4f, 1f, 40, 96, 38, 70, 40, 40), new Color(0.65f, 0.85f, 1f, 0.8f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 60f);
        }

        public static PaintedSprite Rainbow()
        {
            var cv = NewCanvas(400, 200, 0.6f);
            string[] cols = { "#FF6B6B", "#FFA94D", "#FFE066", "#69DB7C", "#4DABF7", "#748FFC", "#B197FC" };
            for (int i = 0; i < cols.Length; i++)
                cv.Fill(Sd.Intersect(Sd.Ring(200, 0, 190 - i * 9f, 9.5f), Sd.HalfPlane(0, 0, 0, -1)), Hex.C(cols[i], 0.6f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 400f * 0.6f / 12f);
        }

        public static PaintedSprite Sun()
        {
            var cv = NewCanvas(100, 100, 2f);
            cv.Glow(Sd.Circle(50, 50, 22), new Color(1f, 1f, 1f, 0.45f), 27f);
            cv.Fill(Sd.Circle(50, 50, 22), Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 125f);
        }

        public static PaintedSprite Moon()
        {
            var cv = NewCanvas(100, 100, 2f);
            var moon = Sd.Subtract(Sd.Circle(50, 50, 20), Sd.Circle(60, 57, 17));
            cv.Glow(Sd.Circle(50, 50, 18), new Color(1f, 1f, 1f, 0.25f), 26f);
            cv.Fill(moon, Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 125f);
        }

        // ================================================================ fx

        public static PaintedSprite SoftCircle()
        {
            var cv = NewCanvas(64, 64, 1f);
            cv.Glow(Sd.Circle(32, 32, 4), Color.white, 28f);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 64f);
        }

        public static PaintedSprite Circle()
        {
            var cv = NewCanvas(64, 64, 1f);
            cv.Fill(Sd.Circle(32, 32, 30), Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 64f);
        }

        public static PaintedSprite RingSprite()
        {
            var cv = NewCanvas(64, 64, 1f);
            cv.Fill(Sd.Ring(32, 32, 28, 3.2f), Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 64f);
        }

        public static PaintedSprite DropSprite()
        {
            var cv = NewCanvas(20, 30, 1.6f);
            cv.Fill(Sd.Union(Sd.Circle(10, 10, 7), Sd.Poly(4, 13, 10, 28, 16, 13)), Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.35f), 160f);
        }

        public static PaintedSprite SparkSprite()
        {
            var cv = NewCanvas(32, 32, 2f);
            cv.Glow(Sd.Circle(16, 16, 2), new Color(1f, 1f, 1f, 0.5f), 8f);
            cv.Fill(Sd.Star(16, 16, 14, 3.4f, 4, 90f), Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 200f);
        }

        public static PaintedSprite ConfettiSprite()
        {
            var cv = NewCanvas(16, 10, 2f);
            cv.Fill(Sd.Box(8, 5, 7, 4, 1), Color.white);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 200f);
        }

        public static PaintedSprite RainStreak()
        {
            var cv = NewCanvas(6, 80, 1f);
            cv.Fill(Sd.Capsule(3, 4, 3, 76, 1.1f, 0.6f), new Color(1f, 1f, 1f, 0.85f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 100f);
        }

        public static PaintedSprite Exclamation()
        {
            var cv = NewCanvas(60, 70, 2f);
            var bubble = Sd.Union(Sd.Circle(30, 40, 24), Sd.Poly(22, 20, 30, 4, 36, 20));
            cv.Sticker(Ink, 2.6f, new Part(bubble, Hex.C("#FFD43B")));
            cv.Fill(Sd.Capsule(30, 52, 30, 37, 4.2f, 3.2f), Ink);
            cv.Fill(Sd.Circle(30, 27, 3.8f), Ink);
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), 160f);
        }

        public static PaintedSprite ZLetter()
        {
            var cv = NewCanvas(30, 30, 2f);
            var z = Sd.Poly(4, 26, 26, 26, 26, 21, 11, 9, 26, 9, 26, 4, 4, 4, 4, 9, 19, 21, 4, 21);
            cv.Sticker(Ink, 1.6f, new Part(z, Color.white));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 150f);
        }

        public static PaintedSprite Heart()
        {
            var cv = NewCanvas(40, 36, 2f);
            var h = Sd.Union(Sd.Circle(13, 22, 9), Sd.Circle(27, 22, 9), Sd.Poly(5.5f, 18, 34.5f, 18, 20, 3));
            cv.Sticker(Ink, 1.6f, new Part(h, Hex.C("#FF6B9D")));
            cv.Fill(Sd.Circle(11, 25, 2.4f), new Color(1f, 1f, 1f, 0.6f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 160f);
        }

        public static PaintedSprite Shadow()
        {
            var cv = NewCanvas(100, 30, 1f);
            cv.Glow(Sd.Ellipse(50, 15, 36, 6), new Color(0f, 0f, 0f, 0.35f), 10f);
            cv.Fill(Sd.Ellipse(50, 15, 36, 6), new Color(0f, 0f, 0f, 0.35f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 100f);
        }

        public static PaintedSprite Reflection()
        {
            var cv = NewCanvas(60, 200, 0.6f);
            cv.Glow(Sd.Ellipse(30, 100, 6, 80), new Color(1f, 1f, 1f, 0.7f), 22f);
            return new PaintedSprite(cv, new Vector2(0.5f, 1f), 30f);
        }
    }
}
