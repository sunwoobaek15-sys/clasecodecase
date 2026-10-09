using System;
using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 사진 같은 하와이 배경 (외곽선 없는 회화풍): 키 큰 야자수, 뭉게구름, 먼 바다, 쿠알로아 능선, 잔디, 용암 바위 등.
    /// 디자인 단위 = 1cm (월드 1 = 100). 순수 C# 이라 오프라인 미리보기에서도 그대로 그려진다.
    /// </summary>
    public static class ScenicPainter
    {
        // ================================================================ 공용 도구

        static float Clamp01(float v) { return v < 0f ? 0f : (v > 1f ? 1f : v); }

        static float Smooth(float e0, float e1, float x)
        {
            float t = Clamp01((x - e0) / (e1 - e0));
            return t * t * (3f - 2f * t);
        }

        static float Hash(int x, int y, int seed)
        {
            unchecked
            {
                int h = x * 374761393 + y * 668265263 + seed * 1442695041;
                h = (h ^ (h >> 13)) * 1274126177;
                h ^= h >> 16;
                return (h & 0x7fffffff) / 2147483647f;
            }
        }

        /// <summary>값 노이즈 0~1.</summary>
        public static float Noise(float x, float y, int seed)
        {
            int xi = Mathf.FloorToInt(x), yi = Mathf.FloorToInt(y);
            float fx = x - xi, fy = y - yi;
            float u = fx * fx * (3f - 2f * fx), v = fy * fy * (3f - 2f * fy);
            float a = Hash(xi, yi, seed), b = Hash(xi + 1, yi, seed);
            float c = Hash(xi, yi + 1, seed), d = Hash(xi + 1, yi + 1, seed);
            return Mathf.Lerp(Mathf.Lerp(a, b, u), Mathf.Lerp(c, d, u), v);
        }

        /// <summary>프랙탈 노이즈 0~1.</summary>
        public static float Fbm(float x, float y, int seed, int octaves = 4)
        {
            float sum = 0f, amp = 0.5f, norm = 0f;
            for (int i = 0; i < octaves; i++)
            {
                sum += Noise(x, y, seed + i * 31) * amp;
                norm += amp;
                x *= 2.03f; y *= 2.03f; amp *= 0.5f;
            }
            return sum / norm;
        }

        static Color Mul(Color c, float k)
        {
            return new Color(c.r * k, c.g * k, c.b * k, c.a);
        }

        static SdfCanvas Canvas(float wCm, float hCm, float ppu)
        {
            float k = ppu / 100f;
            return new SdfCanvas(Mathf.Max(1, Mathf.RoundToInt(wCm * k)), Mathf.Max(1, Mathf.RoundToInt(hCm * k)), wCm);
        }

        /// <summary>높이 함수를 캔버스 픽셀 간격으로 미리 계산해 둔다 (노이즈 계산을 픽셀마다 반복하지 않게).</summary>
        static Func<float, float> Cached(Func<float, float> h, float x0, float x1, int samples)
        {
            samples = Math.Max(2, samples);
            var v = new float[samples + 1];
            for (int i = 0; i <= samples; i++) v[i] = h(x0 + (x1 - x0) * i / samples);
            return x =>
            {
                float t = (x - x0) / (x1 - x0) * samples;
                if (t <= 0f) return v[0];
                if (t >= samples) return v[samples];
                int i = (int)t;
                return v[i] + (v[i + 1] - v[i]) * (t - i);
            };
        }

        /// <summary>윗면이 높이 함수인 도형 (산 능선, 모래사장, 해안 숲). 아래는 y=0 까지 채움.</summary>
        sealed class HeightField : Shape
        {
            readonly Func<float, float> _h;
            readonly float _x0, _x1, _maxH;

            public HeightField(Func<float, float> h, float x0, float x1, float maxH)
            {
                _h = h; _x0 = x0; _x1 = x1; _maxH = maxH;
            }

            public override float Dist(float x, float y)
            {
                if (x < _x0 || x > _x1) return 1e4f;
                float h = _h(x);
                float slope = (_h(x + 0.5f) - _h(x - 0.5f));
                float dTop = (y - h) / (float)Math.Sqrt(1f + slope * slope);
                return Math.Max(dTop, -y);
            }

            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                x0 = _x0; x1 = _x1; y0 = 0f; y1 = _maxH;
            }
        }

        // ================================================================ 야자수

        public struct PalmStyle
        {
            public Color trunkLit, trunkShadow, ring;
            public Color leafLit, leafMid, leafDark, leafTip;
            public Color nut;
        }

        /// <summary>사진 1 (와이키키): 짙은 회갈색 줄기, 햇빛 받은 연두~초록 잎.</summary>
        public static readonly PalmStyle WaikikiPalm = new PalmStyle
        {
            trunkLit = Hex.C("#8C7F70"), trunkShadow = Hex.C("#3A3430"), ring = Hex.C("#2E2925"),
            leafLit = Hex.C("#AFC24E"), leafMid = Hex.C("#5E8430"), leafDark = Hex.C("#2B4620"), leafTip = Hex.C("#D3CF82"),
            nut = Hex.C("#6B5A33"),
        };

        /// <summary>사진 3 (기울어진 야자수): 밝은 회색 줄기, 진한 초록 잎.</summary>
        public static readonly PalmStyle LeaningPalm = new PalmStyle
        {
            trunkLit = Hex.C("#D9D2C4"), trunkShadow = Hex.C("#8F887C"), ring = Hex.C("#7A7268"),
            leafLit = Hex.C("#8FD14F"), leafMid = Hex.C("#4FA33A"), leafDark = Hex.C("#2B6E2A"), leafTip = Hex.C("#C3E07A"),
            nut = Hex.C("#7A6A38"),
        };

        public struct PalmShape
        {
            /// <summary>줄기 길이 (cm).</summary>
            public float trunkLen;
            /// <summary>밑동 기울기 (도, 수직 기준, + = 오른쪽).</summary>
            public float baseAngle;
            /// <summary>꼭대기 기울기 (도).</summary>
            public float topAngle;
            /// <summary>S자 휘어짐 (도).</summary>
            public float sway;
            public float rBase, rTop;
            public int fronds;
            public float frondLen;
            public float leafletLen;
            public int deadFronds;
            public int seed;
        }

        /// <summary>줄기 중심선 위의 가장 가까운 점 → (진행률 t, 좌우 위치 u: 왼쪽 -1 ~ 오른쪽 +1).</summary>
        sealed class TrunkFrame
        {
            readonly Vector2[] _p;
            readonly float[] _r;
            readonly float[] _len;
            readonly float _total;

            public TrunkFrame(Vector2[] p, float[] r)
            {
                _p = p; _r = r;
                _len = new float[p.Length];
                for (int i = 1; i < p.Length; i++) _len[i] = _len[i - 1] + Vector2.Distance(p[i - 1], p[i]);
                _total = _len[p.Length - 1];
            }

            public float Total => _total;

            public void Project(float x, float y, out float along, out float u)
            {
                float best = float.MaxValue;
                along = 0f; u = 0f;
                for (int i = 0; i < _p.Length - 1; i++)
                {
                    var a = _p[i]; var b = _p[i + 1];
                    float bx = b.x - a.x, by = b.y - a.y;
                    float l2 = bx * bx + by * by;
                    float h = l2 > 1e-6f ? Mathf.Clamp01(((x - a.x) * bx + (y - a.y) * by) / l2) : 0f;
                    float dx = x - (a.x + bx * h), dy = y - (a.y + by * h);
                    float d2 = dx * dx + dy * dy;
                    if (d2 < best)
                    {
                        best = d2;
                        float l = Mathf.Sqrt(l2);
                        float r = Mathf.Lerp(_r[i], _r[i + 1], h);
                        // 진행 방향의 오른쪽 법선 (by, -bx)
                        float side = l > 1e-4f ? (dx * by - dy * bx) / l : 0f;
                        u = side / Mathf.Max(0.01f, r);
                        along = _len[i] + l * h;
                    }
                }
            }
        }

        /// <summary>
        /// 사진 같은 야자수 한 그루. 피벗 = 밑동. ppu 를 낮추면 멀리 있는 작은 야자수용 (잎 두께는 최소 1px 유지).
        /// </summary>
        public static PaintedSprite Palm(PalmShape s, PalmStyle st, float ppu)
        {
            var rnd = new System.Random(s.seed);
            float pxPerCm = ppu / 100f;
            float minW = 0.75f / pxPerCm; // 최소 굵기 (cm) — 0.75px

            // ---- 줄기 중심선 (각도를 적분해서 자연스러운 곡선)
            const int N = 28;
            var pts = new Vector2[N + 1];
            var rad = new float[N + 1];
            pts[0] = Vector2.zero;
            for (int k = 0; k < N; k++)
            {
                float t = (k + 0.5f) / N;
                float ang = (s.baseAngle + (s.topAngle - s.baseAngle) * Mathf.Pow(t, 1.6f) + s.sway * Mathf.Sin(t * Mathf.PI * 1.8f)) * Mathf.Deg2Rad;
                pts[k + 1] = pts[k] + new Vector2(Mathf.Sin(ang), Mathf.Cos(ang)) * (s.trunkLen / N);
            }
            for (int k = 0; k <= N; k++)
            {
                float t = (float)k / N;
                rad[k] = Mathf.Lerp(s.rBase, s.rTop, Mathf.Pow(t, 0.7f)) * (1f + 0.45f * Mathf.Exp(-t * 26f));
            }
            Vector2 top = pts[N];
            Vector2 tdir = (pts[N] - pts[N - 1]).normalized;
            Vector2 crown = top + tdir * 6f;

            // ---- 잎(프론드) 설계: 방위각 ψ, 고도각 φ
            int F = Mathf.Max(5, s.fronds);
            var fr = new List<Frond>();
            for (int i = 0; i < F; i++)
            {
                float psi = 360f * i / F + (float)(rnd.NextDouble() * 24.0 - 12.0);
                // 고도각: 위로 솟은 어린 잎 몇 장 + 대부분은 옆으로 뻗다가 아치형으로 처짐
                float q = (i * 0.618f + (float)rnd.NextDouble() * 0.35f) % 1f;
                float phi = Mathf.Lerp(62f, -30f, Mathf.Pow(q, 0.8f));
                float len = s.frondLen * Mathf.Lerp(0.85f, 1.08f, (float)rnd.NextDouble()) * (phi > 45f ? 0.7f : 1f);
                fr.Add(new Frond { psi = psi, phi = phi, len = len, dead = false, seed = s.seed * 31 + i });
            }
            for (int i = 0; i < s.deadFronds; i++)
            {
                float psi = (float)(rnd.NextDouble() * 360.0);
                fr.Add(new Frond { psi = psi, phi = -78f + (float)rnd.NextDouble() * 10f, len = s.frondLen * 0.62f, dead = true, seed = s.seed * 57 + i });
            }

            // ---- 캔버스 크기: 줄기 + 잎이 들어가게 bounds 계산
            float minX = 0f, maxX = 0f, maxY = 0f;
            foreach (var p in pts) { minX = Mathf.Min(minX, p.x); maxX = Mathf.Max(maxX, p.x); maxY = Mathf.Max(maxY, p.y); }
            float reach = s.frondLen * 1.12f + s.leafletLen;
            minX = Mathf.Min(minX, crown.x - reach);
            maxX = Mathf.Max(maxX, crown.x + reach);
            maxY = Mathf.Max(maxY, crown.y + s.frondLen * 0.75f + s.leafletLen * 0.4f);
            float margin = 6f;
            float W = maxX - minX + margin * 2f;
            float H = maxY + margin;
            float ox = -minX + margin;
            var cv = Canvas(W, H, ppu);
            for (int k = 0; k <= N; k++) pts[k].x += ox;
            crown.x += ox;

            // ---- 그리기 순서: 뒤쪽 잎 → 줄기 → 죽은 잎/열매 → 앞쪽 잎
            fr.Sort((a, b) => Depth(a).CompareTo(Depth(b)));
            foreach (var f in fr) if (!f.dead && Depth(f) < -0.15f) DrawFrond(cv, crown, f, s, st, minW, rnd);
            DrawTrunk(cv, pts, rad, st, s.seed);
            foreach (var f in fr) if (f.dead) DrawFrond(cv, crown, f, s, st, minW, rnd);
            DrawNuts(cv, crown, s, st, rnd);
            foreach (var f in fr) if (!f.dead && Depth(f) >= -0.15f) DrawFrond(cv, crown, f, s, st, minW, rnd);

            return new PaintedSprite(cv, new Vector2(ox / W, 0f), ppu);
        }

        struct Frond
        {
            public float psi, phi, len;
            public bool dead;
            public int seed;
            /// <summary>0 이면 고도각으로 자동 계산.</summary>
            public float droop;
        }

        static float Depth(Frond f)
        {
            return Mathf.Cos(f.phi * Mathf.Deg2Rad) * Mathf.Sin(f.psi * Mathf.Deg2Rad);
        }

        static void DrawTrunk(SdfCanvas cv, Vector2[] pts, float[] rad, PalmStyle st, int seed)
        {
            var frame = new TrunkFrame(pts, rad);
            float ringGap = 6.5f;
            Func<float, float, Color> shade = (x, y) =>
            {
                float along, u;
                frame.Project(x, y, out along, out u);
                // 원통 음영: 왼쪽 위에서 햇빛
                float shade = Smooth(-0.95f, 0.85f, u);
                var c = Color.Lerp(st.trunkLit, st.trunkShadow, 0.12f + shade * 0.88f);
                // 세로 결 노이즈
                float n = Fbm(u * 2.2f + 7f, along * 0.045f, seed, 3);
                c = Mul(c, 0.86f + n * 0.28f);
                // 고리 무늬 (가운데가 살짝 아래로 휜 줄)
                float ring = (along + u * u * 2.2f) / ringGap;
                float fr = ring - Mathf.Floor(ring);
                float wobble = Noise(along * 0.11f, 3.3f, seed + 5);
                if (fr < 0.16f + wobble * 0.08f) c = Color.Lerp(c, st.ring, 0.55f * (1f - fr / 0.24f) * (0.6f + 0.4f * (1f - shade)));
                // 밑동은 모래에 묻혀 살짝 밝게
                if (along < 14f) c = Color.Lerp(c, st.trunkLit, (1f - along / 14f) * 0.25f);
                c.a = 1f;
                return c;
            };
            // 마디마다 따로 칠한다 (통째 Union 은 기울어진 줄기에서 bounds 가 너무 커져 느림)
            for (int i = 0; i < pts.Length - 1; i++)
                cv.FillShaded(Sd.Capsule(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, rad[i], rad[i + 1]), shade);
        }

        static void DrawNuts(SdfCanvas cv, Vector2 crown, PalmShape s, PalmStyle st, System.Random rnd)
        {
            float r = Mathf.Max(4.5f, s.rTop * 0.95f);
            for (int i = 0; i < 6; i++)
            {
                float a = (200f + i * 28f) * Mathf.Deg2Rad;
                float cx = crown.x + Mathf.Cos(a) * r * 1.3f;
                float cy = crown.y - 4f + Mathf.Sin(a) * r * 0.9f;
                var nut = Sd.Circle(cx, cy, r);
                var baseC = i % 3 == 0 ? Hex.C("#7D8A3A") : st.nut;
                cv.FillShaded(nut, (x, y) =>
                {
                    float l = Clamp01(0.55f + ((cx - x) * 0.5f + (y - cy) * 0.8f) / r * 0.5f);
                    var c = Color.Lerp(Mul(baseC, 0.55f), Mul(baseC, 1.15f), l);
                    c.a = 1f;
                    return c;
                });
            }
        }

        /// <summary>잎 하나: 굽은 잎자루(rachis) + 양쪽으로 늘어진 작은 잎(pinnae).</summary>
        static void DrawFrond(SdfCanvas cv, Vector2 crown, Frond f, PalmShape s, PalmStyle st, float minW, System.Random rnd)
        {
            float phi = f.phi * Mathf.Deg2Rad, psi = f.psi * Mathf.Deg2Rad;
            float cosPsi = Mathf.Cos(psi), sinPsi = Mathf.Sin(psi);
            float depth = Mathf.Cos(phi) * sinPsi;
            float droop = f.dead ? 0.05f : (f.droop > 0f ? f.droop : 0.48f + 0.5f * (1f - Mathf.Sin(phi)) * 0.5f);
            float L = f.len;

            // 색: 앞쪽·위쪽 잎은 밝게, 뒤쪽·아래쪽은 어둡게
            float light = Clamp01(0.42f + depth * 0.3f + Mathf.Sin(phi) * 0.55f + (Hash(f.seed, 3, 9) - 0.5f) * 0.25f);
            Color baseC = f.dead ? Hex.C("#8A6B3F") : Color.Lerp(st.leafDark, st.leafLit, light);
            Color midC = f.dead ? Hex.C("#6E5230") : Color.Lerp(st.leafDark, st.leafMid, 0.4f + light * 0.6f);

            const int SEG = 16;
            var rach = new Vector2[SEG + 1];
            for (int i = 0; i <= SEG; i++)
            {
                float t = (float)i / SEG;
                float hor = L * t * Mathf.Cos(phi);
                float ver = L * t * Mathf.Sin(phi) - droop * L * t * t;
                if (f.dead) ver = -L * t;
                rach[i] = new Vector2(crown.x + hor * cosPsi + (f.dead ? Mathf.Sin(t * 3f) * 3f : 0f), crown.y + ver);
            }

            // 작은 잎: 먼 쪽(-) 먼저, 잎자루, 가까운 쪽(+)
            float ll = s.leafletLen * (f.dead ? 0.55f : 1f);
            int count = Mathf.Max(8, Mathf.RoundToInt(L / 3.9f));
            for (int pass = 0; pass < 2; pass++)
            {
                float sideSign = pass == 0 ? -1f : 1f;
                if (depth < 0f) sideSign = -sideSign;
                for (int k = 0; k < count; k++)
                {
                    float t = 0.1f + 0.9f * (k + 0.5f) / count;
                    float ft = t * SEG;
                    int i0 = Mathf.Min(SEG - 1, (int)ft);
                    Vector2 p = Vector2.Lerp(rach[i0], rach[i0 + 1], ft - i0);
                    Vector2 tan = (rach[i0 + 1] - rach[i0]).normalized;
                    float len = ll * Mathf.Pow(Mathf.Sin(Mathf.PI * Mathf.Lerp(0.18f, 0.96f, t)), 0.6f) * Mathf.Lerp(1.05f, 0.55f, t);
                    len *= 0.85f + (float)rnd.NextDouble() * 0.4f;
                    // 3D: 옆(잎자루와 수직, 수평) 방향은 화면에서 x = ∓sinψ, 아래로 처짐 + 끝 쪽으로 기울어짐
                    float droopAng = Mathf.Lerp(50f, 74f, t) * Mathf.Deg2Rad;
                    float sideX = -sinPsi * sideSign;
                    Vector2 dir = new Vector2(sideX * Mathf.Cos(droopAng), -Mathf.Sin(droopAng)) + tan * 0.42f;
                    if (f.dead) dir = new Vector2(sideSign * 0.35f, -1f);
                    dir.Normalize();
                    // 삐죽삐죽하게: 방향 ±12도
                    float jit = ((float)rnd.NextDouble() - 0.5f) * 24f * Mathf.Deg2Rad;
                    dir = new Vector2(dir.x * Mathf.Cos(jit) - dir.y * Mathf.Sin(jit), dir.x * Mathf.Sin(jit) + dir.y * Mathf.Cos(jit));
                    Vector2 e = p + dir * len;
                    // 살짝 휘게: 중간점을 아래로
                    Vector2 m = (p + e) * 0.5f + new Vector2(0f, -len * 0.08f);
                    float w0 = Mathf.Max(minW, 1.15f), w1 = Mathf.Max(minW * 0.6f, 0.3f);
                    float n = Noise(k * 0.7f, f.seed * 0.13f + pass, f.seed);
                    float pick = (float)rnd.NextDouble();
                    var c = pick < 0.3f ? Color.Lerp(st.leafDark, midC, n) : Color.Lerp(midC, baseC, 0.25f + n * 0.75f);
                    if (pass == 0) c = Mul(c, 0.78f);
                    var leaf = Sd.Union(Sd.Capsule(p.x, p.y, m.x, m.y, w0, (w0 + w1) * 0.5f), Sd.Capsule(m.x, m.y, e.x, e.y, (w0 + w1) * 0.5f, w1));
                    // 끝은 햇빛에 바랜 색
                    var tip = Color.Lerp(c, f.dead ? Hex.C("#B08D5A") : st.leafTip, 0.2f + 0.45f * light * light);
                    float lx = p.x, ly = p.y, ex = e.x, ey = e.y;
                    cv.FillShaded(leaf, (x, y) =>
                    {
                        float along = Clamp01(((x - lx) * (ex - lx) + (y - ly) * (ey - ly)) / Mathf.Max(1f, (ex - lx) * (ex - lx) + (ey - ly) * (ey - ly)));
                        var cc = Color.Lerp(c, tip, along * along);
                        cc.a = 1f;
                        return cc;
                    });
                }
                if (pass == 0)
                {
                    // 잎자루 (마디별로)
                    var stem = f.dead ? Hex.C("#7A5C36") : Color.Lerp(midC, st.leafTip, 0.25f);
                    for (int i = 0; i < SEG; i++)
                    {
                        float r0 = Mathf.Max(minW, Mathf.Lerp(2.4f, 0.5f, (float)i / SEG));
                        float r1 = Mathf.Max(minW, Mathf.Lerp(2.4f, 0.5f, (float)(i + 1) / SEG));
                        cv.Fill(Sd.Capsule(rach[i].x, rach[i].y, rach[i + 1].x, rach[i + 1].y, r0, r1), stem);
                    }
                }
            }
        }

        /// <summary>사진 1 의 키 큰 야자수 (variant 0~3).</summary>
        public static PaintedSprite TallPalm(int variant, float ppu = 100f)
        {
            PalmShape s;
            switch (variant % 4)
            {
                case 0:
                    s = new PalmShape { trunkLen = 560f, baseAngle = 5f, topAngle = -4f, sway = 3f, rBase = 8.5f, rTop = 5.5f, fronds = 15, frondLen = 150f, leafletLen = 52f, deadFronds = 2, seed = 11 };
                    break;
                case 1:
                    s = new PalmShape { trunkLen = 470f, baseAngle = -6f, topAngle = 6f, sway = -4f, rBase = 7.5f, rTop = 5f, fronds = 14, frondLen = 135f, leafletLen = 48f, deadFronds = 1, seed = 23 };
                    break;
                case 2:
                    s = new PalmShape { trunkLen = 520f, baseAngle = 9f, topAngle = 2f, sway = 2f, rBase = 8f, rTop = 5.2f, fronds = 13, frondLen = 140f, leafletLen = 50f, deadFronds = 2, seed = 37 };
                    break;
                default:
                    s = new PalmShape { trunkLen = 600f, baseAngle = 2f, topAngle = -7f, sway = 4f, rBase = 8.8f, rTop = 5.6f, fronds = 16, frondLen = 155f, leafletLen = 54f, deadFronds = 2, seed = 53 };
                    break;
            }
            return Palm(s, WaikikiPalm, ppu);
        }

        /// <summary>사진 3 의 해변 쪽으로 길게 기운 야자수.</summary>
        public static PaintedSprite LeaningPalmTree(float ppu = 100f)
        {
            var s = new PalmShape { trunkLen = 720f, baseAngle = 64f, topAngle = 34f, sway = -3f, rBase = 9f, rTop = 5.8f, fronds = 15, frondLen = 150f, leafletLen = 52f, deadFronds = 1, seed = 71 };
            return Palm(s, LeaningPalm, ppu);
        }

        /// <summary>멀리 있는 작은 야자수 (해변 뒤쪽 / 해안선). 같은 그림을 낮은 해상도로.</summary>
        public static PaintedSprite DistantPalm(int variant)
        {
            var s = new PalmShape
            {
                trunkLen = variant % 2 == 0 ? 520f : 470f,
                baseAngle = variant % 2 == 0 ? 7f : -5f,
                topAngle = variant % 2 == 0 ? -3f : 5f,
                sway = 3f, rBase = 9f, rTop = 6.5f, fronds = 12, frondLen = 140f, leafletLen = 40f, deadFronds = 1,
                seed = 90 + variant,
            };
            return Palm(s, WaikikiPalm, 32f);
        }

        /// <summary>사진 3 의 왼쪽 위 모서리를 덮는 큰 잎 (앞쪽, 역광이라 진한 초록). 피벗 = 왼쪽 위.</summary>
        public static PaintedSprite CornerFronds()
        {
            var cv = Canvas(640f, 420f, 60f);
            var st = new PalmStyle
            {
                leafLit = Hex.C("#8FCB52"), leafMid = Hex.C("#4C9234"), leafDark = Hex.C("#235A22"), leafTip = Hex.C("#B9DD78"),
            };
            var shape = new PalmShape { leafletLen = 120f, seed = 7 };
            var rnd = new System.Random(7);
            var crown = new Vector2(-40f, 455f);
            float[] psi = { 48f, -40f, 64f, 20f, -14f, 34f, 4f, -26f };
            float[] phi = { 6f, -18f, 16f, 10f, -4f, -26f, -38f, -50f };
            float[] len = { 420f, 360f, 380f, 560f, 520f, 460f, 400f, 330f };
            float[] droop = { 0.3f, 0.36f, 0.26f, 0.34f, 0.4f, 0.3f, 0.26f, 0.22f };
            for (int i = 0; i < psi.Length; i++)
                DrawFrond(cv, crown, new Frond { psi = psi[i], phi = phi[i], len = len[i], seed = 300 + i, droop = droop[i] }, shape, st, 1.1f, rnd);
            return new PaintedSprite(cv, new Vector2(0f, 1f), 60f);
        }

        // ================================================================ 구름

        /// <summary>
        /// 사진 2·4 의 뭉게구름: 평평한 밑면, 울퉁불퉁한 윗부분. 구름 전체 SDF 를 빛 방향으로 짚어 보는 방식으로
        /// 바깥 가장자리는 하얗게, 안쪽·아래쪽은 푸른 회색으로 칠한다 (거품 하나하나에 테두리가 생기지 않게).
        /// </summary>
        public static PaintedSprite Cumulus(int seed, float wCm, float hCm)
        {
            const float ppu = 40f;
            var rnd = new System.Random(seed);
            float margin = 30f;
            float W = wCm + margin * 2f, H = hCm + margin * 2f;
            var cv = Canvas(W, H, ppu);
            float baseY = margin;
            var blobs = new List<Shape>();
            int nBase = 5;
            for (int i = 0; i < nBase; i++)
            {
                float u = (i + 0.5f) / nBase;
                float r = hCm * Mathf.Lerp(0.3f, 0.46f, 1f - Mathf.Abs(u - 0.5f) * 2f) * Mathf.Lerp(0.85f, 1.15f, (float)rnd.NextDouble());
                blobs.Add(Sd.Circle(margin + wCm * Mathf.Lerp(0.1f, 0.9f, u), baseY + r * 0.7f, r));
            }
            for (int i = 0; i < 5; i++)
            {
                float u = Mathf.Lerp(0.22f, 0.78f, (i + (float)rnd.NextDouble() * 0.7f) / 5f);
                float dome = 1f - Mathf.Pow(Mathf.Abs(u - 0.5f) * 2f, 1.5f);
                float r = hCm * Mathf.Lerp(0.26f, 0.4f, (float)rnd.NextDouble());
                blobs.Add(Sd.Circle(margin + wCm * u, baseY + hCm * (0.3f + 0.36f * dome), r));
            }
            for (int i = 0; i < 7; i++)
            {
                float u = Mathf.Lerp(0.18f, 0.82f, (float)rnd.NextDouble());
                float dome = 1f - Mathf.Pow(Mathf.Abs(u - 0.5f) * 2f, 1.3f);
                float r = hCm * Mathf.Lerp(0.13f, 0.24f, (float)rnd.NextDouble());
                blobs.Add(Sd.Circle(margin + wCm * u, baseY + hCm * (0.58f + 0.38f * dome) - r * 0.7f, r));
            }
            var body = Sd.Union(blobs.ToArray());
            var cloud = Sd.Intersect(body, Sd.HalfPlane(0f, baseY, 0f, -1f));
            var lit = Color.white;
            var mid = Hex.C("#EBF0F7");
            var shadow = Hex.C("#B3C0D3");
            var L = new Vector2(-0.42f, 0.9f).normalized;
            float k1 = hCm * 0.1f, k2 = hCm * 0.3f;
            cv.FillShaded(cloud, (x, y) =>
            {
                // 빛 쪽으로 조금/많이 가 봤을 때 아직 구름 안이면 그만큼 그늘
                float d1 = body.Dist(x + L.x * k1, y + L.y * k1);
                float d2 = body.Dist(x + L.x * k2, y + L.y * k2);
                float occ = Clamp01(-d1 / k1) * 0.25f + Clamp01(-d2 / k2) * 0.75f;
                occ = occ * occ * (3f - 2f * occ);
                float v = Clamp01((y - baseY) / hCm);
                var c = occ < 0.5f ? Color.Lerp(lit, mid, occ * 2f) : Color.Lerp(mid, shadow, (occ - 0.5f) * 2f);
                c = Color.Lerp(shadow, c, 0.35f + 0.65f * Smooth(0f, 0.45f, v));
                float n = Fbm(x * 0.015f, y * 0.015f, seed, 3);
                c = Mul(c, 0.97f + n * 0.05f);
                c.a = 1f;
                return c;
            }, 6f / (ppu / 100f));
            return new PaintedSprite(cv, new Vector2(0.5f, margin / H), ppu);
        }

        struct Blob
        {
            public float x, y, r;
            public Blob(float x, float y, float r) { this.x = x; this.y = y; this.r = r; }
        }

        /// <summary>사진 1 의 수평선 근처 옅은 새털구름.</summary>
        public static PaintedSprite Wisps(int seed)
        {
            const float ppu = 40f;
            var rnd = new System.Random(seed);
            var cv = Canvas(900f, 120f, ppu);
            for (int i = 0; i < 9; i++)
            {
                float x = 80f + (float)rnd.NextDouble() * 740f;
                float y = 30f + (float)rnd.NextDouble() * 60f;
                float rx = 40f + (float)rnd.NextDouble() * 120f;
                float ry = 5f + (float)rnd.NextDouble() * 8f;
                cv.FillSoft(Sd.Ellipse(x, y, rx, ry, (float)rnd.NextDouble() * 6f - 3f), new Color(1f, 1f, 1f, 0.35f + (float)rnd.NextDouble() * 0.3f), ry * 0.9f);
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 0.5f), ppu);
        }

        // ================================================================ 먼 바다

        /// <summary>
        /// 먼 바다 띠 위의 흰 파도 (사진 1 의 리프 브레이크, 사진 3·4 의 흰 물결).
        /// 피벗 = 위쪽 가운데 (수평선). 높이 = 수평선~수면 거리.
        /// </summary>
        public static PaintedSprite SurfLines(int seed, float wCm, float hCm)
        {
            const float ppu = 60f;
            var rnd = new System.Random(seed);
            var cv = Canvas(wCm, hCm, ppu);
            float px = 100f / ppu;
            // 깊이 0 = 수평선, 1 = 가까운 쪽
            float[] rows = { 0.16f, 0.45f, 0.78f };
            float[] power = { 0.4f, 1f, 0.55f };
            for (int r = 0; r < rows.Length; r++)
            {
                float d = rows[r];
                float baseY = hCm * (1f - d);
                float x = (float)rnd.NextDouble() * 80f;
                while (x < wCm)
                {
                    // 파도 덩어리: 길이·두께·간격이 제각각
                    float len = Mathf.Lerp(40f, 380f, Mathf.Pow((float)rnd.NextDouble(), 1.4f)) * Mathf.Lerp(0.5f, 1.2f, d) * (r == 1 ? 2.2f : 1f);
                    float gap = Mathf.Lerp(30f, 320f, (float)rnd.NextDouble()) * (r == 1 ? 0.18f : 1.2f);
                    float y = baseY + ((float)rnd.NextDouble() - 0.5f) * hCm * 0.08f;
                    float thick = Mathf.Lerp(0.8f, 2.6f, d) * px * Mathf.Lerp(0.7f, 1.3f, (float)rnd.NextDouble());
                    float a = power[r] * Mathf.Lerp(0.45f, 0.95f, (float)rnd.NextDouble());
                    int segs = 3 + rnd.Next(3);
                    float prevX = x, prevY = y;
                    for (int k = 1; k <= segs; k++)
                    {
                        float nx = x + len * k / segs;
                        float ny = y + ((float)rnd.NextDouble() - 0.5f) * thick * 2f;
                        float t0 = Mathf.Sin(Mathf.PI * (k - 1f) / segs), t1 = Mathf.Sin(Mathf.PI * (float)k / segs);
                        cv.FillSoft(Sd.Capsule(prevX, prevY, nx, ny, thick * (0.4f + t0), thick * (0.4f + t1)), new Color(1f, 1f, 1f, a), thick);
                        prevX = nx; prevY = ny;
                    }
                    // 부서진 거품이 앞쪽(아래)으로 번짐
                    cv.FillSoft(Sd.Ellipse(x + len * 0.5f, y - thick * 2.5f, len * 0.42f, thick * 2.4f), new Color(1f, 1f, 1f, a * 0.22f), thick * 2.2f);
                    x += len + gap;
                }
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 1f), ppu);
        }

        /// <summary>사진 2 의 맑은 청록 물 아래 비치는 산호초 얼룩 (먼 바다 띠 위에 깔림). 피벗 = 위쪽 가운데.</summary>
        public static PaintedSprite ReefPatches(int seed, float wCm, float hCm)
        {
            const float ppu = 50f;
            var cv = Canvas(wCm, hCm, ppu);
            var dark = Hex.C("#3E6458");
            var olive = Hex.C("#5E7A5C");
            var sandy = Hex.C("#A9E3D6");
            var full = Sd.Box(wCm * 0.5f, hCm * 0.5f, wCm * 0.5f, hCm * 0.5f);
            cv.FillShaded(full, (x, y) =>
            {
                // 원근: 수평선(위)에 가까울수록 무늬가 작고 납작하게
                float d = Clamp01(1f - y / hCm);
                float z = 1f / (d + 0.12f);
                float gx = (x - wCm * 0.5f) * z * 0.005f;
                float gz = z * 2.1f;
                float n = Fbm(gx, gz, seed, 5) * 0.75f + Fbm(gx * 3.1f, gz * 3.1f, seed + 13, 3) * 0.25f;
                float m = Smooth(0.5f, 0.62f, n);
                float sand = Smooth(0.6f, 0.4f, Fbm(gx * 0.7f + 9f, gz * 0.7f, seed + 3, 3));
                var c = Color.Lerp(dark, olive, Fbm(gx * 2f, gz * 2f, seed + 7, 2));
                float fade = Mathf.Lerp(0.2f, 0.85f, Smooth(0f, 0.8f, d));
                if (m > 0.01f)
                {
                    c.a = m * 0.75f * fade;
                    return c;
                }
                var sc = sandy;
                sc.a = sand * 0.28f * fade;
                return sc;
            });
            return new PaintedSprite(cv, new Vector2(0.5f, 1f), ppu);
        }

        /// <summary>멀리 떠 있는 작은 요트 (외곽선 없음).</summary>
        public static PaintedSprite SailboatFar()
        {
            const float ppu = 80f;
            var cv = Canvas(70f, 80f, ppu);
            cv.Fill(Sd.Poly(8f, 12f, 62f, 12f, 54f, 3f, 14f, 3f), Hex.C("#F4F1EA"));
            cv.Fill(Sd.Poly(8f, 12f, 62f, 12f, 60f, 9f, 10f, 9f), Hex.C("#2B5E8C"));
            cv.Fill(Sd.Capsule(35f, 12f, 35f, 76f, 0.9f), Hex.C("#7D7A73"));
            cv.FillGradient(Sd.Poly(36.5f, 74f, 36.5f, 16f, 60f, 16f), Hex.C("#E9ECEF"), Color.white, 16f, 74f);
            cv.FillGradient(Sd.Poly(33.5f, 66f, 33.5f, 16f, 16f, 16f), Hex.C("#C9D3DC"), Hex.C("#EEF2F5"), 16f, 66f);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.06f), ppu);
        }

        // ================================================================ 와이키키 해변 (사진 1)

        /// <summary>
        /// 해변 뒤쪽(먼 모래사장) 띠: 위쪽 가장자리가 해안선(흰 거품 + 젖은 모래 + 얕은 청록 물).
        /// 오른쪽 끝은 수면 쪽으로 내려간다. 피벗 = 왼쪽 아래 (y=0 이 가까운 해변 높이 아래).
        /// </summary>
        public static PaintedSprite BackBeach(int seed, float wCm, float topCm, float taperCm)
        {
            const float ppu = 60f;
            const float baseCm = 40f; // 피벗(가까운 해변 높이) 아래로 40cm 여유 → 가까운 땅 뒤에 숨는다
            float hCm = baseCm + topCm + 34f;
            var cv = Canvas(wCm, hCm, ppu);
            Func<float, float> top = x =>
            {
                float t = Smooth(wCm - taperCm, wCm, x);
                float h = baseCm + topCm + (Fbm(x * 0.004f, 0.5f, seed, 3) - 0.5f) * 10f + Mathf.Sin(x * 0.006f) * 3f;
                // 오른쪽 끝은 수면 쪽으로 내려간다
                return Mathf.Lerp(h, baseCm - 18f, t);
            };
            top = Cached(top, 0f, wCm, cv.Width * 2);
            var shallow = Hex.C("#5CCFD0");
            // 얕은 물 (해안선 위로 옅게 퍼짐)
            cv.FillShaded(new HeightField(x => top(x) + 26f, 0f, wCm, hCm), (x, y) =>
            {
                float d = y - top(x);
                var c = shallow;
                c.a = d < 0f ? 0f : 0.75f * (1f - Smooth(0f, 26f, d));
                return c;
            });
            var sandFar = Hex.C("#D8CDB9");
            var sandNear = Hex.C("#EEE6D6");
            var wet = Hex.C("#BFB39C");
            cv.FillShaded(new HeightField(top, 0f, wCm, hCm), (x, y) =>
            {
                float h = top(x);
                float d = h - y; // 해안선에서 아래로 거리
                var c = Color.Lerp(sandNear, sandFar, Clamp01((y - baseCm) / Mathf.Max(1f, h - baseCm)));
                c = Color.Lerp(c, wet, (1f - Smooth(0f, 9f, d)) * 0.7f);
                float n = Fbm(x * 0.05f, y * 0.2f, seed + 3, 3);
                c = Mul(c, 0.95f + n * 0.08f);
                // 흰 거품 줄 (끊어지며 출렁)
                float foam = Noise(x * 0.03f, 1.7f, seed + 9);
                if (d < 2.6f + foam * 2f) c = Color.Lerp(c, Color.white, 0.85f * (1f - d / (2.6f + foam * 2f)));
                c.a = 1f;
                return c;
            });
            return new PaintedSprite(cv, new Vector2(0f, baseCm / hCm), ppu);
        }

        /// <summary>사진 1 의 하얀 인명구조 탑 (기둥 위 오두막 + 진회색 지붕 + 경사로).</summary>
        public static PaintedSprite LifeguardTower()
        {
            const float ppu = 90f;
            var cv = Canvas(170f, 160f, ppu);
            var white = Hex.C("#EEEDE8");
            var shade = Hex.C("#B9BCC0");
            var roof = Hex.C("#56595F");
            var glass = Hex.C("#33404C");
            // 경사로
            cv.Fill(Sd.Capsule(18f, 4f, 66f, 50f, 2.4f), Hex.C("#C7C5BE"));
            cv.Fill(Sd.Capsule(20f, 10f, 66f, 56f, 0.9f), Hex.C("#9C9A93"));
            // 기둥
            foreach (var x in new[] { 70f, 86f, 118f, 134f })
                cv.Fill(Sd.Box(x, 26f, 2.2f, 26f), x > 100f ? shade : Hex.C("#D8D7D1"));
            cv.Fill(Sd.Box(102f, 26f, 32f, 1.2f), Hex.C("#B0AEA7"));
            // 데크 + 난간
            cv.Fill(Sd.Box(102f, 53f, 38f, 3f), Hex.C("#D4D2CB"));
            cv.Fill(Sd.Box(102f, 64f, 38f, 0.9f), Hex.C("#9E9C95"));
            for (int i = 0; i < 9; i++) cv.Fill(Sd.Box(66f + i * 9f, 60f, 0.7f, 4.5f), Hex.C("#A9A7A0"));
            // 오두막
            var cabin = Sd.Box(103f, 82f, 26f, 22f);
            cv.FillShaded(cabin, (x, y) => { var c = x > 118f ? shade : white; c.a = 1f; return c; });
            cv.Fill(Sd.Box(96f, 86f, 15f, 8f), glass);
            cv.Fill(Sd.Box(122f, 86f, 4f, 8f), Mul(glass, 0.8f));
            cv.Fill(Sd.Box(96f, 89f, 15f, 2f), new Color(1f, 1f, 1f, 0.12f));
            // 지붕 (피라미드, 처마)
            cv.FillShaded(Sd.Poly(70f, 103f, 136f, 103f, 120f, 124f, 88f, 124f), (x, y) => { var c = x > 112f ? Mul(roof, 0.78f) : roof; c.a = 1f; return c; });
            cv.Fill(Sd.Box(103f, 103.5f, 34f, 1.4f), Hex.C("#3C3F44"));
            cv.Fill(Sd.Capsule(103f, 124f, 103f, 134f, 0.8f), Hex.C("#3C3F44"));
            cv.Fill(Sd.Poly(103f, 134f, 103f, 128f, 112f, 131f), Hex.C("#E85D4A"));
            return new PaintedSprite(cv, new Vector2(102f / 170f, 0.01f), ppu);
        }

        /// <summary>사진 1 의 파란 돔 텐트.</summary>
        public static PaintedSprite DomeTent(Color main)
        {
            const float ppu = 90f;
            var cv = Canvas(110f, 70f, ppu);
            var dome = Sd.Intersect(Sd.Ellipse(55f, 4f, 50f, 56f), Sd.HalfPlane(0f, 4f, 0f, -1f));
            cv.FillShaded(dome, (x, y) =>
            {
                float l = Clamp01(0.55f + (55f - x) / 50f * 0.35f + (y - 30f) / 60f * 0.3f);
                var c = Color.Lerp(Mul(main, 0.62f), Mul(main, 1.18f), l);
                c.a = 1f;
                return c;
            });
            cv.Fill(Sd.Intersect(Sd.Ellipse(70f, 4f, 13f, 30f), dome), Mul(main, 0.38f));
            cv.Fill(Sd.Intersect(Sd.Path(0.9f, 0.9f, 10f, 4f, 30f, 44f, 55f, 58f, 80f, 44f, 100f, 4f), dome), Mul(main, 0.8f));
            return new PaintedSprite(cv, new Vector2(0.5f, 4f / 70f), ppu);
        }

        /// <summary>사진 1 의 초록 그늘막 (네 기둥 + 평평한 지붕).</summary>
        public static PaintedSprite Canopy(Color main)
        {
            const float ppu = 90f;
            var cv = Canvas(150f, 110f, ppu);
            cv.Fill(Sd.Ellipse(75f, 6f, 64f, 5f), new Color(0.1f, 0.15f, 0.25f, 0.18f));
            foreach (var x in new[] { 18f, 132f })
                cv.Fill(Sd.Box(x, 44f, 1.4f, 42f), Hex.C("#8E9399"));
            foreach (var x in new[] { 34f, 116f })
                cv.Fill(Sd.Box(x, 48f, 1.1f, 40f), Hex.C("#6C7177"));
            var roofShape = Sd.Poly(6f, 84f, 144f, 84f, 128f, 102f, 22f, 102f);
            cv.FillShaded(roofShape, (x, y) => { var c = Color.Lerp(Mul(main, 0.85f), Mul(main, 1.15f), Clamp01((y - 84f) / 18f)); c.a = 1f; return c; });
            cv.Fill(Sd.Box(75f, 80f, 69f, 4.5f), Mul(main, 0.7f));
            for (int i = 0; i < 12; i++) cv.Fill(Sd.Ellipse(11f + i * 11.6f, 75.5f, 5.4f, 2.4f), Mul(main, 0.7f));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.02f), ppu);
        }

        /// <summary>작은 해변 사람들. kind 0 = 앉은 사람, 1 = 수건 위에 누운 사람, 2 = 선 사람, 3 = 의자에 앉은 사람.</summary>
        public static PaintedSprite Beachgoer(int kind)
        {
            const float ppu = 90f;
            var cv = Canvas(80f, 90f, ppu);
            Color[] skins = { Hex.C("#C68B59"), Hex.C("#8D5524"), Hex.C("#E0AC69"), Hex.C("#F1C27D") };
            Color[] suits = { Hex.C("#2B2D42"), Hex.C("#E63946"), Hex.C("#1D3557"), Hex.C("#F4A261") };
            var skin = skins[kind % skins.Length];
            var suit = suits[(kind + 1) % suits.Length];
            var hair = Hex.C("#2B1D16");
            switch (kind % 4)
            {
                case 0:
                    cv.Fill(Sd.Ellipse(40f, 3f, 26f, 3f), new Color(0.1f, 0.15f, 0.3f, 0.2f));
                    cv.Fill(Sd.Capsule(36f, 8f, 56f, 14f, 4f), skin); // 다리 (무릎 세움)
                    cv.Fill(Sd.Capsule(56f, 14f, 60f, 4f, 3.4f), skin);
                    cv.Fill(Sd.Capsule(34f, 8f, 37f, 30f, 7f, 6f), suit);
                    cv.Fill(Sd.Capsule(38f, 24f, 50f, 14f, 2.4f), skin);
                    cv.Fill(Sd.Circle(38f, 39f, 6.2f), skin);
                    cv.Fill(Sd.Intersect(Sd.Circle(37f, 40f, 6.6f), Sd.HalfPlane(0f, 40f, 0f, -1f)), hair);
                    break;
                case 1:
                    cv.Fill(Sd.Box(40f, 4f, 30f, 2.4f, 1f), Hex.C("#F77F00"));
                    cv.Fill(Sd.Box(30f, 4f, 6f, 2.4f), Hex.C("#FCBF49"));
                    cv.Fill(Sd.Capsule(18f, 9f, 50f, 9f, 4.6f), skin);
                    cv.Fill(Sd.Capsule(30f, 9f, 44f, 10f, 5.4f), suit);
                    cv.Fill(Sd.Circle(58f, 10f, 5.4f), skin);
                    cv.Fill(Sd.Intersect(Sd.Circle(59f, 10f, 5.8f), Sd.HalfPlane(59f, 0f, -1f, 0f)), hair);
                    break;
                case 2:
                    cv.Fill(Sd.Ellipse(40f, 3f, 12f, 2.5f), new Color(0.1f, 0.15f, 0.3f, 0.2f));
                    cv.Fill(Sd.Capsule(37f, 4f, 38f, 30f, 3.2f), skin);
                    cv.Fill(Sd.Capsule(43f, 4f, 42f, 30f, 3.2f), skin);
                    cv.Fill(Sd.Capsule(40f, 26f, 40f, 54f, 7.2f, 6.4f), suit);
                    cv.Fill(Sd.Capsule(33f, 52f, 31f, 32f, 2.4f), skin);
                    cv.Fill(Sd.Capsule(47f, 52f, 49f, 32f, 2.4f), skin);
                    cv.Fill(Sd.Circle(40f, 66f, 6.4f), skin);
                    cv.Fill(Sd.Intersect(Sd.Circle(40f, 67f, 6.9f), Sd.HalfPlane(0f, 67f, 0f, -1f)), hair);
                    break;
                default:
                    cv.Fill(Sd.Ellipse(40f, 3f, 24f, 3f), new Color(0.1f, 0.15f, 0.3f, 0.2f));
                    cv.Fill(Sd.Capsule(22f, 2f, 30f, 16f, 1.1f), Hex.C("#B0B5BB"));
                    cv.Fill(Sd.Capsule(58f, 2f, 50f, 16f, 1.1f), Hex.C("#B0B5BB"));
                    cv.Fill(Sd.Poly(22f, 18f, 52f, 18f, 30f, 44f, 24f, 44f), Hex.C("#4EA8DE"));
                    cv.Fill(Sd.Capsule(30f, 22f, 50f, 22f, 4f), skin);
                    cv.Fill(Sd.Capsule(50f, 22f, 60f, 6f, 3.4f), skin);
                    cv.Fill(Sd.Capsule(30f, 22f, 28f, 40f, 6.4f, 5.6f), suit);
                    cv.Fill(Sd.Circle(29f, 49f, 5.6f), skin);
                    cv.Fill(Sd.Intersect(Sd.Circle(28f, 50f, 6f), Sd.HalfPlane(0f, 50f, 0f, -1f)), Hex.C("#F4E285"));
                    break;
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 0.02f), ppu);
        }

        /// <summary>사진 1·3 처럼 모래에 드리운 야자수 그림자 (줄기 + 잎 뭉치). 피벗 = 줄기 쪽 끝.</summary>
        public static PaintedSprite PalmShadow(int seed)
        {
            const float ppu = 50f;
            var rnd = new System.Random(seed);
            var cv = Canvas(560f, 90f, ppu);
            var c = new Color(0.22f, 0.27f, 0.45f, 0.2f);
            cv.FillSoft(Sd.Capsule(530f, 70f, 170f, 36f, 5f, 4f), c, 7f);
            var crown = new Vector2(120f, 34f);
            var lobes = new List<Shape> { Sd.Ellipse(crown.x, crown.y, 70f, 20f) };
            for (int i = 0; i < 9; i++)
            {
                float a = (i / 9f) * Mathf.PI * 2f + (float)rnd.NextDouble() * 0.5f;
                float len = Mathf.Lerp(70f, 115f, (float)rnd.NextDouble());
                lobes.Add(Sd.Ellipse(crown.x + Mathf.Cos(a) * len * 0.6f, crown.y + Mathf.Sin(a) * len * 0.18f, len * 0.45f, 9f, a * Mathf.Rad2Deg * 0.25f));
            }
            cv.FillSoft(Sd.Union(lobes.ToArray()), c, 18f);
            return new PaintedSprite(cv, new Vector2(530f / 560f, 70f / 90f), ppu);
        }

        // ================================================================ 쿠알로아 (사진 2)

        /// <summary>사진 2 의 깎아지른 초록 능선: 왼쪽이 높은 톱니 봉우리, 오른쪽은 계단식으로 내려가 절벽. 세로 주름(골짜기) + 아래 숲.</summary>
        public static PaintedSprite KualoaRidge(int seed)
        {
            const float ppu = 45f;
            float W = 1500f, Hm = 400f;
            var cv = Canvas(W, Hm + 20f, ppu);
            Func<float, float> h = x =>
            {
                float u = x / W;
                float body;
                if (u < 0.07f) body = Mathf.Lerp(0.12f, 0.58f, Smooth(0f, 0.07f, u));
                else if (u < 0.42f) body = Mathf.Lerp(0.58f, 0.95f, Smooth(0.07f, 0.2f, u));
                else if (u < 0.74f) body = Mathf.Lerp(0.95f, 0.68f, Smooth(0.42f, 0.74f, u));
                else if (u < 0.86f) body = Mathf.Lerp(0.68f, 0.2f, Smooth(0.74f, 0.86f, u));
                else body = Mathf.Lerp(0.2f, 0.07f, Smooth(0.86f, 1f, u));
                float rough = Smooth(0.03f, 0.12f, u) * (1f - Smooth(0.82f, 0.9f, u));
                // 날카로운 봉우리: 톱니 + 가끔 깊은 홈
                float tooth = u * 34f + Fbm(u * 6f, 0.2f, seed, 2) * 3f;
                float saw = 1f - Mathf.Abs((tooth % 1f) * 2f - 1f);
                // 봉우리마다 높이가 제각각인 뾰족한 첨탑
                float toothH = Hash(Mathf.FloorToInt(tooth), 7, seed);
                float spikes = Mathf.Pow(saw, 2.6f) * Mathf.Lerp(0.03f, 0.12f, toothH * toothH);
                float jag = (Fbm(u * 22f, 0.7f, seed + 3, 4) - 0.5f) * 0.14f;
                return Mathf.Max(8f, (body + (spikes + jag) * rough) * Hm + 10f);
            };
            h = Cached(h, 0f, W, cv.Width * 2);
            var lit = Hex.C("#7EA557");
            var mid = Hex.C("#36593A");
            var dark = Hex.C("#152821");
            var haze = Hex.C("#7FA2BC");
            var forest = Hex.C("#34592F");
            var forestLit = Hex.C("#5F8A43");
            cv.FillShaded(new HeightField(h, 0f, W, Hm + 20f), (x, y) =>
            {
                float top = h(x);
                float rel = y / top;
                // 세로 주름: 간격·굵기가 노이즈로 흔들리고, 왼쪽 면이 빛을 받는다
                float warp = Fbm(x * 0.003f, y * 0.0012f, seed + 4, 2) * 1.1f + (y / Hm) * 0.25f;
                float w = 26f + Fbm(x * 0.008f, 0.3f, seed + 8, 2) * 30f;
                float ph = x / w + warp;
                float frac = ph - Mathf.Floor(ph);
                float ridge = Smooth(0.08f, 0.3f, frac) * (1f - Smooth(0.42f, 0.72f, frac));
                float litSide = Smooth(0.08f, 0.24f, frac) * (1f - Smooth(0.24f, 0.4f, frac));
                float n = Fbm(x * 0.025f, y * 0.025f, seed + 7, 3);
                var cliff = Color.Lerp(dark, mid, ridge * 0.85f + n * 0.15f);
                cliff = Color.Lerp(cliff, lit, litSide * 0.6f);
                cliff = Color.Lerp(cliff, haze, 0.12f + (1f - ridge) * 0.14f);
                // 아래쪽 숲 (부드러운 덩어리)
                float clump = Fbm(x * 0.02f, y * 0.03f, seed + 11, 4);
                var low = Color.Lerp(forest, forestLit, Smooth(0.35f, 0.75f, clump));
                float slopeMix = Smooth(0.18f, 0.45f, rel + (n - 0.5f) * 0.15f);
                var c = Color.Lerp(low, cliff, slopeMix);
                if (top - y < 2.5f) c = Color.Lerp(c, lit, 0.3f);
                c = Color.Lerp(c, haze, 0.11f);
                c.a = 1f;
                return c;
            });
            return new PaintedSprite(cv, new Vector2(0.5f, 0f), ppu);
        }

        /// <summary>사진 2 의 산 밑 해안 숲 띠 (짙은 나무 + 가는 모래선). 피벗 = 아래 가운데 (수평선).</summary>
        public static PaintedSprite CoastTrees(int seed, float wCm)
        {
            const float ppu = 45f;
            var cv = Canvas(wCm, 80f, ppu);
            Func<float, float> h = x => 22f + Fbm(x * 0.012f, 0.4f, seed, 4) * 38f + Mathf.Abs(Mathf.Sin(x * 0.07f)) * 6f;
            h = Cached(h, 0f, wCm, cv.Width * 2);
            cv.FillShaded(new HeightField(h, 0f, wCm, 80f), (x, y) =>
            {
                float n = Fbm(x * 0.06f, y * 0.08f, seed + 3, 3);
                var c = Color.Lerp(Hex.C("#24432A"), Hex.C("#4F7E3E"), Clamp01(y / h(x)) * 0.7f + n * 0.4f);
                c = Color.Lerp(c, Hex.C("#8DB0C6"), 0.12f);
                c.a = 1f;
                return c;
            });
            cv.Fill(Sd.Box(wCm * 0.5f, 2.5f, wCm * 0.5f, 2.5f), Hex.C("#D9CFB4"));
            return new PaintedSprite(cv, new Vector2(0.5f, 0.02f), ppu);
        }

        // ================================================================ 포이푸 잔디 (사진 4)

        /// <summary>사진 4 의 바닷가 검은 용암 바위 (+ 바위 틈에서 부서지는 흰 파도). 피벗 = 아래 가운데.</summary>
        public static PaintedSprite LavaRocks(int seed, bool foam = true)
        {
            const float ppu = 70f;
            var rnd = new System.Random(seed);
            var cv = Canvas(320f, 130f, ppu);
            var rockDark = Hex.C("#1F2226");
            var rockLit = Hex.C("#686D74");
            // 뒤 → 앞, 큰 → 작은 바위
            for (int i = 0; i < 7; i++)
            {
                float x = Mathf.Lerp(40f, 280f, (i + (float)rnd.NextDouble() * 0.8f) / 7f);
                float r = Mathf.Lerp(22f, 44f, (float)rnd.NextDouble()) * (i % 2 == 0 ? 1f : 0.75f);
                float yb = 6f + (i % 2) * 4f;
                int nv = 8;
                var pts = new float[nv * 2];
                for (int k = 0; k < nv; k++)
                {
                    float a = Mathf.PI * k / (nv - 1);
                    float rr = r * Mathf.Lerp(0.75f, 1.12f, (float)rnd.NextDouble());
                    pts[k * 2] = x + Mathf.Cos(a) * rr * 1.25f;
                    pts[k * 2 + 1] = yb + Mathf.Sin(a) * rr * 0.85f;
                }
                var rock = Sd.Inflate(Sd.Poly(pts), 2.5f);
                float rx = x, ry = yb, rad = r;
                int sd = seed + i * 7;
                cv.FillShaded(rock, (xx, yy) =>
                {
                    // 윗면(햇빛) 밝게, 아래·오른쪽 어둡게, 거친 질감
                    float up = Clamp01((yy - ry) / (rad * 0.85f));
                    float left = Clamp01((rx - xx) / (rad * 1.25f) * 0.5f + 0.5f);
                    float n = Fbm(xx * 0.08f, yy * 0.08f, sd, 4);
                    float l = Clamp01(up * up * 0.75f + left * 0.25f + (n - 0.5f) * 0.5f);
                    var c = Color.Lerp(rockDark, rockLit, l);
                    c.a = 1f;
                    return c;
                });
            }
            // 바위 사이·앞에서 부서지는 하얀 파도 (큰 덩어리 몇 개 + 물보라)
            for (int i = 0; i < (foam ? 5 : 0); i++)
            {
                float x = Mathf.Lerp(20f, 300f, (i + (float)rnd.NextDouble()) / 5f);
                float rx = Mathf.Lerp(26f, 48f, (float)rnd.NextDouble());
                float ry = Mathf.Lerp(8f, 16f, (float)rnd.NextDouble());
                cv.FillSoft(Sd.Ellipse(x, 7f, rx, ry), new Color(1f, 1f, 1f, 0.85f), ry * 0.8f);
                cv.FillSoft(Sd.Ellipse(x + rx * 0.2f, 14f + ry * 0.4f, rx * 0.45f, ry * 0.9f), new Color(1f, 1f, 1f, 0.55f), ry);
            }
            return new PaintedSprite(cv, new Vector2(0.5f, 0.06f), ppu);
        }

        /// <summary>잔디 가장자리 풀잎 띠 (사진 4 의 노란빛 잔디). 피벗 = 아래 왼쪽.</summary>
        public static PaintedSprite GrassEdge(int seed, float wCm)
        {
            const float ppu = 70f;
            var rnd = new System.Random(seed);
            var cv = Canvas(wCm, 22f, ppu);
            for (float x = 1f; x < wCm - 1f; x += 1.6f)
            {
                float hh = Mathf.Lerp(5f, 14f, (float)rnd.NextDouble());
                float lean = ((float)rnd.NextDouble() - 0.5f) * 6f;
                var c = Color.Lerp(Hex.C("#7E962A"), Hex.C("#C2CE5A"), (float)rnd.NextDouble());
                cv.Fill(Sd.Capsule(x, 2f, x + lean, 2f + hh, 0.9f, 0.25f), c);
            }
            return new PaintedSprite(cv, new Vector2(0f, 2f / 22f), ppu);
        }

        /// <summary>잔디 위 수건에 누운 사람 (사진 4). 원근 때문에 위에서 비스듬히 본 모양.</summary>
        public static PaintedSprite TowelSunbather(int kind)
        {
            const float ppu = 90f;
            var cv = Canvas(110f, 40f, ppu);
            Color[] towels = { Hex.C("#F28C28"), Hex.C("#3A86FF"), Hex.C("#E63946"), Hex.C("#2EC4B6") };
            Color[] skins = { Hex.C("#E0AC69"), Hex.C("#C68B59"), Hex.C("#F1C27D"), Hex.C("#8D5524") };
            var towel = towels[kind % towels.Length];
            cv.Fill(Sd.Poly(6f, 6f, 100f, 6f, 92f, 24f, 14f, 24f), towel);
            cv.Fill(Sd.Poly(6f, 6f, 100f, 6f, 99f, 9f, 7f, 9f), Mul(towel, 0.75f));
            var skin = skins[kind % skins.Length];
            cv.Fill(Sd.Capsule(22f, 16f, 66f, 16f, 5f, 5.6f), skin);
            cv.Fill(Sd.Capsule(44f, 17f, 60f, 17f, 6.2f), kind % 2 == 0 ? Hex.C("#1D3557") : Hex.C("#E76F51"));
            cv.Fill(Sd.Circle(76f, 18f, 6.2f), skin);
            cv.Fill(Sd.Intersect(Sd.Circle(78f, 19f, 6.6f), Sd.HalfPlane(77f, 0f, -1f, 0f)), Hex.C("#3B2A20"));
            return new PaintedSprite(cv, new Vector2(0.5f, 6f / 40f), ppu);
        }

        /// <summary>모래에 꽂아 둔 서핑보드 (외곽선 없는 버전).</summary>
        public static PaintedSprite Surfboard(Color main, Color stripe)
        {
            const float ppu = 80f;
            var cv = Canvas(40f, 200f, ppu);
            var board = Sd.Ellipse(20f, 100f, 15f, 96f);
            cv.FillShaded(board, (x, y) =>
            {
                float l = Clamp01(0.5f + (20f - x) / 15f * 0.45f);
                var c = Color.Lerp(Mul(main, 0.72f), Mul(main, 1.12f), l);
                c.a = 1f;
                return c;
            });
            cv.Fill(Sd.Intersect(board, Sd.Box(20f, 100f, 2.2f, 100f)), stripe);
            cv.FillSoft(Sd.Intersect(board, Sd.Ellipse(13f, 128f, 3.5f, 40f)), new Color(1f, 1f, 1f, 0.35f), 3f);
            cv.FillSoft(Sd.Ellipse(20f, 6f, 16f, 3f), new Color(0.15f, 0.2f, 0.35f, 0.25f), 3f);
            return new PaintedSprite(cv, new Vector2(0.5f, 0.05f), ppu);
        }
    }
}
