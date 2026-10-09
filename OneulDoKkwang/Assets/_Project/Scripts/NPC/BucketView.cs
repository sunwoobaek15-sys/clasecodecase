using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>주인공 옆 양동이. 최근에 잡은 것 3개가 빼꼼 보인다 (고양이가 훔쳐 먹는 대상).</summary>
    public sealed class BucketView : MonoBehaviour
    {
        public SpriteRenderer bucket;
        readonly List<SpriteRenderer> _items = new List<SpriteRenderer>();
        readonly List<CatchData> _contents = new List<CatchData>();
        const int Max = 3;

        public int Count => _contents.Count;

        public static BucketView Create(Transform parent)
        {
            var go = new GameObject("Bucket (양동이)");
            go.transform.SetParent(parent, false);
            var b = go.AddComponent<BucketView>();
            b.bucket = SpriteFactory.Renderer(go.transform, "Bucket", SpriteFactory.Get(SpriteKeys.Bucket), Sorting.Bucket);
            Tintable.Attach(b.bucket, Tintable.Mode.Near);
            return b;
        }

        public void PlaceAt(Vector2 p)
        {
            transform.position = new Vector3(p.x, p.y, 0f);
        }

        public Vector3 RimPosition => transform.position + new Vector3(0f, WorldPainter.BucketRimHeight, 0f);

        public void Add(CatchData c)
        {
            if (c == null) return;
            if (_contents.Count >= Max)
            {
                _contents.RemoveAt(0);
                Destroy(_items[0].gameObject);
                _items.RemoveAt(0);
            }
            _contents.Add(c);
            var sr = SpriteFactory.Renderer(transform, "InBucket: " + c.displayName, SpriteFactory.Icon(c), Sorting.Bucket - 1);
            Tintable.Attach(sr, Tintable.Mode.Near);
            _items.Add(sr);
            Relayout();
            Tweens.Scale(sr.transform, Vector3.zero, sr.transform.localScale, 0.35f, Ease.OutBack);
        }

        void Relayout()
        {
            for (int i = 0; i < _items.Count; i++)
            {
                var tr = _items[i].transform;
                float x = (i - (_items.Count - 1) * 0.5f) * 0.2f;
                tr.localPosition = new Vector3(x, WorldPainter.BucketRimHeight - 0.02f + (i % 2) * 0.05f, 0f);
                tr.localRotation = Quaternion.Euler(0f, 0f, 60f + i * 25f);
                tr.localScale = new Vector3(0.36f, 0.36f, 1f);
            }
        }

        /// <summary>맨 위(마지막) 것을 꺼낸다. 없으면 null.</summary>
        public CatchData RemoveTop()
        {
            if (_contents.Count == 0) return null;
            int i = _contents.Count - 1;
            var c = _contents[i];
            _contents.RemoveAt(i);
            var sr = _items[i];
            _items.RemoveAt(i);
            if (Game.Fx != null) Game.Fx.Sparkles(sr.transform.position, Color.white, 4, 0.4f);
            Destroy(sr.gameObject);
            Relayout();
            return c;
        }
    }
}
