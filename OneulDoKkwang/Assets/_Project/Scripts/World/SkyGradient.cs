using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 하늘 그라데이션 (아래 주황 → 분홍 → 위 보라 같은 3색). 카메라 x 를 따라다닌다.
    /// </summary>
    public sealed class SkyGradient : MonoBehaviour
    {
        public float horizonY = LocationLayout.WaterY;
        public float middleY = LocationLayout.WaterY + 3.6f;
        public float topY = 6.2f;
        public float halfWidth = 40f;

        Mesh _mesh;
        readonly List<Vector3> _verts = new List<Vector3>();
        readonly List<Color> _cols = new List<Color>();
        List<int> _tris;
        Color _top, _mid, _horizon;
        bool _dirty = true;

        public void Init()
        {
            MeshBits.CreateRenderer(transform, "SkyMesh", Sorting.Sky, out _mesh);
            float[] ys = { -20f, horizonY, middleY, topY, topY + 20f };
            _verts.Clear();
            for (int c = 0; c < 2; c++)
            {
                float x = c == 0 ? -halfWidth : halfWidth;
                for (int r = ys.Length - 1; r >= 0; r--) _verts.Add(new Vector3(x, ys[r], 0f));
            }
            _tris = MeshBits.GridTriangles(2, ys.Length);
            for (int i = 0; i < _verts.Count; i++) _cols.Add(Color.black);
            MeshBits.Push(_mesh, _verts, _cols, _tris, true);
        }

        public void SetColors(Color top, Color middle, Color horizon)
        {
            if (top == _top && middle == _mid && horizon == _horizon) return;
            _top = top; _mid = middle; _horizon = horizon;
            _dirty = true;
        }

        void LateUpdate()
        {
            transform.position = new Vector3(CameraRig.X, 0f, 0f);
            if (!_dirty || _mesh == null) return;
            _dirty = false;
            // 정점 순서: (위 → 아래) top+20, top, middle, horizon, -20
            var row = new[] { _top, _top, _mid, _horizon, _horizon };
            for (int c = 0; c < 2; c++)
                for (int r = 0; r < row.Length; r++)
                    _cols[c * row.Length + r] = SpriteFactory.VertexColor(row[r]);
            _mesh.SetColors(_cols);
        }
    }
}
