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
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var gm = go.AddComponent<GroundMesh>();
            gm.Build(profile, top, bottom, order);
            return gm;
        }

        public void Build(List<Vector2> profile, Color top, Color bottom, int order)
        {
            MeshBits.CreateRenderer(transform, "Mesh", order, out _mesh);
            var pts = Densify(profile, 0.3f);
            _verts.Clear(); _baseCols.Clear();
            Color rim = top.Shade(1.15f);
            Color mid = Color.Lerp(top, bottom, 0.45f);
            const int rows = 4;
            foreach (var p in pts)
            {
                _verts.Add(new Vector3(p.x, p.y + 0.03f, 0f)); _baseCols.Add(rim);
                _verts.Add(new Vector3(p.x, p.y - 0.08f, 0f)); _baseCols.Add(top);
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
