using System;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 도감/결과 카드용 아이콘을 코드로 그린다 (디자인 공간 100 x 100, y 위쪽 +).
    /// 진짜 아트가 생기면 CatchData.icon 에 스프라이트를 넣으면 이 코드는 쓰이지 않는다.
    /// </summary>
    public static class IconPainter
    {
        public static readonly Color Ink = Hex.C("#2B2235");
        static readonly Color White = Color.white;
        static readonly Color Shine = new Color(1f, 1f, 1f, 0.38f);
        const float OL = 2.6f;

        public static SdfCanvas PaintCatch(IconStyle st, int size)
        {
            var cv = new SdfCanvas(size, size, 100f);
            switch (st.shape)
            {
                case IconShape.Fish: Fish(cv, st.primary, st.secondary, st.accent, st.variant); break;
                case IconShape.TropicalFish: Tropical(cv, st); break;
                case IconShape.Tuna: Tuna(cv, st); break;
                case IconShape.Puffer: Puffer(cv, st); break;
                case IconShape.Sunfish: Sunfish(cv, st); break;
                case IconShape.Eel: Eel(cv, st); break;
                case IconShape.Seahorse: Seahorse(cv, st); break;
                case IconShape.Turtle: Turtle(cv, st); break;
                case IconShape.Jellyfish: Jellyfish(cv, st); break;
                case IconShape.Shark: Shark(cv, st); break;
                case IconShape.Boot: Boot(cv, st); break;
                case IconShape.Bungeoppang: Bungeoppang(cv, st); break;
                case IconShape.Rock: Rock(cv, st); break;
                case IconShape.Document: Document(cv, st); break;
                case IconShape.Router: Router(cv, st); break;
                case IconShape.Pineapple: Pineapple(cv, st); break;
                case IconShape.Pizza: Pizza(cv, st); break;
                case IconShape.Octopus: Octopus(cv, st); break;
                case IconShape.Coconut: Coconut(cv, st); break;
                case IconShape.Squid: Squid(cv, st); break;
                case IconShape.Sheep: Sheep(cv, st); break;
                case IconShape.Parcel: Parcel(cv, st); break;
                case IconShape.Earbud: Earbud(cv, st); break;
                case IconShape.Ticket: Ticket(cv, st); break;
                case IconShape.KingFish: KingFish(cv, st); break;
                case IconShape.SurfFish: SurfFish(cv, st); break;
                case IconShape.OfficeFish: OfficeFish(cv, st); break;
                case IconShape.GrilledFish: GrilledFish(cv, st); break;
                default: Fish(cv, st.primary, st.secondary, st.accent, st.variant); break;
            }
            return cv;
        }

        // ================================================================= helpers

        static float[] Rot(float cx, float cy, float deg, params float[] xy)
        {
            float a = deg * Mathf.Deg2Rad, c = Mathf.Cos(a), s = Mathf.Sin(a);
            var r = new float[xy.Length];
            for (int i = 0; i < xy.Length; i += 2)
            {
                float dx = xy[i] - cx, dy = xy[i + 1] - cy;
                r[i] = cx + dx * c - dy * s;
                r[i + 1] = cy + dx * s + dy * c;
            }
            return r;
        }

        /// <summary>귀여운 눈: 흰자 + 동공 + 반짝.</summary>
        public static void Eye(SdfCanvas cv, float x, float y, float r, float lookX = 0.25f, float lookY = 0.05f)
        {
            cv.Fill(Sd.Circle(x, y, r), Ink, 1.6f);
            cv.Fill(Sd.Circle(x, y, r), White);
            float pr = r * 0.62f;
            float px = x + lookX * (r - pr), py = y + lookY * (r - pr);
            cv.Fill(Sd.Circle(px, py, pr), Ink);
            cv.Fill(Sd.Circle(px + pr * 0.35f, py + pr * 0.35f, pr * 0.32f), White);
        }

        static void HappyEye(SdfCanvas cv, float x, float y, float r)
        {
            cv.Fill(Sd.Arc(x, y - r * 0.4f, r, r * 0.45f, 20f, 160f), Ink);
        }

        static void Blush(SdfCanvas cv, float x, float y, float r)
        {
            cv.Fill(Sd.Ellipse(x, y, r, r * 0.6f), new Color(1f, 0.45f, 0.5f, 0.45f));
        }

        static void Steam(SdfCanvas cv, float x, float y)
        {
            var c = new Color(1f, 1f, 1f, 0.75f);
            for (int i = 0; i < 3; i++)
            {
                float ox = x + (i - 1) * 11f;
                cv.Fill(Sd.Path(2.2f, 1.2f, ox, y, ox + 3f, y + 6f, ox - 2f, y + 12f, ox + 2f, y + 18f), c);
            }
        }

        static void Sparkle(SdfCanvas cv, float x, float y, float r, Color c)
        {
            cv.Fill(Sd.Star(x, y, r, r * 0.28f, 4, 90f), c);
        }

        static void Drop(SdfCanvas cv, float x, float y, float r, Color c)
        {
            cv.Fill(Sd.Union(Sd.Circle(x, y, r), Sd.Poly(x - r * 0.85f, y + r * 0.45f, x, y + r * 2.4f, x + r * 0.85f, y + r * 0.45f)), c);
        }

        static Shape Body(float cx, float cy, float rx, float ry)
        {
            return Sd.Ellipse(cx, cy, rx, ry);
        }

        // ================================================================= fish family

        public static void Fish(SdfCanvas cv, Color body, Color belly, Color fin, float variant)
        {
            var b = Body(54, 50, 31, 17);
            var tail = Sd.Inflate(Sd.Poly(27, 50, 9, 65, 13, 50, 9, 35), 1.5f);
            var dorsal = Sd.Inflate(Sd.Poly(38, 61, 53, 75, 67, 63), 1.2f);
            var pelvic = Sd.Inflate(Sd.Poly(47, 38, 55, 27, 62, 37), 1f);
            cv.Sticker(Ink, OL, new Part(tail, fin), new Part(dorsal, fin), new Part(pelvic, fin), new Part(b, body));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(56, 37, 31, 11)), belly);
            FishPattern(cv, b, fin, variant);
            cv.Fill(Sd.Intersect(b, Sd.Arc(73, 50, 13, 2f, 145f, 215f)), body.Shade(0.72f));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(48, 60, 18, 4.2f, 4f)), Shine);
            Eye(cv, 73, 54, 5.6f);
            cv.Fill(Sd.Capsule(81.5f, 45.5f, 85.5f, 47f, 1.1f), Ink);
        }

        static void FishPattern(SdfCanvas cv, Shape b, Color c, float v)
        {
            if (v >= 0.95f)
            {
                var bands = new[] { "#FF6B6B", "#FFA94D", "#FFE066", "#69DB7C", "#4DABF7", "#B197FC" };
                for (int i = 0; i < bands.Length; i++)
                    cv.Fill(Sd.Intersect(b, Sd.Box(54, 57 - i * 2.6f, 40, 1.35f)), Hex.C(bands[i], 0.85f));
            }
            else if (v >= 0.75f)
            {
                cv.Fill(Sd.Intersect(b, Sd.Box(54, 50, 40, 3f)), c.WithAlpha(0.85f));
            }
            else if (v >= 0.5f)
            {
                var stripe = c.WithAlpha(0.9f);
                for (int i = 0; i < 6; i++)
                {
                    float x = 34 + i * 8f;
                    cv.Fill(Sd.Intersect(b, Sd.Intersect(Sd.Path(1.6f, 1.2f, x, 66, x + 3f, 60, x - 1f, 55, x + 2f, 51), Sd.HalfPlane(0, 49, 0, -1))), stripe);
                }
            }
            else if (v >= 0.25f)
            {
                var spot = c.WithAlpha(0.75f);
                float[] xs = { 38, 46, 55, 63, 42, 51, 60, 34 };
                float[] ys = { 57, 61, 60, 57, 51, 53, 51, 50 };
                for (int i = 0; i < xs.Length; i++) cv.Fill(Sd.Intersect(b, Sd.Circle(xs[i], ys[i], 2.2f)), spot);
            }
        }

        static void Tropical(SdfCanvas cv, IconStyle st)
        {
            var b = Sd.Union(Body(50, 50, 26, 24), Sd.Poly(70, 58, 86, 52, 84, 46, 70, 40));
            var tail = Sd.Inflate(Sd.Poly(26, 50, 10, 64, 14, 50, 10, 36), 1.5f);
            var dorsal = Sd.Intersect(Sd.Ellipse(46, 66, 24, 14), Sd.HalfPlane(0, 64, 0, -1));
            var anal = Sd.Intersect(Sd.Ellipse(46, 34, 22, 13), Sd.HalfPlane(0, 36, 0, 1));
            Color fin = st.variant >= 0.5f ? st.primary.Shade(0.85f) : st.accent;
            cv.Sticker(Ink, OL, new Part(tail, fin), new Part(dorsal, fin), new Part(anal, fin), new Part(b, st.primary));
            if (st.variant >= 0.5f)
            {
                // 후무후무: 검은 쐐기 + 노란 입술 줄 + 파란 줄무늬
                cv.Fill(Sd.Intersect(b, Sd.Poly(24, 38, 52, 46, 64, 26, 24, 22)), st.secondary);
                cv.Fill(Sd.Intersect(b, Sd.Box(60, 50, 3.5f, 22, 0, 0)), st.secondary);
                cv.Fill(Sd.Intersect(b, Sd.Capsule(86, 49, 60, 40, 2.2f)), st.accent);
                var blue = Hex.C("#4D96FF");
                for (int i = 0; i < 3; i++) cv.Fill(Sd.Intersect(b, Sd.Capsule(52 + i * 4, 64, 57 + i * 4, 56, 1.1f)), blue);
            }
            else
            {
                cv.Fill(Sd.Intersect(b, Sd.Ellipse(50, 40, 22, 9)), st.secondary.WithAlpha(0.7f));
                cv.Fill(Sd.Ellipse(25, 50, 3.4f, 1.6f), White);
            }
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(46, 62, 14, 4f, 8f)), Shine);
            Eye(cv, 70, 56, 5f);
            cv.Fill(Sd.Capsule(84, 49, 86, 50, 1f), Ink);
        }

        static void Tuna(SdfCanvas cv, IconStyle st)
        {
            var b = Sd.Union(Body(54, 50, 34, 15), Sd.Poly(80, 56, 95, 50, 80, 43));
            var tail = Sd.Inflate(Sd.Poly(24, 50, 8, 72, 15, 51, 15, 49, 8, 28), 1.2f);
            var dorsal = Sd.Inflate(Sd.Poly(44, 62, 50, 76, 58, 63), 1f);
            var pect = Sd.Inflate(Sd.Poly(66, 48, 48, 41, 66, 45), 0.8f);
            cv.Sticker(Ink, OL, new Part(tail, st.primary), new Part(dorsal, st.primary), new Part(b, st.primary));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(56, 40, 36, 10)), st.secondary);
            for (int i = 0; i < 4; i++)
            {
                float x = 28 + i * 4.5f;
                cv.Fill(Sd.Poly(x, 58 - i * 0.6f, x + 2.2f, 63 - i, x + 4.4f, 58 - i * 0.6f), st.accent);
                cv.Fill(Sd.Poly(x, 42 + i * 0.6f, x + 2.2f, 37 + i, x + 4.4f, 42 + i * 0.6f), st.accent);
            }
            cv.Fill(pect, st.primary.Shade(0.75f));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(52, 58, 22, 3.5f)), Shine);
            Eye(cv, 78, 52, 4.8f);
        }

        static void Puffer(SdfCanvas cv, IconStyle st)
        {
            var parts = new System.Collections.Generic.List<Part>();
            for (int i = 0; i < 14; i++)
            {
                float a = i * Mathf.PI * 2f / 14f;
                float cx = 50 + Mathf.Cos(a) * 30, cy = 50 + Mathf.Sin(a) * 30;
                float ox = 50 + Mathf.Cos(a) * 37, oy = 50 + Mathf.Sin(a) * 37;
                float px = -Mathf.Sin(a) * 4f, py = Mathf.Cos(a) * 4f;
                parts.Add(new Part(Sd.Poly(cx + px, cy + py, ox, oy, cx - px, cy - py), st.secondary.Shade(0.8f)));
            }
            var tail = Sd.Inflate(Sd.Poly(22, 50, 10, 60, 12, 40), 1.5f);
            parts.Add(new Part(tail, st.accent));
            var b = Sd.Circle(50, 50, 30);
            parts.Add(new Part(b, st.primary));
            cv.Sticker(Ink, OL, parts.ToArray());
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(52, 36, 28, 14)), st.secondary);
            float[] sx = { 38, 46, 56, 64, 34, 50, 60 };
            float[] sy = { 66, 72, 70, 64, 56, 62, 58 };
            for (int i = 0; i < sx.Length; i++) cv.Fill(Sd.Circle(sx[i], sy[i], 2f), st.accent.WithAlpha(0.7f));
            cv.Fill(Sd.Ellipse(46, 46, 9, 5, -20), st.primary.Shade(0.8f), 0f);
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(44, 70, 14, 5f, 10f)), Shine);
            Eye(cv, 66, 58, 7f, 0.4f, 0.1f);
            cv.Fill(Sd.Circle(80, 46, 3.6f), Ink, 1.2f);
            cv.Fill(Sd.Circle(80, 46, 3.6f), Hex.C("#FF8FA3"));
        }

        static void Sunfish(SdfCanvas cv, IconStyle st)
        {
            var b = Sd.Intersect(Sd.Ellipse(52, 50, 32, 34), Sd.HalfPlane(24, 0, -1, 0));
            var frill = Sd.Union(Sd.Circle(23, 38, 5), Sd.Circle(21, 50, 5.5f), Sd.Circle(23, 62, 5));
            var dorsal = Sd.Inflate(Sd.Poly(36, 76, 30, 96, 50, 80), 1.5f);
            var anal = Sd.Inflate(Sd.Poly(36, 24, 30, 4, 50, 20), 1.5f);
            cv.Sticker(Ink, OL, new Part(dorsal, st.accent), new Part(anal, st.accent), new Part(frill, st.accent), new Part(b, st.primary));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(56, 32, 30, 16)), st.secondary);
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(50, 70, 18, 5f, 6f)), Shine);
            // 기절한 눈 (소용돌이)
            cv.Fill(Sd.Circle(66, 58, 7f), Ink, 1.4f);
            cv.Fill(Sd.Circle(66, 58, 7f), White);
            cv.Fill(Sd.Ring(66, 58, 4.2f, 1.4f), Ink);
            cv.Fill(Sd.Circle(66, 58, 1.4f), Ink);
            cv.Fill(Sd.Ring(80, 44, 2.6f, 1.6f), Ink);
            Sparkle(cv, 74, 86, 6f, Hex.C("#FFD43B"));
            Sparkle(cv, 86, 76, 4.5f, Hex.C("#FFD43B"));
        }

        static void Eel(SdfCanvas cv, IconStyle st)
        {
            bool grilled = st.variant >= 0.9f;
            var body = Sd.Path(3.5f, 8.5f, 8, 46, 20, 56, 34, 44, 48, 56, 62, 46, 74, 52);
            var head = Sd.Ellipse(80, 53, 11, 8.5f, 8f);
            var all = Sd.Union(body, head);
            cv.Sticker(Ink, OL, new Part(all, st.primary));
            cv.Fill(Sd.Intersect(all, Sd.Move(all, 0, -4f)), st.secondary.WithAlpha(grilled ? 0.55f : 0.8f));
            if (grilled)
            {
                for (int i = 0; i < 5; i++)
                {
                    float x = 18 + i * 13f;
                    cv.Fill(Sd.Intersect(all, Sd.Capsule(x, 62, x + 8, 38, 1.6f)), st.accent.WithAlpha(0.85f));
                }
                cv.Fill(Sd.Intersect(all, Sd.Move(all, 0, -2.5f)), new Color(1f, 0.85f, 0.6f, 0.25f));
                Steam(cv, 46, 70);
            }
            else
            {
                cv.Fill(Sd.Intersect(Sd.Move(body, 0, 2.5f), Sd.Subtract(Sd.Move(body, 0, 3.5f), body)), st.accent);
            }
            Eye(cv, 84, 56, 3.6f);
            cv.Fill(Sd.Capsule(88, 49, 91, 50, 0.9f), Ink);
        }

        static void Seahorse(SdfCanvas cv, IconStyle st)
        {
            var head = Sd.Ellipse(58, 78, 11, 9, -10);
            var snout = Sd.Capsule(64, 77, 82, 72, 3.6f, 2.6f);
            var crest = Sd.Union(Sd.Poly(50, 84, 52, 94, 56, 86), Sd.Poly(56, 86, 60, 95, 62, 86));
            var body = Sd.Union(Sd.Circle(54, 67, 10), Sd.Circle(50, 55, 12), Sd.Circle(52, 43, 11.5f), Sd.Circle(56, 33, 9));
            var tail = Sd.Path(6f, 2.5f, 56, 27, 52, 18, 44, 14, 37, 18, 38, 26, 45, 27);
            var fin = Sd.Ellipse(38, 52, 6, 10, 15);
            cv.Sticker(Ink, OL, new Part(fin, st.accent), new Part(crest, st.accent), new Part(tail, st.primary), new Part(body, st.primary), new Part(snout, st.primary), new Part(head, st.primary));
            for (int i = 0; i < 5; i++) cv.Fill(Sd.Intersect(body, Sd.Capsule(54, 64 - i * 7, 64, 64 - i * 7 - 2, 0.9f)), st.secondary);
            cv.Fill(Sd.Intersect(body, Sd.Ellipse(60, 52, 6, 16)), st.secondary.WithAlpha(0.7f));
            Eye(cv, 60, 80, 4.2f);
            Blush(cv, 62, 72, 3.5f);
        }

        static void Turtle(SdfCanvas cv, IconStyle st)
        {
            var shell = Sd.Intersect(Sd.Ellipse(48, 48, 32, 26), Sd.HalfPlane(0, 34, 0, -1));
            var head = Sd.Circle(86, 48, 9);
            var neck = Sd.Capsule(74, 44, 84, 47, 6);
            var fFront = Sd.Ellipse(70, 30, 15, 6, -35);
            var fBack = Sd.Ellipse(24, 32, 11, 5, 30);
            var tailT = Sd.Poly(18, 40, 8, 38, 18, 36);
            var skin = st.secondary;
            cv.Sticker(Ink, OL, new Part(fBack, skin), new Part(fFront, skin), new Part(tailT, skin), new Part(neck, skin), new Part(head, skin), new Part(shell, st.primary));
            var plate = st.accent;
            cv.Fill(Sd.Intersect(shell, Sd.Ellipse(48, 52, 10, 9)), plate);
            cv.Fill(Sd.Intersect(shell, Sd.Ellipse(30, 47, 8, 8)), plate);
            cv.Fill(Sd.Intersect(shell, Sd.Ellipse(66, 47, 8, 8)), plate);
            cv.Fill(Sd.Intersect(shell, Sd.Ellipse(40, 66, 8, 6)), plate);
            cv.Fill(Sd.Intersect(shell, Sd.Ellipse(58, 66, 8, 6)), plate);
            cv.Fill(Sd.Intersect(shell, Sd.Box(48, 36, 34, 2.4f)), st.primary.Shade(0.75f));
            cv.Fill(Sd.Intersect(shell, Sd.Ellipse(42, 70, 16, 4f, 10f)), Shine);
            HappyEye(cv, 88, 51, 3.4f);
            Blush(cv, 86, 44, 3f);
        }

        static void Jellyfish(SdfCanvas cv, IconStyle st)
        {
            var tent = st.accent.WithAlpha(0.85f);
            for (int i = 0; i < 4; i++)
            {
                float x = 34 + i * 10.5f;
                cv.Fill(Sd.Path(2.6f, 1.2f, x, 46, x + 4f, 34, x - 3f, 24, x + 3f, 12), tent, 1.2f);
            }
            var dome = Sd.Union(Sd.Intersect(Sd.Ellipse(50, 56, 28, 26), Sd.HalfPlane(0, 46, 0, -1)),
                Sd.Circle(26, 46, 4), Sd.Circle(35, 45, 4.4f), Sd.Circle(45, 44.5f, 4.6f), Sd.Circle(55, 44.5f, 4.6f), Sd.Circle(65, 45, 4.4f), Sd.Circle(74, 46, 4));
            cv.Sticker(Ink, OL, new Part(dome, st.primary.WithAlpha(0.92f)));
            cv.Fill(Sd.Intersect(dome, Sd.Ellipse(50, 60, 18, 14)), st.secondary.WithAlpha(0.6f));
            cv.Fill(Sd.Intersect(dome, Sd.Ellipse(42, 72, 10, 4, 15)), Shine);
            cv.Fill(Sd.Circle(43, 56, 2.4f), Ink);
            cv.Fill(Sd.Circle(57, 56, 2.4f), Ink);
            cv.Fill(Sd.Arc(50, 54, 4f, 1.6f, 200f, 340f), Ink);
            Blush(cv, 38, 52, 3f);
            Blush(cv, 62, 52, 3f);
        }

        static void Shark(SdfCanvas cv, IconStyle st)
        {
            var b = Sd.Union(Body(50, 48, 36, 15), Sd.Poly(78, 56, 96, 47, 78, 40));
            var tail = Sd.Inflate(Sd.Poly(18, 48, 4, 70, 11, 48, 6, 30), 1.2f);
            var dorsal = Sd.Inflate(Sd.Poly(40, 60, 58, 61, 66, 70, 61, 75, 52, 69), 1.2f);
            var pect = Sd.Inflate(Sd.Poly(60, 40, 50, 26, 66, 38), 1f);
            cv.Sticker(Ink, OL, new Part(tail, st.primary), new Part(dorsal, st.primary), new Part(pect, st.primary.Shade(0.85f)), new Part(b, st.primary));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(56, 38, 36, 9)), st.secondary);
            for (int i = 0; i < 3; i++) cv.Fill(Sd.Capsule(66 + i * 3.4f, 52, 65 + i * 3.4f, 45, 0.9f), st.accent);
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(46, 58, 22, 3.5f)), Shine);
            Eye(cv, 82, 51, 3.8f, 0f, -0.6f);
            cv.Fill(Sd.Capsule(78, 57.5f, 86, 55.5f, 1.1f), Ink);
            Drop(cv, 83, 40, 2.6f, Hex.C("#74C0FC"));
            cv.Fill(Sd.Arc(88, 40, 3.5f, 1.4f, 20f, 160f), Ink);
        }

        // ================================================================= junk & food

        static void Boot(SdfCanvas cv, IconStyle st)
        {
            var shaft = Sd.Box(42, 58, 14, 26, 5);
            var foot = Sd.Box(56, 30, 27, 11, 9);
            var boot = Sd.Union(shaft, foot);
            var sole = Sd.Box(56, 19.5f, 28, 3.6f, 3);
            var rim = Sd.Box(42, 84, 15.5f, 3.8f, 3);
            var weed = Sd.Path(2.6f, 1.6f, 52, 86, 60, 80, 56, 70, 62, 62);
            cv.Sticker(Ink, OL, new Part(boot, st.primary), new Part(sole, st.secondary), new Part(rim, st.accent), new Part(weed, Hex.C("#4CAF50")));
            cv.Fill(Sd.Intersect(boot, Sd.Box(34, 56, 3, 22, 2)), Shine);
            cv.Fill(Sd.Intersect(boot, Sd.Ellipse(70, 36, 10, 3.5f, -5f)), Shine);
            Drop(cv, 80, 54, 3f, Hex.C("#74C0FC"));
            Drop(cv, 88, 44, 2.2f, Hex.C("#74C0FC"));
        }

        static void Bungeoppang(SdfCanvas cv, IconStyle st)
        {
            var body = Sd.Union(Body(54, 50, 32, 21), Sd.Inflate(Sd.Poly(26, 50, 9, 66, 12, 50, 9, 34), 2.5f));
            var bite = Sd.Union(Sd.Circle(84, 62, 10), Sd.Circle(75, 71, 9), Sd.Circle(90, 50, 7));
            var bitten = Sd.Subtract(body, bite);
            cv.Sticker(Ink, OL, new Part(bitten, st.primary));
            cv.Fill(Sd.Intersect(bitten, Sd.Ellipse(52, 50, 24, 13)), st.secondary.WithAlpha(0.8f));
            var scale = st.accent.WithAlpha(0.55f);
            for (int r = 0; r < 3; r++)
                for (int i = 0; i < 4; i++)
                {
                    float x = 36 + i * 9f + (r % 2) * 4.5f, y = 58 - r * 8f;
                    cv.Fill(Sd.Intersect(bitten, Sd.Arc(x, y, 3.6f, 1.4f, 200f, 340f)), scale);
                }
            // 베어 문 자리: 잘린 면을 따라 슈크림이 보인다
            var cream = Sd.Intersect(Sd.Inflate(body, -2.5f), Sd.Inflate(bite, 5f));
            cv.Fill(Sd.Intersect(bitten, cream), Hex.C("#FFE08A"));
            cv.Fill(Sd.Intersect(bitten, Sd.Intersect(Sd.Inflate(body, -2.5f), Sd.Inflate(bite, 2f))), Hex.C("#FFF3C4"));
            cv.Fill(Sd.Ring(68, 54, 4.5f, 2f), st.accent);
            cv.Fill(Sd.Circle(68, 54, 1.8f), st.accent);
        }

        static void Rock(SdfCanvas cv, IconStyle st)
        {
            var rock = Sd.Union(Sd.Ellipse(52, 40, 34, 22), Sd.Ellipse(42, 52, 22, 17, 10));
            var bow = Sd.Union(Sd.Poly(46, 66, 34, 74, 34, 60), Sd.Poly(50, 66, 62, 74, 62, 60), Sd.Circle(48, 66, 3.6f));
            cv.Sticker(Ink, OL, new Part(rock, st.primary), new Part(bow, Hex.C("#FF7AA2")));
            cv.Fill(Sd.Intersect(rock, Sd.Ellipse(56, 28, 32, 10)), st.accent.WithAlpha(0.45f));
            cv.Fill(Sd.Intersect(rock, Sd.Ellipse(40, 56, 14, 5, 10)), st.secondary.WithAlpha(0.8f));
            float[] dx = { 30, 70, 62, 36, 76 };
            float[] dy = { 36, 34, 26, 26, 44 };
            for (int i = 0; i < dx.Length; i++) cv.Fill(Sd.Circle(dx[i], dy[i], 1.6f), st.accent.WithAlpha(0.6f));
            Eye(cv, 44, 44, 6.2f, -0.6f, 0.4f);
            Eye(cv, 60, 45, 6.2f, 0.7f, -0.3f);
            cv.Fill(Sd.Arc(52, 36, 4f, 1.5f, 210f, 330f), Ink);
        }

        static void Document(SdfCanvas cv, IconStyle st)
        {
            var paper = Sd.Poly(Rot(50, 50, -8f, 24, 10, 76, 10, 76, 74, 63, 88, 24, 88));
            var fold = Sd.Poly(Rot(50, 50, -8f, 63, 88, 63, 75, 76, 74));
            cv.Sticker(Ink, OL, new Part(paper, st.primary), new Part(fold, st.secondary));
            var line = st.secondary.Shade(0.75f);
            float[] lens = { 26, 34, 30, 34, 22 };
            for (int i = 0; i < lens.Length; i++)
            {
                var p = Rot(50, 50, -8f, 31, 76 - i * 8f, 31 + lens[i], 76 - i * 8f);
                cv.Fill(Sd.Capsule(p[0], p[1], p[2], p[3], i == 0 ? 2.2f : 1.4f), line);
            }
            var red = st.accent;
            cv.Fill(Sd.Ring(60, 28, 11, 2.8f), red.WithAlpha(0.9f));
            cv.Fill(Sd.Capsule(54, 22, 66, 34, 1.8f), red.WithAlpha(0.9f));
            cv.Fill(Sd.Capsule(54, 34, 66, 22, 1.8f), red.WithAlpha(0.9f));
            Drop(cv, 16, 30, 2.6f, Hex.C("#74C0FC"));
            Drop(cv, 86, 52, 2.2f, Hex.C("#74C0FC"));
        }

        static void Router(SdfCanvas cv, IconStyle st)
        {
            var dark = st.accent;
            var a1 = Sd.Capsule(28, 46, 20, 80, 2.6f);
            var a2 = Sd.Capsule(50, 48, 50, 84, 2.6f);
            var a3 = Sd.Capsule(72, 46, 80, 80, 2.6f);
            var box = Sd.Box(50, 38, 34, 12, 6);
            cv.Sticker(Ink, OL, new Part(a1, dark), new Part(a2, dark), new Part(a3, dark), new Part(box, st.primary));
            cv.Fill(Sd.Circle(20, 81, 3.2f), dark);
            cv.Fill(Sd.Circle(50, 85, 3.2f), dark);
            cv.Fill(Sd.Circle(80, 81, 3.2f), dark);
            cv.Fill(Sd.Intersect(box, Sd.Box(50, 30, 34, 4)), st.primary.Shade(0.85f));
            string[] leds = { "#40C057", "#40C057", "#4DABF7", "#FFA94D" };
            for (int i = 0; i < leds.Length; i++) cv.Fill(Sd.Circle(30 + i * 8f, 40, 2.2f), Hex.C(leds[i]));
            var wifi = st.secondary;
            cv.Fill(Sd.Circle(66, 60, 2.6f), wifi);
            cv.Fill(Sd.Arc(66, 58, 8, 2.6f, 45f, 135f), wifi);
            cv.Fill(Sd.Arc(66, 58, 14, 2.6f, 50f, 130f), wifi);
            cv.Fill(Sd.Arc(66, 58, 20, 2.6f, 55f, 125f), wifi.WithAlpha(0.5f));
        }

        static void Pineapple(SdfCanvas cv, IconStyle st)
        {
            var leaf = st.secondary;
            var leaves = Sd.Union(
                Sd.Ellipse(50, 80, 5, 15), Sd.Ellipse(42, 78, 4.2f, 13, 25), Sd.Ellipse(58, 78, 4.2f, 13, -25),
                Sd.Ellipse(36, 74, 3.8f, 10, 55), Sd.Ellipse(64, 74, 3.8f, 10, -55));
            var body = Sd.Ellipse(50, 40, 22, 28);
            cv.Sticker(Ink, OL, new Part(leaves, leaf), new Part(body, st.primary));
            var line = st.accent.WithAlpha(0.7f);
            for (int i = -3; i <= 3; i++)
            {
                cv.Fill(Sd.Intersect(body, Sd.Capsule(30 + i * 9f, 14, 70 + i * 9f, 66, 0.9f)), line);
                cv.Fill(Sd.Intersect(body, Sd.Capsule(70 + i * 9f, 14, 30 + i * 9f, 66, 0.9f)), line);
            }
            cv.Fill(Sd.Intersect(body, Sd.Ellipse(42, 54, 8, 12, 15)), Shine);
            // 선글라스 (하와이 감성)
            var glass = Sd.Union(Sd.Box(41, 44, 8, 5, 3), Sd.Box(59, 44, 8, 5, 3), Sd.Capsule(48, 46, 52, 46, 1.2f));
            cv.Fill(glass, Ink);
            cv.Fill(Sd.Capsule(37, 45, 40, 47, 0.8f), new Color(1f, 1f, 1f, 0.6f));
            cv.Fill(Sd.Arc(50, 36, 4.2f, 1.6f, 210f, 330f), Ink);
        }

        static void Pizza(SdfCanvas cv, IconStyle st)
        {
            var cheese = Sd.Inflate(Sd.Poly(22, 78, 78, 78, 50, 14), 2.5f);
            var crust = Sd.Capsule(18, 80, 82, 80, 7.5f);
            var drip = Sd.Capsule(49, 16, 50, 7, 3.2f);
            cv.Sticker(Ink, OL, new Part(drip, st.primary), new Part(cheese, st.primary), new Part(crust, Hex.C("#E9B36A")));
            cv.Fill(Sd.Intersect(cheese, Sd.Box(50, 73, 34, 2.4f)), st.secondary.WithAlpha(0.8f));
            cv.Fill(Sd.Intersect(crust, Sd.Ellipse(50, 84, 30, 2.4f)), Shine);
            var ham = st.secondary;
            cv.Fill(Sd.Box(40, 62, 6, 5, 2, 15), ham, 0f);
            cv.Fill(Sd.Box(60, 56, 5.5f, 5, 2, -20), ham);
            cv.Fill(Sd.Box(50, 36, 5, 4.5f, 2, 30), ham);
            var pine = st.accent;
            cv.Fill(Sd.Inflate(Sd.Poly(52, 66, 60, 66, 56, 60), 1.2f), pine);
            cv.Fill(Sd.Inflate(Sd.Poly(38, 48, 46, 48, 42, 42), 1.2f), pine);
            cv.Fill(Sd.Inflate(Sd.Poly(56, 44, 62, 44, 59, 38), 1.1f), pine);
            Sparkle(cv, 84, 64, 5f, Hex.C("#FF6B6B"));
            Sparkle(cv, 16, 60, 4f, Hex.C("#FF6B6B"));
        }

        static void Octopus(SdfCanvas cv, IconStyle st)
        {
            var tents = new Part[6];
            for (int i = 0; i < 6; i++)
            {
                float x = 30 + i * 8f;
                float dir = i < 3 ? -1f : 1f;
                tents[i] = new Part(Sd.Path(4.4f, 2f, x, 44, x + dir * 2f, 30, x + dir * 6f, 20, x + dir * 10f, 18), st.primary);
            }
            cv.Sticker(Ink, OL, tents);
            var head = Sd.Ellipse(50, 60, 22, 21);
            cv.Sticker(Ink, OL, new Part(head, st.primary));
            var skirtA = st.accent;
            var skirtB = Hex.C("#B5E48C");
            for (int i = 0; i < 8; i++)
            {
                float x = 30 + i * 5.7f;
                cv.Fill(Sd.Box(x, 36, 2.2f, 9, 1.5f, (i - 3.5f) * 4f), i % 2 == 0 ? skirtA : skirtB, 1.2f);
                cv.Fill(Sd.Box(x, 36, 2.2f, 9, 1.5f, (i - 3.5f) * 4f), i % 2 == 0 ? skirtA : skirtB);
            }
            cv.Fill(Sd.Intersect(head, Sd.Ellipse(44, 72, 10, 5, 15)), Shine);
            var petal = st.secondary;
            for (int i = 0; i < 5; i++)
            {
                float a = (90f + i * 72f) * Mathf.Deg2Rad;
                cv.Fill(Sd.Circle(66 + Mathf.Cos(a) * 5f, 80 + Mathf.Sin(a) * 5f, 4.2f), petal, 1.2f);
            }
            for (int i = 0; i < 5; i++)
            {
                float a = (90f + i * 72f) * Mathf.Deg2Rad;
                cv.Fill(Sd.Circle(66 + Mathf.Cos(a) * 5f, 80 + Mathf.Sin(a) * 5f, 4.2f), Hex.C("#FF6B9D"));
            }
            cv.Fill(Sd.Circle(66, 80, 2.4f), Hex.C("#FFE066"));
            HappyEye(cv, 43, 58, 3.6f);
            HappyEye(cv, 57, 58, 3.6f);
            Blush(cv, 38, 52, 3.2f);
            Blush(cv, 62, 52, 3.2f);
        }

        static void Coconut(SdfCanvas cv, IconStyle st)
        {
            var nut = Sd.Circle(48, 42, 28);
            var straw = Sd.Capsule(54, 60, 70, 90, 2.6f);
            var umbrellaStick = Sd.Capsule(38, 62, 30, 84, 1.2f);
            var canopy = Sd.Intersect(Sd.Circle(30, 82, 13), Sd.HalfPlane(0, 82, 0, -1));
            cv.Sticker(Ink, OL, new Part(straw, Hex.C("#FF8FAB")), new Part(umbrellaStick, Hex.C("#A0693F")), new Part(canopy, Hex.C("#4DABF7")), new Part(nut, st.primary));
            cv.Fill(Sd.Intersect(canopy, Sd.Box(30, 86, 2.5f, 8)), Hex.C("#FFE066"));
            cv.Fill(Sd.Intersect(nut, Sd.Ellipse(48, 66, 22, 6)), st.accent);
            cv.Fill(Sd.Intersect(nut, Sd.Ellipse(48, 67, 16, 3.5f)), st.secondary);
            var fiber = st.secondary.WithAlpha(0.6f);
            float[] fx = { 30, 38, 58, 66, 44, 54 };
            float[] fy = { 40, 28, 30, 42, 20, 22 };
            for (int i = 0; i < fx.Length; i++) cv.Fill(Sd.Capsule(fx[i], fy[i], fx[i] + 4, fy[i] + 3, 0.8f), fiber);
            cv.Fill(Sd.Circle(40, 50, 2.4f), Ink);
            cv.Fill(Sd.Circle(52, 50, 2.4f), Ink);
            cv.Fill(Sd.Circle(46, 43, 2.2f), Ink);
            cv.Fill(Sd.Intersect(nut, Sd.Ellipse(36, 32, 6, 10, -20)), Shine);
        }

        static void Squid(SdfCanvas cv, IconStyle st)
        {
            var tents = new System.Collections.Generic.List<Part>();
            for (int i = 0; i < 5; i++)
            {
                float a = 205f + i * 12f;
                float r = 30f;
                float ex = 36 + Mathf.Cos(a * Mathf.Deg2Rad) * r, ey = 40 + Mathf.Sin(a * Mathf.Deg2Rad) * r;
                tents.Add(new Part(Sd.Path(3.2f, 1.6f, 38, 42, (38 + ex) * 0.5f + 3f, (42 + ey) * 0.5f - 2f, ex, ey), st.primary));
            }
            var mantle = Sd.Ellipse(56, 58, 14, 30, -38);
            var fin = Sd.Inflate(Sd.Poly(66, 86, 88, 86, 78, 70), 1.5f);
            tents.Add(new Part(fin, st.primary));
            tents.Add(new Part(mantle, st.primary));
            cv.Sticker(Ink, OL, tents.ToArray());
            cv.Fill(Sd.Intersect(mantle, Sd.Ellipse(54, 56, 8, 22, -38)), st.secondary.WithAlpha(0.85f));
            for (int i = 0; i < 4; i++)
            {
                float x = 44 + i * 8f;
                cv.Fill(Sd.Intersect(mantle, Sd.Capsule(x, 74 - i * 3, x + 12, 50 - i * 3, 1.5f)), st.accent.WithAlpha(0.85f));
            }
            Eye(cv, 44, 46, 3.6f, -0.3f, 0.2f);
            Steam(cv, 70, 92);
        }

        static void Sheep(SdfCanvas cv, IconStyle st)
        {
            var legs = new Part[4];
            float[] lx = { 34, 44, 56, 66 };
            for (int i = 0; i < 4; i++) legs[i] = new Part(Sd.Capsule(lx[i], 34, lx[i], 22, 3f), st.accent);
            cv.Sticker(Ink, OL, legs);
            var wool = Sd.Union(Sd.Circle(34, 50, 15), Sd.Circle(50, 57, 17), Sd.Circle(66, 51, 14), Sd.Circle(42, 40, 13), Sd.Circle(60, 40, 13), Sd.Circle(50, 45, 15));
            var head = Sd.Ellipse(78, 50, 10, 12, -10);
            var ear = Sd.Ellipse(74, 60, 7, 3.5f, 30);
            cv.Sticker(Ink, OL, new Part(wool, st.primary), new Part(ear, st.accent), new Part(head, st.accent));
            cv.Fill(Sd.Intersect(wool, Sd.Ellipse(48, 40, 26, 10)), st.secondary);
            cv.Fill(Sd.Union(Sd.Circle(72, 60, 5), Sd.Circle(79, 63, 5.5f), Sd.Circle(85, 59, 4.5f)), st.primary, 1.2f);
            cv.Fill(Sd.Union(Sd.Circle(72, 60, 5), Sd.Circle(79, 63, 5.5f), Sd.Circle(85, 59, 4.5f)), st.primary);
            cv.Fill(Sd.Arc(76, 49, 2.6f, 1.2f, 200f, 340f), White);
            cv.Fill(Sd.Arc(83, 48, 2.6f, 1.2f, 200f, 340f), White);
            var z = Hex.C("#9775FA");
            cv.Fill(Sd.Poly(84, 86, 94, 86, 94, 84, 87.5f, 78, 94, 78, 94, 76, 84, 76, 84, 78, 90.5f, 84, 84, 84), z);
            cv.Fill(Sd.Poly(76, 94, 82, 94, 82, 92.8f, 78, 89.2f, 82, 89.2f, 82, 88, 76, 88, 76, 89.2f, 80, 92.8f, 76, 92.8f), z);
        }

        static void Parcel(SdfCanvas cv, IconStyle st)
        {
            var wing = Sd.Union(Sd.Ellipse(12, 52, 10, 5, 25), Sd.Ellipse(12, 44, 9, 4, 10));
            var wing2 = Sd.Union(Sd.Ellipse(92, 58, 9, 4.5f, -25), Sd.Ellipse(92, 50, 8, 3.6f, -10));
            var front = Sd.Box(44, 40, 26, 22, 2);
            var side = Sd.Poly(70, 18, 84, 30, 84, 74, 70, 62);
            var top = Sd.Poly(18, 62, 70, 62, 84, 74, 32, 74);
            cv.Sticker(Ink, OL, new Part(wing, White), new Part(wing2, White), new Part(side, st.primary.Shade(0.78f)), new Part(top, st.secondary), new Part(front, st.primary));
            var tape = st.secondary.Shade(1.25f);
            cv.Fill(Sd.Poly(41, 62, 49, 62, 63, 74, 55, 74), tape);
            cv.Fill(Sd.Box(45, 52, 4, 10), tape);
            cv.Fill(Sd.Box(44, 32, 12, 8, 1.5f), White, 1f);
            cv.Fill(Sd.Box(44, 32, 12, 8, 1.5f), White);
            cv.Fill(Sd.Capsule(36, 34, 50, 34, 0.9f), st.accent);
            cv.Fill(Sd.Capsule(36, 30, 46, 30, 0.9f), st.accent);
            cv.Fill(Sd.Capsule(22, 22, 30, 22, 1f), st.accent.WithAlpha(0.6f));
        }

        static void Earbud(SdfCanvas cv, IconStyle st)
        {
            var bud = Sd.Ellipse(42, 64, 17, 14, -15);
            var stem = Sd.Capsule(50, 56, 58, 18, 6.2f, 5.6f);
            cv.Sticker(Ink, OL, new Part(stem, st.primary), new Part(bud, st.primary));
            cv.Fill(Sd.Intersect(Sd.Union(bud, stem), Sd.Move(Sd.Union(bud, stem), 3, -3)), st.secondary);
            cv.Fill(Sd.Ellipse(34, 68, 5, 3.6f, -15), st.accent);
            cv.Fill(Sd.Circle(57, 22, 2.2f), st.accent.Shade(0.8f));
            cv.Fill(Sd.Ellipse(38, 72, 7, 2.6f, -15), Shine);
            var wave = st.accent.WithAlpha(0.8f);
            cv.Fill(Sd.Arc(60, 66, 10, 2.2f, -45f, 45f), wave);
            cv.Fill(Sd.Arc(60, 66, 17, 2.2f, -40f, 40f), wave.WithAlpha(0.5f));
        }

        static void Ticket(SdfCanvas cv, IconStyle st)
        {
            var pts = new System.Collections.Generic.List<float>();
            pts.AddRange(new float[] { 14, 72, 86, 72 });
            for (int i = 0; i < 5; i++) { pts.Add(i % 2 == 0 ? 80 : 86); pts.Add(72 - (i + 1) * 8.8f); }
            pts.AddRange(new float[] { 86, 28, 14, 28 });
            for (int i = 0; i < 5; i++) { pts.Add(i % 2 == 0 ? 20 : 14); pts.Add(28 + (i + 1) * 8.8f); }
            var ticket = Sd.Poly(Rot(50, 50, -10f, pts.ToArray()));
            cv.Sticker(Ink, OL, new Part(ticket, st.primary));
            cv.Fill(Sd.Intersect(ticket, Sd.Inflate(Sd.Poly(Rot(50, 50, -10f, 24, 66, 76, 66, 76, 34, 24, 34)), 0f)), st.primary.Shade(0.88f));
            var scratch = Sd.Poly(Rot(50, 50, -10f, 30, 60, 70, 60, 70, 40, 30, 40));
            var scratched = Sd.Union(Sd.Circle(54, 50, 9), Sd.Circle(46, 47, 6));
            cv.Fill(Sd.Subtract(scratch, scratched), st.secondary);
            cv.Fill(Sd.Intersect(scratch, scratched), st.primary.Shade(1.25f));
            cv.Fill(Sd.Capsule(47, 43, 57, 56, 2.2f), st.accent);
            cv.Fill(Sd.Capsule(47, 56, 57, 43, 2.2f), st.accent);
            var shine = Hex.C("#FFF4B0");
            Sparkle(cv, 16, 82, 6f, shine);
            Sparkle(cv, 86, 18, 5f, shine);
            Sparkle(cv, 90, 80, 3.5f, shine);
        }

        static void KingFish(SdfCanvas cv, IconStyle st)
        {
            var b = Body(50, 44, 34, 20);
            var tail = Sd.Inflate(Sd.Poly(20, 44, 3, 66, 9, 44, 3, 22), 1.5f);
            var dorsal = Sd.Inflate(Sd.Poly(30, 60, 34, 74, 40, 64, 46, 77, 52, 64, 58, 75, 64, 61), 1f);
            var pelvic = Sd.Inflate(Sd.Poly(44, 28, 50, 16, 58, 27), 1f);
            cv.Sticker(Ink, OL, new Part(tail, st.secondary.Shade(0.8f)), new Part(dorsal, st.secondary.Shade(0.8f)), new Part(pelvic, st.secondary.Shade(0.8f)), new Part(b, st.primary));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(52, 30, 34, 12)), st.secondary);
            var crown = Sd.Inflate(Sd.Poly(62, 66, 62, 80, 67, 74, 72, 84, 77, 74, 82, 80, 82, 66), 0.8f);
            cv.Sticker(Ink, OL, new Part(crown, st.accent));
            cv.Fill(Sd.Circle(72, 71, 2.6f), Hex.C("#E63946"));
            cv.Fill(Sd.Circle(65.5f, 70, 1.6f), Hex.C("#4DABF7"));
            cv.Fill(Sd.Circle(78.5f, 70, 1.6f), Hex.C("#4DABF7"));
            Drop(cv, 86, 78, 2f, Hex.C("#74C0FC"));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(44, 56, 20, 4.5f, 4f)), Shine);
            Eye(cv, 70, 50, 5.4f, 0.2f, -0.2f);
            cv.Fill(Sd.Capsule(63, 59, 75, 56, 1.6f), Ink);
            cv.Fill(Sd.Capsule(78, 40, 84, 41, 1.2f), Ink);
            Sparkle(cv, 14, 82, 6f, Hex.C("#FFE066"));
            Sparkle(cv, 90, 20, 5f, Hex.C("#FFE066"));
        }

        static void SurfFish(SdfCanvas cv, IconStyle st)
        {
            var wave = Sd.Inflate(Sd.Poly(4, 18, 30, 18, 26, 34, 16, 40, 8, 34), 2f);
            cv.Fill(wave, Hex.C("#A5E9FF"), OL);
            cv.Fill(wave, Hex.C("#A5E9FF"));
            var board = Sd.Ellipse(52, 26, 44, 8, 8);
            cv.Sticker(Ink, OL, new Part(board, st.secondary));
            cv.Fill(Sd.Intersect(board, Sd.Box(52, 26, 44, 1.6f, 0, 8)), st.accent);
            var fb = Body(54, 50, 20, 12);
            var tail = Sd.Inflate(Sd.Poly(36, 50, 24, 60, 26, 50, 24, 40), 1.2f);
            var fin = Sd.Inflate(Sd.Poly(46, 60, 54, 69, 62, 61), 1f);
            cv.Sticker(Ink, OL, new Part(tail, st.primary.Shade(0.8f)), new Part(fin, st.primary.Shade(0.8f)), new Part(fb, st.primary));
            cv.Fill(Sd.Intersect(fb, Sd.Ellipse(55, 42, 20, 7)), Hex.C("#F3E1B0"));
            var glass = Sd.Union(Sd.Box(64, 53, 5, 3.2f, 1.6f), Sd.Box(73, 53, 4, 3, 1.4f), Sd.Capsule(68, 54, 70, 54, 0.8f));
            cv.Fill(glass, Ink);
            cv.Fill(Sd.Arc(70, 46, 3.2f, 1.2f, 200f, 340f), Ink);
            cv.Fill(Sd.Capsule(30, 36, 18, 38, 1f), Hex.C("#74C0FC"));
            cv.Fill(Sd.Capsule(28, 30, 14, 30, 1f), Hex.C("#74C0FC"));
        }

        static void OfficeFish(SdfCanvas cv, IconStyle st)
        {
            var b = Body(52, 50, 31, 18);
            var tail = Sd.Inflate(Sd.Poly(25, 50, 8, 65, 12, 50, 8, 35), 1.5f);
            var dorsal = Sd.Inflate(Sd.Poly(36, 62, 51, 75, 64, 64), 1.2f);
            cv.Sticker(Ink, OL, new Part(tail, st.primary.Shade(0.8f)), new Part(dorsal, st.primary.Shade(0.8f)), new Part(b, st.primary));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(54, 38, 30, 11)), st.secondary);
            var collar = Sd.Union(Sd.Poly(60, 38, 66, 30, 70, 37), Sd.Poly(70, 37, 74, 30, 79, 38));
            cv.Sticker(Ink, 1.8f, new Part(collar, White));
            var tie = Sd.Inflate(Sd.Poly(69, 35, 72, 35, 74, 22, 70.5f, 16, 67, 22), 0.6f);
            cv.Sticker(Ink, 1.8f, new Part(tie, st.accent));
            cv.Fill(Sd.Capsule(68.5f, 28, 73, 25, 0.7f), st.accent.Shade(1.4f));
            // 피곤한 눈: 반쯤 감긴 눈꺼풀 + 다크서클
            cv.Fill(Sd.Circle(72, 55, 5.6f), Ink, 1.6f);
            cv.Fill(Sd.Circle(72, 55, 5.6f), White);
            cv.Fill(Sd.Circle(72.5f, 53.5f, 3.2f), Ink);
            cv.Fill(Sd.Intersect(Sd.Circle(72, 55, 5.8f), Sd.HalfPlane(0, 55.5f, 0, -1)), st.primary.Shade(0.85f));
            cv.Fill(Sd.Capsule(66.5f, 55.5f, 77.5f, 55.5f, 0.9f), Ink);
            cv.Fill(Sd.Arc(72, 52, 6.5f, 1.4f, 220f, 320f), new Color(0.45f, 0.3f, 0.6f, 0.6f));
            Drop(cv, 62, 64, 2.4f, Hex.C("#74C0FC"));
            cv.Fill(Sd.Capsule(80, 45.5f, 83.5f, 46, 1f), Ink);
        }

        static void GrilledFish(SdfCanvas cv, IconStyle st)
        {
            var b = Body(54, 46, 31, 16);
            var tail = Sd.Inflate(Sd.Poly(27, 46, 10, 60, 14, 46, 10, 32), 1.5f);
            var dorsal = Sd.Inflate(Sd.Poly(40, 56, 53, 68, 66, 58), 1.2f);
            cv.Sticker(Ink, OL, new Part(tail, st.primary.Shade(0.75f)), new Part(dorsal, st.primary.Shade(0.75f)), new Part(b, st.primary));
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(54, 48, 22, 8)), st.secondary.WithAlpha(0.75f));
            for (int i = 0; i < 4; i++)
            {
                float x = 36 + i * 11f;
                cv.Fill(Sd.Intersect(b, Sd.Capsule(x, 60, x + 8, 32, 1.7f)), st.accent.WithAlpha(0.85f));
            }
            cv.Fill(Sd.Intersect(b, Sd.Ellipse(48, 55, 18, 3.5f, 4f)), new Color(1f, 0.95f, 0.8f, 0.4f));
            cv.Fill(Sd.Circle(73, 50, 4.4f), White, 1.4f);
            cv.Fill(Sd.Circle(73, 50, 4.4f), Hex.C("#EDE6D6"));
            cv.Fill(Sd.Circle(73, 50, 1.6f), Ink);
            var lemon = Sd.Intersect(Sd.Circle(80, 24, 11), Sd.HalfPlane(0, 24, 0, -1));
            cv.Sticker(Ink, 2f, new Part(lemon, Hex.C("#FFE066")));
            cv.Fill(Sd.Intersect(Sd.Circle(80, 24, 8), Sd.HalfPlane(0, 25, 0, -1)), Hex.C("#FFF3B0"));
            Steam(cv, 50, 68);
        }

        // ================================================================= rods / baits / places

        public static SdfCanvas PaintRod(Color body, Color accent, int size)
        {
            var cv = new SdfCanvas(size, size, 100f);
            var rod = Sd.Capsule(18, 18, 88, 88, 3.6f, 1.3f);
            var handle = Sd.Capsule(10, 10, 30, 30, 5.2f);
            var reel = Sd.Circle(30, 20, 9);
            cv.Sticker(Ink, OL, new Part(rod, body), new Part(handle, body.Shade(0.55f)), new Part(reel, accent));
            cv.Fill(Sd.Circle(30, 20, 4.5f), accent.Shade(0.75f));
            cv.Fill(Sd.Capsule(30, 20, 38, 14, 1.4f), Ink);
            cv.Fill(Sd.Circle(39, 13, 2.4f), accent.Shade(1.3f), 1f);
            for (int i = 0; i < 3; i++) cv.Fill(Sd.Capsule(14 + i * 5, 18 + i * 5 - 3, 18 + i * 5 - 3, 14 + i * 5, 1f), accent);
            cv.Fill(Sd.Capsule(88, 88, 90, 52, 0.5f), new Color(1f, 1f, 1f, 0.9f));
            cv.Fill(Sd.Arc(87, 50, 3.4f, 1.6f, 180f, 360f), Hex.C("#ADB5BD"));
            cv.Fill(Sd.Capsule(52, 52, 80, 80, 1.2f), Shine);
            return cv;
        }

        public static SdfCanvas PaintBait(BaitShape shape, Color c, Color accent, int size)
        {
            var cv = new SdfCanvas(size, size, 100f);
            switch (shape)
            {
                case BaitShape.Worm:
                case BaitShape.GoldenWorm:
                {
                    bool gold = shape == BaitShape.GoldenWorm;
                    if (gold) cv.Glow(Sd.Path(7, 6, 18, 40, 32, 58, 48, 42, 62, 58, 78, 46), new Color(1f, 0.9f, 0.3f, 0.6f), 12f);
                    var w = Sd.Path(6.5f, 8f, 18, 40, 32, 58, 48, 42, 62, 58, 78, 46);
                    cv.Sticker(Ink, OL, new Part(w, c));
                    cv.Fill(Sd.Intersect(w, Sd.Move(w, 0, -3f)), accent.WithAlpha(0.6f));
                    cv.Fill(Sd.Intersect(w, Sd.Move(w, 0, 3.5f)), Shine);
                    cv.Fill(Sd.Circle(76, 49, 1.8f), Ink);
                    cv.Fill(Sd.Circle(81, 47.5f, 1.8f), Ink);
                    if (gold)
                    {
                        Sparkle(cv, 30, 76, 7f, Hex.C("#FFF4B0"));
                        Sparkle(cv, 74, 74, 5f, Hex.C("#FFF4B0"));
                        Sparkle(cv, 52, 22, 4f, Hex.C("#FFF4B0"));
                    }
                    break;
                }
                case BaitShape.SpamMusubi:
                {
                    var rice = Sd.Box(50, 40, 30, 16, 7);
                    var spam = Sd.Box(50, 60, 32, 9, 4);
                    cv.Sticker(Ink, OL, new Part(rice, White), new Part(spam, c));
                    cv.Fill(Sd.Intersect(spam, Sd.Box(50, 64, 30, 2)), c.Shade(1.25f));
                    var nori = Sd.Box(50, 47, 10, 23, 1);
                    cv.Sticker(Ink, 1.8f, new Part(nori, accent));
                    float[] gx = { 30, 36, 64, 70, 33, 67 };
                    float[] gy = { 34, 44, 36, 46, 28, 28 };
                    for (int i = 0; i < gx.Length; i++) cv.Fill(Sd.Ellipse(gx[i], gy[i], 2.4f, 1.4f, 30), Hex.C("#E9ECEF"));
                    break;
                }
                case BaitShape.Shrimp:
                {
                    var parts = new System.Collections.Generic.List<Part>();
                    parts.Add(new Part(Sd.Inflate(Sd.Poly(26, 30, 12, 22, 14, 38), 1.5f), accent));
                    float[] px = { 66, 58, 48, 38, 30 };
                    float[] py = { 62, 66, 64, 56, 44 };
                    float[] pr = { 12, 11, 10, 8.5f, 7 };
                    for (int i = 0; i < px.Length; i++) parts.Add(new Part(Sd.Circle(px[i], py[i], pr[i]), c));
                    parts.Add(new Part(Sd.Ellipse(74, 58, 12, 10, -20), c));
                    cv.Fill(Sd.Path(1f, 0.6f, 82, 62, 90, 74, 86, 88), Ink);
                    cv.Fill(Sd.Path(1f, 0.6f, 84, 60, 94, 68, 94, 82), Ink);
                    cv.Sticker(Ink, OL, parts.ToArray());
                    for (int i = 1; i < px.Length; i++) cv.Fill(Sd.Arc(px[i], py[i], pr[i] * 0.8f, 1.4f, 60f, 140f), accent);
                    for (int i = 0; i < 4; i++) cv.Fill(Sd.Capsule(60 - i * 9, 52 - i, 58 - i * 9, 44 - i, 1f), c.Shade(0.7f));
                    Eye(cv, 78, 62, 3.2f);
                    break;
                }
                case BaitShape.PineappleChunk:
                {
                    var chunk = Sd.Inflate(Sd.Poly(22, 30, 78, 30, 66, 70, 34, 70), 4f);
                    cv.Sticker(Ink, OL, new Part(chunk, c));
                    cv.Fill(Sd.Intersect(chunk, Sd.Box(50, 70, 30, 4)), accent);
                    float[] dx = { 36, 50, 64, 43, 57 };
                    float[] dy = { 42, 40, 42, 54, 54 };
                    for (int i = 0; i < dx.Length; i++) cv.Fill(Sd.Ellipse(dx[i], dy[i], 3, 1.6f), accent.WithAlpha(0.6f));
                    cv.Fill(Sd.Intersect(chunk, Sd.Ellipse(36, 60, 10, 3, 10)), Shine);
                    break;
                }
                case BaitShape.Lure:
                {
                    var ring = Sd.Ring(58, 84, 5, 2.2f);
                    var spoon = Sd.Ellipse(52, 56, 15, 26, -18);
                    cv.Fill(ring, Hex.C("#ADB5BD"), 1.4f);
                    cv.Fill(ring, Hex.C("#CED4DA"));
                    cv.Fill(spoon, Ink, OL);
                    cv.FillGradient(spoon, accent, c, 30, 82);
                    cv.Fill(Sd.Intersect(spoon, Sd.Ellipse(56, 64, 5, 14, -18)), Shine);
                    var hook = Sd.Union(Sd.Arc(46, 22, 7, 2.4f, 180f, 360f), Sd.Capsule(53, 22, 53, 32, 1.2f));
                    cv.Fill(hook, Hex.C("#868E96"), 1.2f);
                    cv.Fill(hook, Hex.C("#CED4DA"));
                    Sparkle(cv, 26, 76, 7f, Hex.C("#FFF4B0"));
                    Sparkle(cv, 80, 40, 5f, Hex.C("#FFF4B0"));
                    break;
                }
            }
            return cv;
        }

        /// <summary>장소 썸네일 (디자인 160 x 100).</summary>
        public static SdfCanvas PaintLocation(LocationTheme theme, SkyColors sky, WaterColors water, int width)
        {
            int height = Mathf.RoundToInt(width * 100f / 160f);
            var cv = new SdfCanvas(width, height, 160f);
            var frame = Sd.Box(80, 50, 76, 46, 10);
            cv.Fill(frame, Ink, 2.5f);
            cv.FillGradient(frame, sky.horizon, sky.top, 40, 96);
            var sea = Sd.Intersect(frame, Sd.HalfPlane(0, 40, 0, 1));
            switch (theme)
            {
                case LocationTheme.Beach:
                    cv.Fill(Sd.Circle(118, 72, 9), Hex.C("#FFE066"));
                    cv.Fill(Sd.Intersect(frame, Sd.Poly(96, 40, 116, 58, 130, 52, 150, 40)), Hex.C("#6B8F71"));
                    cv.FillGradient(sea, water.deep, water.surface, 4, 40);
                    cv.Fill(Sd.Intersect(frame, Sd.Poly(4, 40, 70, 40, 52, 20, 4, 18)), Hex.C("#F4D9A0"));
                    cv.Fill(Sd.Path(2.6f, 1.8f, 30, 34, 34, 56, 42, 74), Hex.C("#8D6E63"));
                    for (int i = 0; i < 5; i++)
                    {
                        float a = (100f + i * 40f) * Mathf.Deg2Rad;
                        cv.Fill(Sd.Ellipse(42 + Mathf.Cos(a) * 9f, 74 + Mathf.Sin(a) * 4f, 11, 3.2f, (100f + i * 40f) * 0.5f - 20f), Hex.C("#2F9E44"));
                    }
                    cv.Fill(Sd.Ellipse(58, 30, 3, 10, -15), Hex.C("#FF6B6B"));
                    break;
                case LocationTheme.Pier:
                    cv.Fill(Sd.Circle(120, 70, 8), Hex.C("#FFE066"));
                    cv.Fill(Sd.Intersect(frame, Sd.Ellipse(140, 40, 18, 6)), Hex.C("#5C940D"));
                    cv.FillGradient(sea, water.deep, water.surface, 4, 40);
                    for (int i = 0; i < 4; i++) cv.Fill(Sd.Intersect(frame, Sd.Ellipse(70 + i * 22f, 14, 6, 9)), Hex.C(i % 2 == 0 ? "#FF8787" : "#FFA94D"));
                    cv.Fill(Sd.Box(40, 46, 38, 3.5f), Hex.C("#A9714B"));
                    for (int i = 0; i < 4; i++) cv.Fill(Sd.Intersect(frame, Sd.Box(10 + i * 20f, 28, 2.2f, 16)), Hex.C("#7B5134"));
                    break;
                case LocationTheme.Volcano:
                    cv.Fill(Sd.Intersect(frame, Sd.Poly(60, 40, 96, 82, 112, 82, 150, 40)), Hex.C("#4A2C2A"));
                    cv.Fill(Sd.Intersect(frame, Sd.Poly(96, 82, 112, 82, 110, 76, 98, 76)), Hex.C("#FF6B1A"));
                    cv.Fill(Sd.Path(1.6f, 3f, 104, 78, 100, 64, 106, 52, 102, 40), Hex.C("#FF8C1A"));
                    cv.Fill(Sd.Circle(100, 88, 6), new Color(0.6f, 0.55f, 0.55f, 0.8f));
                    cv.Fill(Sd.Circle(110, 92, 5), new Color(0.6f, 0.55f, 0.55f, 0.7f));
                    cv.FillGradient(sea, water.deep, water.surface, 4, 40);
                    cv.Fill(Sd.Intersect(frame, Sd.Poly(4, 42, 56, 42, 48, 30, 4, 24)), Hex.C("#2B2B2B"));
                    break;
                default:
                    cv.Fill(Sd.Arc(80, 30, 46, 4f, 20f, 160f), new Color(1f, 0.5f, 0.5f, 0.7f));
                    cv.Fill(Sd.Arc(80, 30, 41, 4f, 20f, 160f), new Color(1f, 0.85f, 0.4f, 0.7f));
                    cv.Fill(Sd.Arc(80, 30, 36, 4f, 20f, 160f), new Color(0.5f, 0.85f, 1f, 0.7f));
                    cv.FillGradient(sea, water.deep, water.surface, 4, 40);
                    for (int i = 0; i < 7; i++) cv.Fill(Sd.Intersect(frame, Sd.Circle(10 + i * 24f, 38 + (i % 2) * 4f, 12)), Color.white);
                    cv.Fill(Sd.Circle(34, 70, 7), Color.white);
                    cv.Fill(Sd.Circle(44, 73, 9), Color.white);
                    cv.Fill(Sd.Circle(54, 70, 6), Color.white);
                    break;
            }
            return cv;
        }
    }
}
