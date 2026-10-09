using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>윗면 프로필(점 목록)로 만든 땅/해저 메시. 정점 색 그라데이션 + 윗면 테두리 하이라이트.</summary>
    public sealed class GroundMesh : MonoBehaviour
    {
        Mesh _mesh;
        readonly List<Vector3> _verts = new List<Vector3>();
        readonly List<Color> _baseCols = new List<Color>();
        readonly List<Color> _cols = new List<Color>();
        Color _tint = Color.white;
        bool _dirty;

        public static GroundMesh Create(Transform parent, string name, List<Vector2> profile, Color top, Color bottom, int order)
        {
            return Create(parent, name, profile, top, bottom, order, Color.clear, 0f);
        }

        /// <param name="band">윗면 띠 색 (예: 용암 바위 위 잔디). 알파 0 이면 띠 없음.</param>
        /// <param name="bandDepth">띠 두께 (월드). 물속으로 들어간 부분은 띠 없이 아래 색.</param>
        public static GroundMesh Create(Transform parent, string name, List<Vector2> profile, Color top, Color bottom, int order, Color band, float bandDepth)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var gm = go.AddComponent<GroundMesh>();
            gm.Build(profile, top, bottom, order, band, bandDepth);
            return gm;
        }

        public void Build(List<Vector2> profile, Color top, Color bottom, int order, Color band, float bandDepth)
        {
            MeshBits.CreateRenderer(transform, "Mesh", order, out _mesh);
            var pts = Densify(profile, 0.3f);
            _verts.Clear(); _baseCols.Clear();
            Color mid = Color.Lerp(top, bottom, 0.45f);
            bool hasBand = band.a > 0.01f && bandDepth > 0.01f;
            int rows = hasBand ? 6 : 4;
            foreach (var p in pts)
            {
                if (!hasBand)
                {
                    _verts.Add(new Vector3(p.x, p.y + 0.03f, 0f)); _baseCols.Add(top.Shade(1.15f));
                    _verts.Add(new Vector3(p.x, p.y - 0.08f, 0f)); _baseCols.Add(top);
                }
                else
                {
                    // 물 밖(수면 위)에서만 띠를 보이게
                    float w = Mathf.Clamp01((p.y - (LocationLayout.WaterY - 0.05f)) / 0.4f);
                    Color b = Color.Lerp(top, band, w);
                    _verts.Add(new Vector3(p.x, p.y + 0.03f, 0f)); _baseCols.Add(Color.Lerp(top.Shade(1.15f), band.Shade(1.12f), w));
                    _verts.Add(new Vector3(p.x, p.y - 0.06f, 0f)); _baseCols.Add(b);
                    _verts.Add(new Vector3(p.x, p.y - bandDepth, 0f)); _baseCols.Add(Color.Lerp(top, band.Shade(0.78f), w));
                    _verts.Add(new Vector3(p.x, p.y - bandDepth - 0.05f, 0f)); _baseCols.Add(top);
                }
                _verts.Add(new Vector3(p.x, p.y - 2.6f, 0f)); _baseCols.Add(mid);
                _verts.Add(new Vector3(p.x, -18f, 0f)); _baseCols.Add(bottom);
            }
            var tris = MeshBits.GridTriangles(pts.Count, rows);
            _cols.Clear();
            _cols.AddRange(_baseCols);
            MeshBits.Push(_mesh, _verts, _cols, tris, true);
            _dirty = true;
        }

        static List<Vector2> Densify(List<Vector2> src, float step)
        {
            var o = new List<Vector2>();
            for (int i = 0; i < src.Count - 1; i++)
            {
                var a = src[i];
                var b = src[i + 1];
                int n = Mathf.Max(1, Mathf.CeilToInt(Vector2.Distance(a, b) / step));
                for (int k = 0; k < n; k++) o.Add(Vector2.Lerp(a, b, k / (float)n));
            }
            o.Add(src[src.Count - 1]);
            return o;
        }

        public void SetTint(Color tint)
        {
            if (tint == _tint) return;
            _tint = tint;
            _dirty = true;
        }

        void LateUpdate()
        {
            if (!_dirty || _mesh == null) return;
            _dirty = false;
            for (int i = 0; i < _baseCols.Count; i++)
            {
                var c = _baseCols[i] * _tint;
                c.a = 1f;
                _cols[i] = SpriteFactory.VertexColor(c);
            }
            _mesh.SetColors(_cols);
        }
    }
}
