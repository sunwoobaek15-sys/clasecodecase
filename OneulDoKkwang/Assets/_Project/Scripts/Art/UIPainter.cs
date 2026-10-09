using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>UI 용 스프라이트 (흰색 위주 → Image.color 로 색칠).</summary>
    public static class UIPainter
    {
        static readonly Color Ink = IconPainter.Ink;

        static PaintedSprite Ui(SdfCanvas cv, float border)
        {
            var ps = new PaintedSprite(cv, new Vector2(0.5f, 0.5f), 100f);
            ps.border = new Vector4(border, border, border, border);
            return ps;
        }

        public static PaintedSprite RoundRect()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            cv.Fill(Sd.Box(32, 32, 32, 32, 22), Color.white);
            return Ui(cv, 24);
        }

        public static PaintedSprite RoundOutline()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            cv.Fill(Sd.Subtract(Sd.Box(32, 32, 32, 32, 22), Sd.Box(32, 32, 27, 27, 17)), Color.white);
            return Ui(cv, 24);
        }

        public static PaintedSprite Pill()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            cv.Fill(Sd.Box(32, 32, 32, 32, 31), Color.white);
            return Ui(cv, 31);
        }

        public static PaintedSprite Circle()
        {
            var cv = new SdfCanvas(128, 128, 128f);
            cv.Fill(Sd.Circle(64, 64, 62), Color.white);
            return Ui(cv, 0);
        }

        public static PaintedSprite Shadow()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            cv.Glow(Sd.Box(32, 32, 14, 14, 8), new Color(0f, 0f, 0f, 1f), 16f);
            return Ui(cv, 30);
        }

        public static PaintedSprite BubbleTail()
        {
            var cv = new SdfCanvas(40, 30, 40f);
            cv.Fill(Sd.Poly(0, 31, 30, 31, 8, 0), Color.white);
            var ps = new PaintedSprite(cv, new Vector2(0.2f, 0f), 100f);
            return ps;
        }

        public static PaintedSprite GradientV()
        {
            var cv = new SdfCanvas(8, 128, 8f);
            cv.FillGradient(Sd.Box(4, 64, 4, 64), new Color(0.62f, 0.62f, 0.62f, 1f), Color.white, 0, 128);
            return Ui(cv, 0);
        }

        public static PaintedSprite Coin()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            cv.Fill(Sd.Circle(32, 32, 27), Ink, 2.5f);
            cv.Fill(Sd.Circle(32, 32, 27), Hex.C("#FFD43B"));
            cv.Fill(Sd.Ring(32, 32, 21, 2.4f), Hex.C("#F59F00"));
            cv.Fill(Sd.Star(32, 32, 11, 5, 5, 90f), Hex.C("#F59F00"));
            cv.Fill(Sd.Intersect(Sd.Circle(32, 32, 27), Sd.Ellipse(24, 44, 8, 4, 30)), new Color(1f, 1f, 1f, 0.6f));
            return Ui(cv, 0);
        }

        public static PaintedSprite Book()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var cover = Sd.Box(32, 32, 20, 25, 4);
            var pages = Sd.Box(36, 30, 16, 23, 2);
            cv.Sticker(Ink, 2.4f, new Part(pages, Color.white), new Part(Sd.Box(29, 33, 18, 24, 4), Hex.C("#2EC4B6")));
            cv.Fill(Sd.Box(14, 33, 2.6f, 24, 1), Hex.C("#1E8C82"));
            var fish = Sd.Union(Sd.Ellipse(31, 34, 8, 5), Sd.Poly(24, 34, 18, 39, 19, 29));
            cv.Fill(fish, Color.white);
            cv.Fill(Sd.Circle(35, 35.5f, 1.2f), Ink);
            return Ui(cv, 0);
        }

        public static PaintedSprite Bag()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var handle = Sd.Arc(32, 40, 10, 3.4f, 0f, 180f);
            var bag = Sd.Inflate(Sd.Poly(14, 42, 50, 42, 54, 8, 10, 8), 2f);
            cv.Sticker(Ink, 2.4f, new Part(handle, Hex.C("#E85D4A")), new Part(bag, Hex.C("#FF7B6B")));
            cv.Fill(Sd.Star(32, 24, 7, 3, 5, 90f), Color.white);
            return Ui(cv, 0);
        }

        public static PaintedSprite Map()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var map = Sd.Poly(8, 12, 24, 18, 40, 12, 56, 18, 56, 52, 40, 46, 24, 52, 8, 46);
            cv.Sticker(Ink, 2.4f, new Part(map, Hex.C("#FFE8A3")));
            cv.Fill(Sd.Capsule(24, 18, 24, 52, 1f), Hex.C("#E9C46A"));
            cv.Fill(Sd.Capsule(40, 12, 40, 46, 1f), Hex.C("#E9C46A"));
            cv.Fill(Sd.Path(1.2f, 1.2f, 12, 24, 20, 34, 30, 28, 36, 38), new Color(0.3f, 0.6f, 0.9f, 0.9f));
            var pin = Sd.Union(Sd.Circle(44, 38, 7), Sd.Poly(38, 35, 44, 22, 50, 35));
            cv.Sticker(Ink, 2f, new Part(pin, Hex.C("#E63946")));
            cv.Fill(Sd.Circle(44, 38, 2.6f), Color.white);
            return Ui(cv, 0);
        }

        public static PaintedSprite Gear()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var teeth = new Shape[9];
            for (int i = 0; i < 8; i++)
            {
                float a = i * 45f;
                teeth[i] = Sd.Box(32 + Mathf.Cos(a * Mathf.Deg2Rad) * 18, 32 + Mathf.Sin(a * Mathf.Deg2Rad) * 18, 5, 4.5f, 1.5f, a);
            }
            teeth[8] = Sd.Circle(32, 32, 18);
            var gear = Sd.Subtract(Sd.Union(teeth), Sd.Circle(32, 32, 7));
            cv.Sticker(Ink, 2.4f, new Part(gear, Hex.C("#ADB5BD")));
            return Ui(cv, 0);
        }

        public static PaintedSprite SunIcon()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            for (int i = 0; i < 8; i++)
            {
                float a = i * 45f * Mathf.Deg2Rad;
                cv.Fill(Sd.Capsule(32 + Mathf.Cos(a) * 18, 32 + Mathf.Sin(a) * 18, 32 + Mathf.Cos(a) * 26, 32 + Mathf.Sin(a) * 26, 2.6f), Hex.C("#FAB005"));
            }
            cv.Sticker(Ink, 2.2f, new Part(Sd.Circle(32, 32, 13), Hex.C("#FFD43B")));
            return Ui(cv, 0);
        }

        public static PaintedSprite SunsetIcon()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var sun = Sd.Intersect(Sd.Circle(32, 26, 16), Sd.HalfPlane(0, 26, 0, -1));
            cv.Sticker(Ink, 2.2f, new Part(sun, Hex.C("#FF922B")));
            cv.Fill(Sd.Capsule(8, 22, 56, 22, 2.2f), Hex.C("#F06595"));
            cv.Fill(Sd.Capsule(16, 15, 48, 15, 2f), Hex.C("#9775FA"));
            cv.Fill(Sd.Capsule(24, 8, 40, 8, 1.8f), Hex.C("#748FFC"));
            return Ui(cv, 0);
        }

        public static PaintedSprite MoonIcon()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var moon = Sd.Subtract(Sd.Circle(30, 32, 18), Sd.Circle(40, 40, 15));
            cv.Sticker(Ink, 2.2f, new Part(moon, Hex.C("#FFE066")));
            cv.Fill(Sd.Star(48, 18, 5, 1.6f, 4, 90f), Hex.C("#FFE066"));
            return Ui(cv, 0);
        }

        public static PaintedSprite RainIcon()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var cloud = Sd.Union(Sd.Circle(22, 36, 10), Sd.Circle(34, 42, 13), Sd.Circle(46, 36, 10), Sd.Box(34, 31, 16, 6, 5));
            for (int i = 0; i < 3; i++) cv.Fill(Sd.Capsule(20 + i * 12, 20, 16 + i * 12, 10, 2.2f), Hex.C("#4DABF7"));
            cv.Sticker(Ink, 2.2f, new Part(cloud, Hex.C("#CED4DA")));
            return Ui(cv, 0);
        }

        public static PaintedSprite Burst()
        {
            var cv = new SdfCanvas(256, 256, 256f);
            for (int i = 0; i < 16; i++)
            {
                float a0 = (i * 22.5f - 5f) * Mathf.Deg2Rad, a1 = (i * 22.5f + 5f) * Mathf.Deg2Rad;
                var ray = Sd.Poly(128, 128, 128 + Mathf.Cos(a0) * 128, 128 + Mathf.Sin(a0) * 128, 128 + Mathf.Cos(a1) * 128, 128 + Mathf.Sin(a1) * 128);
                cv.Fill(Sd.Intersect(ray, Sd.Circle(128, 128, 126)), new Color(1f, 1f, 1f, 0.9f));
            }
            cv.Glow(Sd.Circle(128, 128, 30), new Color(1f, 1f, 1f, 0.8f), 60f);
            return Ui(cv, 0);
        }

        public static PaintedSprite Vignette()
        {
            var cv = new SdfCanvas(128, 128, 128f);
            cv.PaintFunc((x, y) =>
            {
                float dx = (x - 64f) / 64f, dy = (y - 64f) / 64f;
                float d = Mathf.Sqrt(dx * dx + dy * dy) / 1.4142f;
                float a = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0.42f, 1f, d));
                return new Color(1f, 1f, 1f, a);
            });
            return Ui(cv, 0);
        }

        public static PaintedSprite Lock()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var shackle = Sd.Arc(32, 34, 11, 4.4f, 0f, 180f);
            var legs = Sd.Union(Sd.Capsule(21, 34, 21, 28, 2.2f), Sd.Capsule(43, 34, 43, 28, 2.2f));
            var body = Sd.Box(32, 22, 17, 13, 4);
            cv.Sticker(Ink, 2.4f, new Part(Sd.Union(shackle, legs), Hex.C("#ADB5BD")), new Part(body, Hex.C("#FAB005")));
            cv.Fill(Sd.Union(Sd.Circle(32, 24, 3.4f), Sd.Box(32, 18, 1.6f, 4)), Ink);
            return Ui(cv, 0);
        }

        public static PaintedSprite Check()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var check = Sd.Path(5f, 5f, 14, 34, 27, 20, 50, 46);
            cv.Fill(check, Ink, 2.4f);
            cv.Fill(check, Hex.C("#40C057"));
            return Ui(cv, 0);
        }

        public static PaintedSprite Star()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            cv.Sticker(Ink, 2.4f, new Part(Sd.Inflate(Sd.Star(32, 30, 24, 10, 5, 90f), 2f), Hex.C("#FFD43B")));
            return Ui(cv, 0);
        }

        public static PaintedSprite Hand()
        {
            var cv = new SdfCanvas(64, 64, 64f);
            var palm = Sd.Box(32, 22, 12, 12, 6);
            var finger = Sd.Capsule(26, 30, 26, 56, 5);
            var others = Sd.Union(Sd.Capsule(34, 30, 34, 38, 4.4f), Sd.Capsule(41, 28, 41, 35, 4.2f), Sd.Capsule(19, 26, 14, 34, 4f));
            cv.Sticker(Ink, 2.4f, new Part(others, Color.white), new Part(finger, Color.white), new Part(palm, Color.white));
            return Ui(cv, 0);
        }
    }
}
