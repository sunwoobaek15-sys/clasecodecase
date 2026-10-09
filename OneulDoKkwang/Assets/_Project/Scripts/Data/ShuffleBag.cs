using System.Collections.Generic;

namespace OneulDoKkwang
{
    /// <summary>
    /// 전부 한 번씩 나온 뒤에야 다시 섞는 랜덤 뽑기. 같은 대사가 연달아 나오지 않게 "골고루" 뽑는다.
    /// </summary>
    public sealed class ShuffleBag<T>
    {
        readonly List<T> _items;
        readonly List<T> _pool = new List<T>();
        readonly System.Random _rng;
        T _last;
        bool _hasLast;
        bool _reserveFirst;

        public ShuffleBag(IEnumerable<T> items, System.Random rng)
        {
            _items = new List<T>(items);
            _rng = rng ?? new System.Random();
        }

        public int Count => _items.Count;

        public T Next()
        {
            if (_items.Count == 0) return default(T);
            if (_pool.Count == 0)
            {
                _pool.AddRange(_items);
                _reserveFirst = false;
                // 직전에 나온 항목은 새 판의 맨 마지막에 나오도록 0번 자리에 묶어 둔다 (연속 중복 방지).
                if (_hasLast && _pool.Count > 1)
                {
                    int idx = _pool.IndexOf(_last);
                    if (idx >= 0)
                    {
                        _pool.RemoveAt(idx);
                        _pool.Insert(0, _last);
                        _reserveFirst = true;
                    }
                }
            }
            int pick = (_reserveFirst && _pool.Count > 1) ? 1 + _rng.Next(_pool.Count - 1) : _rng.Next(_pool.Count);
            T item = _pool[pick];
            _pool.RemoveAt(pick);
            _last = item;
            _hasLast = true;
            return item;
        }
    }
}
