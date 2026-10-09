using System;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 2D 부호 거리 함수(SDF) 도형. 좌표는 "디자인 단위" (y 위쪽이 +).
    /// 순수 C# 수학만 사용 → 오프라인에서도 미리보기 PNG 를 뽑을 수 있다.
    /// </summary>
    public abstract class Shape
    {
        /// <summary>도형 경계까지의 거리. 안쪽이면 음수.</summary>
        public abstract float Dist(float x, float y);

        /// <summary>대략적인 바운딩 박스 (래스터화 최적화용).</summary>
        public abstract void Bounds(out float x0, out float y0, out float x1, out float y1);
    }

    /// <summary>도형 생성 헬퍼.</summary>
    public static class Sd
    {
        public static Shape Circle(float x, float y, float r) { return new CircleShape(x, y, r); }
        public static Shape Ellipse(float x, float y, float rx, float ry, float rotDeg = 0f) { return new EllipseShape(x, y, rx, ry, rotDeg); }
        public static Shape Box(float x, float y, float halfW, float halfH, float radius = 0f, float rotDeg = 0f) { return new BoxShape(x, y, halfW, halfH, radius, rotDeg); }
        public static Shape Capsule(float ax, float ay, float bx, float by, float ra, float rb) { return new CapsuleShape(ax, ay, bx, by, ra, rb); }
        public static Shape Capsule(float ax, float ay, float bx, float by, float r) { return new CapsuleShape(ax, ay, bx, by, r, r); }
        public static Shape Poly(params float[] xy) { return new PolyShape(xy); }
        public static Shape Ring(float x, float y, float r, float thickness) { return new RingShape(x, y, r, thickness); }

        /// <summary>(nx, ny) 방향 쪽이 바깥인 반평면. 점 (px, py) 를 지난다.</summary>
        public static Shape HalfPlane(float px, float py, float nx, float ny) { return new HalfPlaneShape(px, py, nx, ny); }

        public static Shape Union(params Shape[] shapes) { return new UnionShape(shapes); }
        public static Shape Intersect(Shape a, Shape b) { return new IntersectShape(a, b); }
        public static Shape Subtract(Shape a, Shape b) { return new SubtractShape(a, b); }
        public static Shape Move(Shape s, float dx, float dy) { return new MoveShape(s, dx, dy); }
        /// <summary>도형을 r 만큼 부풀린다 (모서리가 둥글어짐).</summary>
        public static Shape Inflate(Shape s, float r) { return new InflateShape(s, r); }

        /// <summary>뾰족한 별.</summary>
        public static Shape Star(float x, float y, float rOuter, float rInner, int points, float rotDeg = 90f)
        {
            var xy = new float[points * 4];
            for (int i = 0; i < points * 2; i++)
            {
                float r = (i % 2 == 0) ? rOuter : rInner;
                float a = (rotDeg + i * 180f / points) * Mathf.Deg2Rad;
                xy[i * 2] = x + Mathf.Cos(a) * r;
                xy[i * 2 + 1] = y + Mathf.Sin(a) * r;
            }
            return new PolyShape(xy);
        }

        /// <summary>정다각형.</summary>
        public static Shape Ngon(float x, float y, float r, int sides, float rotDeg = 90f)
        {
            var xy = new float[sides * 2];
            for (int i = 0; i < sides; i++)
            {
                float a = (rotDeg + i * 360f / sides) * Mathf.Deg2Rad;
                xy[i * 2] = x + Mathf.Cos(a) * r;
                xy[i * 2 + 1] = y + Mathf.Sin(a) * r;
            }
            return new PolyShape(xy);
        }

        /// <summary>점들을 잇는 굵은 선(캡슐 체인). 두께는 시작→끝으로 보간.</summary>
        public static Shape Path(float r0, float r1, params float[] xy)
        {
            int n = xy.Length / 2;
            if (n < 2) return Circle(xy[0], xy[1], r0);
            var parts = new Shape[n - 1];
            for (int i = 0; i < n - 1; i++)
            {
                float ta = (float)i / (n - 1);
                float tb = (float)(i + 1) / (n - 1);
                parts[i] = Capsule(xy[i * 2], xy[i * 2 + 1], xy[i * 2 + 2], xy[i * 2 + 3], Mathf.Lerp(r0, r1, ta), Mathf.Lerp(r0, r1, tb));
            }
            return Union(parts);
        }

        /// <summary>원호 (각도는 도, 반시계).</summary>
        public static Shape Arc(float x, float y, float r, float thickness, float fromDeg, float toDeg)
        {
            int seg = Math.Max(3, (int)(Math.Abs(toDeg - fromDeg) / 12f));
            var xy = new float[(seg + 1) * 2];
            for (int i = 0; i <= seg; i++)
            {
                float a = Mathf.Lerp(fromDeg, toDeg, (float)i / seg) * Mathf.Deg2Rad;
                xy[i * 2] = x + Mathf.Cos(a) * r;
                xy[i * 2 + 1] = y + Mathf.Sin(a) * r;
            }
            return Path(thickness * 0.5f, thickness * 0.5f, xy);
        }

        // ------------------------------------------------------------- shapes

        sealed class CircleShape : Shape
        {
            readonly float _x, _y, _r;
            public CircleShape(float x, float y, float r) { _x = x; _y = y; _r = r; }
            public override float Dist(float x, float y)
            {
                float dx = x - _x, dy = y - _y;
                return (float)Math.Sqrt(dx * dx + dy * dy) - _r;
            }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                x0 = _x - _r; y0 = _y - _r; x1 = _x + _r; y1 = _y + _r;
            }
        }

        sealed class EllipseShape : Shape
        {
            readonly float _x, _y, _rx, _ry, _cos, _sin;
            public EllipseShape(float x, float y, float rx, float ry, float rotDeg)
            {
                _x = x; _y = y; _rx = Math.Max(0.001f, rx); _ry = Math.Max(0.001f, ry);
                float a = rotDeg * Mathf.Deg2Rad;
                _cos = (float)Math.Cos(a); _sin = (float)Math.Sin(a);
            }
            public override float Dist(float x, float y)
            {
                float dx = x - _x, dy = y - _y;
                float lx = dx * _cos + dy * _sin;
                float ly = -dx * _sin + dy * _cos;
                float k0 = (float)Math.Sqrt((lx / _rx) * (lx / _rx) + (ly / _ry) * (ly / _ry));
                float k1 = (float)Math.Sqrt((lx / (_rx * _rx)) * (lx / (_rx * _rx)) + (ly / (_ry * _ry)) * (ly / (_ry * _ry)));
                if (k1 < 1e-6f) return -Math.Min(_rx, _ry);
                return k0 * (k0 - 1f) / k1;
            }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                float r = Math.Max(_rx, _ry);
                x0 = _x - r; y0 = _y - r; x1 = _x + r; y1 = _y + r;
            }
        }

        sealed class BoxShape : Shape
        {
            readonly float _x, _y, _hw, _hh, _r, _cos, _sin;
            public BoxShape(float x, float y, float hw, float hh, float r, float rotDeg)
            {
                _x = x; _y = y; _hw = hw; _hh = hh;
                _r = Math.Max(0f, Math.Min(r, Math.Min(hw, hh)));
                float a = rotDeg * Mathf.Deg2Rad;
                _cos = (float)Math.Cos(a); _sin = (float)Math.Sin(a);
            }
            public override float Dist(float x, float y)
            {
                float dx = x - _x, dy = y - _y;
                float lx = Math.Abs(dx * _cos + dy * _sin);
                float ly = Math.Abs(-dx * _sin + dy * _cos);
                float qx = lx - _hw + _r, qy = ly - _hh + _r;
                float ox = Math.Max(qx, 0f), oy = Math.Max(qy, 0f);
                return (float)Math.Sqrt(ox * ox + oy * oy) + Math.Min(Math.Max(qx, qy), 0f) - _r;
            }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                float r = (float)Math.Sqrt(_hw * _hw + _hh * _hh);
                x0 = _x - r; y0 = _y - r; x1 = _x + r; y1 = _y + r;
            }
        }

        sealed class CapsuleShape : Shape
        {
            readonly float _ax, _ay, _bx, _by, _ra, _rb;
            public CapsuleShape(float ax, float ay, float bx, float by, float ra, float rb) { _ax = ax; _ay = ay; _bx = bx; _by = by; _ra = ra; _rb = rb; }
            public override float Dist(float x, float y)
            {
                float pax = x - _ax, pay = y - _ay, bax = _bx - _ax, bay = _by - _ay;
                float len2 = bax * bax + bay * bay;
                float h = len2 > 1e-8f ? (pax * bax + pay * bay) / len2 : 0f;
                if (h < 0f) h = 0f; else if (h > 1f) h = 1f;
                float dx = pax - bax * h, dy = pay - bay * h;
                return (float)Math.Sqrt(dx * dx + dy * dy) - (_ra + (_rb - _ra) * h);
            }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                float r = Math.Max(_ra, _rb);
                x0 = Math.Min(_ax, _bx) - r; y0 = Math.Min(_ay, _by) - r;
                x1 = Math.Max(_ax, _bx) + r; y1 = Math.Max(_ay, _by) + r;
            }
        }

        sealed class PolyShape : Shape
        {
            readonly float[] _v;
            readonly int _n;
            readonly float _x0, _y0, _x1, _y1;
            public PolyShape(float[] xy)
            {
                _v = xy;
                _n = xy.Length / 2;
                _x0 = _y0 = float.MaxValue; _x1 = _y1 = float.MinValue;
                for (int i = 0; i < _n; i++)
                {
                    _x0 = Math.Min(_x0, xy[i * 2]); _x1 = Math.Max(_x1, xy[i * 2]);
                    _y0 = Math.Min(_y0, xy[i * 2 + 1]); _y1 = Math.Max(_y1, xy[i * 2 + 1]);
                }
            }
            // Inigo Quilez - sdPolygon (오목 다각형도 지원)
            public override float Dist(float px, float py)
            {
                float d = (px - _v[0]) * (px - _v[0]) + (py - _v[1]) * (py - _v[1]);
                float s = 1f;
                for (int i = 0, j = _n - 1; i < _n; j = i, i++)
                {
                    float vix = _v[i * 2], viy = _v[i * 2 + 1], vjx = _v[j * 2], vjy = _v[j * 2 + 1];
                    float ex = vjx - vix, ey = vjy - viy;
                    float wx = px - vix, wy = py - viy;
                    float ee = ex * ex + ey * ey;
                    float t = ee > 1e-8f ? (wx * ex + wy * ey) / ee : 0f;
                    if (t < 0f) t = 0f; else if (t > 1f) t = 1f;
                    float bx = wx - ex * t, by = wy - ey * t;
                    d = Math.Min(d, bx * bx + by * by);
                    bool c1 = py >= viy, c2 = py < vjy, c3 = ex * wy > ey * wx;
                    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
                }
                return s * (float)Math.Sqrt(d);
            }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                x0 = _x0; y0 = _y0; x1 = _x1; y1 = _y1;
            }
        }

        sealed class RingShape : Shape
        {
            readonly float _x, _y, _r, _t;
            public RingShape(float x, float y, float r, float t) { _x = x; _y = y; _r = r; _t = t * 0.5f; }
            public override float Dist(float x, float y)
            {
                float dx = x - _x, dy = y - _y;
                return Math.Abs((float)Math.Sqrt(dx * dx + dy * dy) - _r) - _t;
            }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                float r = _r + _t;
                x0 = _x - r; y0 = _y - r; x1 = _x + r; y1 = _y + r;
            }
        }

        sealed class HalfPlaneShape : Shape
        {
            readonly float _px, _py, _nx, _ny;
            public HalfPlaneShape(float px, float py, float nx, float ny)
            {
                float l = (float)Math.Sqrt(nx * nx + ny * ny);
                if (l < 1e-6f) l = 1f;
                _px = px; _py = py; _nx = nx / l; _ny = ny / l;
            }
            public override float Dist(float x, float y) { return (x - _px) * _nx + (y - _py) * _ny; }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                x0 = y0 = -1e5f; x1 = y1 = 1e5f;
            }
        }

        sealed class UnionShape : Shape
        {
            readonly Shape[] _s;
            public UnionShape(Shape[] s) { _s = s; }
            public override float Dist(float x, float y)
            {
                float d = float.MaxValue;
                for (int i = 0; i < _s.Length; i++) { float v = _s[i].Dist(x, y); if (v < d) d = v; }
                return d;
            }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                x0 = y0 = float.MaxValue; x1 = y1 = float.MinValue;
                foreach (var s in _s)
                {
                    float a, b, c, e;
                    s.Bounds(out a, out b, out c, out e);
                    x0 = Math.Min(x0, a); y0 = Math.Min(y0, b); x1 = Math.Max(x1, c); y1 = Math.Max(y1, e);
                }
            }
        }

        sealed class IntersectShape : Shape
        {
            readonly Shape _a, _b;
            public IntersectShape(Shape a, Shape b) { _a = a; _b = b; }
            public override float Dist(float x, float y) { return Math.Max(_a.Dist(x, y), _b.Dist(x, y)); }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                float a0, b0, c0, e0, a1, b1, c1, e1;
                _a.Bounds(out a0, out b0, out c0, out e0);
                _b.Bounds(out a1, out b1, out c1, out e1);
                x0 = Math.Max(a0, a1); y0 = Math.Max(b0, b1); x1 = Math.Min(c0, c1); y1 = Math.Min(e0, e1);
            }
        }

        sealed class SubtractShape : Shape
        {
            readonly Shape _a, _b;
            public SubtractShape(Shape a, Shape b) { _a = a; _b = b; }
            public override float Dist(float x, float y) { return Math.Max(_a.Dist(x, y), -_b.Dist(x, y)); }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1) { _a.Bounds(out x0, out y0, out x1, out y1); }
        }

        sealed class MoveShape : Shape
        {
            readonly Shape _s;
            readonly float _dx, _dy;
            public MoveShape(Shape s, float dx, float dy) { _s = s; _dx = dx; _dy = dy; }
            public override float Dist(float x, float y) { return _s.Dist(x - _dx, y - _dy); }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                _s.Bounds(out x0, out y0, out x1, out y1);
                x0 += _dx; x1 += _dx; y0 += _dy; y1 += _dy;
            }
        }

        sealed class InflateShape : Shape
        {
            readonly Shape _s;
            readonly float _r;
            public InflateShape(Shape s, float r) { _s = s; _r = r; }
            public override float Dist(float x, float y) { return _s.Dist(x, y) - _r; }
            public override void Bounds(out float x0, out float y0, out float x1, out float y1)
            {
                _s.Bounds(out x0, out y0, out x1, out y1);
                x0 -= _r; y0 -= _r; x1 += _r; y1 += _r;
            }
        }
    }

    /// <summary>도형 + 색 한 쌍 (스티커 그리기용).</summary>
    public struct Part
    {
        public Shape shape;
        public Color color;
        public Part(Shape shape, Color color) { this.shape = shape; this.color = color; }
    }

    /// <summary>
    /// 안티에일리어싱 SDF 래스터라이저. 디자인 좌표 → 픽셀 (Scale 배).
    /// 내부는 프리멀티플라이드 알파, 출력은 일반 알파 + 투명 픽셀 색 번짐(dilate) 처리.
    /// </summary>
    public sealed class SdfCanvas
    {
        public readonly int Width;
        public readonly int Height;
        /// <summary>디자인 1단위 = 몇 픽셀.</summary>
        public readonly float Scale;

        readonly float[] _r, _g, _b, _a;

        public SdfCanvas(int width, int height, float designWidth)
        {
            Width = Math.Max(1, width);
            Height = Math.Max(1, height);
            Scale = Width / Math.Max(0.0001f, designWidth);
            int n = Width * Height;
            _r = new float[n]; _g = new float[n]; _b = new float[n]; _a = new float[n];
        }

        public float DesignWidth => Width / Scale;
        public float DesignHeight => Height / Scale;

        void Range(Shape s, float pad, out int px0, out int py0, out int px1, out int py1)
        {
            float x0, y0, x1, y1;
            s.Bounds(out x0, out y0, out x1, out y1);
            px0 = Math.Max(0, (int)Math.Floor((x0 - pad) * Scale) - 1);
            py0 = Math.Max(0, (int)Math.Floor((y0 - pad) * Scale) - 1);
            px1 = Math.Min(Width - 1, (int)Math.Ceiling((x1 + pad) * Scale) + 1);
            py1 = Math.Min(Height - 1, (int)Math.Ceiling((y1 + pad) * Scale) + 1);
        }

        void Blend(int i, Color c, float cov)
        {
            float a = c.a * cov;
            if (a <= 0f) return;
            float inv = 1f - a;
            _r[i] = c.r * a + _r[i] * inv;
            _g[i] = c.g * a + _g[i] * inv;
            _b[i] = c.b * a + _b[i] * inv;
            _a[i] = a + _a[i] * inv;
        }

        /// <summary>단색 채우기. grow > 0 이면 그만큼 부풀려서 칠한다 (외곽선용).</summary>
        public void Fill(Shape s, Color c, float grow = 0f)
        {
            int px0, py0, px1, py1;
            Range(s, grow + 1f / Scale, out px0, out py0, out px1, out py1);
            for (int py = py0; py <= py1; py++)
            {
                float y = (py + 0.5f) / Scale;
                int row = py * Width;
                for (int px = px0; px <= px1; px++)
                {
                    float d = (s.Dist((px + 0.5f) / Scale, y) - grow) * Scale;
                    if (d >= 0.5f) continue;
                    float cov = d <= -0.5f ? 1f : 0.5f - d;
                    Blend(row + px, c, cov);
                }
            }
        }

        /// <summary>세로 그라데이션 채우기 (yBottom 에서 bottom 색, yTop 에서 top 색).</summary>
        public void FillGradient(Shape s, Color bottom, Color top, float yBottom, float yTop)
        {
            int px0, py0, px1, py1;
            Range(s, 1f / Scale, out px0, out py0, out px1, out py1);
            float span = Math.Abs(yTop - yBottom) < 1e-5f ? 1f : (yTop - yBottom);
            for (int py = py0; py <= py1; py++)
            {
                float y = (py + 0.5f) / Scale;
                float t = (y - yBottom) / span;
                if (t < 0f) t = 0f; else if (t > 1f) t = 1f;
                var c = Color.Lerp(bottom, top, t);
                int row = py * Width;
                for (int px = px0; px <= px1; px++)
                {
                    float d = s.Dist((px + 0.5f) / Scale, y) * Scale;
                    if (d >= 0.5f) continue;
                    float cov = d <= -0.5f ? 1f : 0.5f - d;
                    Blend(row + px, c, cov);
                }
            }
        }

        /// <summary>
        /// 도형 안을 픽셀마다 다른 색으로 칠한다 (f: 디자인 좌표 → 색. 텍스처·음영용).
        /// soft > 0 이면 가장자리를 그 폭(디자인 단위)만큼 부드럽게 흐린다.
        /// </summary>
        public void FillShaded(Shape s, Func<float, float, Color> f, float soft = 0f)
        {
            int px0, py0, px1, py1;
            Range(s, 1f / Scale, out px0, out py0, out px1, out py1);
            float softPx = Math.Max(1f, soft * Scale);
            for (int py = py0; py <= py1; py++)
            {
                float y = (py + 0.5f) / Scale;
                int row = py * Width;
                for (int px = px0; px <= px1; px++)
                {
                    float x = (px + 0.5f) / Scale;
                    float d = s.Dist(x, y) * Scale;
                    if (d >= 0.5f) continue;
                    float cov;
                    if (soft > 0f) cov = Math.Min(1f, (0.5f - d) / softPx);
                    else cov = d <= -0.5f ? 1f : 0.5f - d;
                    Blend(row + px, f(x, y), cov);
                }
            }
        }

        /// <summary>가장자리가 soft 폭만큼 흐린 단색 채우기 (구름, 그림자, 산호초 얼룩).</summary>
        public void FillSoft(Shape s, Color c, float soft)
        {
            FillShaded(s, (x, y) => c, soft);
        }

        /// <summary>픽셀마다 색을 계산해 덮어 그린다 (방사형 그라데이션 등). 좌표는 디자인 단위.</summary>
        public void PaintFunc(Func<float, float, Color> f)
        {
            for (int py = 0; py < Height; py++)
            {
                float y = (py + 0.5f) / Scale;
                int row = py * Width;
                for (int px = 0; px < Width; px++) Blend(row + px, f((px + 0.5f) / Scale, y), 1f);
            }
        }

        /// <summary>도형 바깥으로 부드럽게 퍼지는 빛.</summary>
        public void Glow(Shape s, Color c, float radius)
        {
            int px0, py0, px1, py1;
            Range(s, radius, out px0, out py0, out px1, out py1);
            float rpx = Math.Max(0.5f, radius * Scale);
            for (int py = py0; py <= py1; py++)
            {
                float y = (py + 0.5f) / Scale;
                int row = py * Width;
                for (int px = px0; px <= px1; px++)
                {
                    float d = s.Dist((px + 0.5f) / Scale, y) * Scale;
                    if (d >= rpx) continue;
                    float t = d <= 0f ? 1f : 1f - d / rpx;
                    Blend(row + px, c, t * t);
                }
            }
        }

        /// <summary>
        /// 스티커 스타일: 모든 파트의 외곽선을 먼저 하나로 칠하고(통합 외곽선), 그 위에 파트를 순서대로 채운다.
        /// </summary>
        public void Sticker(Color outline, float width, params Part[] parts)
        {
            if (width > 0f)
                foreach (var p in parts) if (p.color.a > 0.01f) Fill(p.shape, outline, width);
            foreach (var p in parts) Fill(p.shape, p.color);
        }

        /// <summary>도형 안쪽 위쪽에 하이라이트 (윗부분 - 아래로 민 자신).</summary>
        public void Highlight(Shape s, Color c, float dx, float dy)
        {
            Fill(Sd.Subtract(s, Sd.Move(s, dx, dy)), c);
        }

        public Color32[] ToPixels(bool dilate = true)
        {
            int n = Width * Height;
            var px = new Color32[n];
            var rr = new float[n]; var gg = new float[n]; var bb = new float[n];
            for (int i = 0; i < n; i++)
            {
                float a = _a[i];
                if (a > 0.0001f) { rr[i] = _r[i] / a; gg[i] = _g[i] / a; bb[i] = _b[i] / a; }
            }
            if (dilate)
            {
                // 투명 픽셀의 RGB 를 이웃 색으로 채워 빌리니어 필터링 시 테두리가 검게 번지지 않게 한다.
                var filled = new bool[n];
                for (int i = 0; i < n; i++) filled[i] = _a[i] > 0.0001f;
                for (int pass = 0; pass < 2; pass++)
                {
                    var next = (bool[])filled.Clone();
                    for (int y = 0; y < Height; y++)
                        for (int x = 0; x < Width; x++)
                        {
                            int i = y * Width + x;
                            if (filled[i]) continue;
                            float sr = 0, sg = 0, sb = 0; int cnt = 0;
                            for (int oy = -1; oy <= 1; oy++)
                            {
                                int ny = y + oy;
                                if (ny < 0 || ny >= Height) continue;
                                for (int ox = -1; ox <= 1; ox++)
                                {
                                    int nx = x + ox;
                                    if (nx < 0 || nx >= Width) continue;
                                    int j = ny * Width + nx;
                                    if (!filled[j]) continue;
                                    sr += rr[j]; sg += gg[j]; sb += bb[j]; cnt++;
                                }
                            }
                            if (cnt > 0) { rr[i] = sr / cnt; gg[i] = sg / cnt; bb[i] = sb / cnt; next[i] = true; }
                        }
                    filled = next;
                }
            }
            for (int i = 0; i < n; i++)
            {
                px[i] = new Color32(ToByte(rr[i]), ToByte(gg[i]), ToByte(bb[i]), ToByte(_a[i]));
            }
            return px;
        }

        static byte ToByte(float v)
        {
            int i = (int)(v * 255f + 0.5f);
            return (byte)(i < 0 ? 0 : (i > 255 ? 255 : i));
        }
    }
}
