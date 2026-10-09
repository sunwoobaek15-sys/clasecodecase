using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>정점 색 메시(하늘, 물, 땅)를 만드는 공용 헬퍼.</summary>
    public static class MeshBits
    {
        public static MeshRenderer CreateRenderer(Transform parent, string name, int order, out Mesh mesh)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var mf = go.AddComponent<MeshFilter>();
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = SpriteFactory.SpriteMaterial;
            mr.sortingOrder = order;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            mesh = new Mesh { name = name };
            mesh.MarkDynamic();
            mf.sharedMesh = mesh;
            return mr;
        }

        /// <summary>
        /// columns 개의 세로 줄 × rows 개의 가로 줄 격자의 삼각형 인덱스.
        /// 정점 순서: column 마다 rows 개 (위 → 아래).
        /// </summary>
        public static List<int> GridTriangles(int columns, int rows)
        {
            var tris = new List<int>((columns - 1) * (rows - 1) * 6);
            for (int c = 0; c < columns - 1; c++)
            {
                for (int r = 0; r < rows - 1; r++)
                {
                    int a = c * rows + r;
                    int b = a + 1;
                    int d = a + rows;
                    int e = d + 1;
                    tris.Add(a); tris.Add(d); tris.Add(b);
                    tris.Add(b); tris.Add(d); tris.Add(e);
                }
            }
            return tris;
        }

        public static void Push(Mesh mesh, List<Vector3> verts, List<Color> cols, List<int> tris, bool setTriangles)
        {
            if (setTriangles)
            {
                mesh.Clear();
                mesh.SetVertices(verts);
                mesh.SetColors(cols);
                mesh.SetTriangles(tris, 0);
            }
            else
            {
                mesh.SetVertices(verts);
                mesh.SetColors(cols);
            }
            mesh.bounds = new Bounds(Vector3.zero, new Vector3(400f, 400f, 10f));
        }
    }
}
