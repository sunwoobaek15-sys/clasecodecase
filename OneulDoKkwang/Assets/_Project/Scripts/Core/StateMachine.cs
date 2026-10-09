using System;
using System.Collections.Generic;

namespace OneulDoKkwang
{
    /// <summary>
    /// 아주 작은 enum 기반 상태머신. 상태마다 Enter / Update / Exit 콜백을 등록한다.
    /// </summary>
    public sealed class StateMachine<T> where T : struct, Enum
    {
        sealed class Handlers
        {
            public Action enter;
            public Action<float> update;
            public Action exit;
        }

        readonly Dictionary<T, Handlers> _map = new Dictionary<T, Handlers>();
        bool _started;

        public T Current { get; private set; }
        public T Previous { get; private set; }
        public float TimeInState { get; private set; }
        /// <summary>(이전, 다음)</summary>
        public event Action<T, T> Changed;

        public void Add(T state, Action enter = null, Action<float> update = null, Action exit = null)
        {
            _map[state] = new Handlers { enter = enter, update = update, exit = exit };
        }

        public bool Is(T state)
        {
            return EqualityComparer<T>.Default.Equals(Current, state);
        }

        public void Start(T state)
        {
            _started = true;
            Previous = state;
            Current = state;
            TimeInState = 0f;
            Handlers h;
            if (_map.TryGetValue(state, out h) && h.enter != null) h.enter();
        }

        public void Go(T next)
        {
            if (!_started)
            {
                Start(next);
                return;
            }
            Handlers h;
            if (_map.TryGetValue(Current, out h) && h.exit != null) h.exit();
            Previous = Current;
            Current = next;
            TimeInState = 0f;
            if (Changed != null) Changed(Previous, Current);
            if (_map.TryGetValue(next, out h) && h.enter != null) h.enter();
        }

        public void Update(float dt)
        {
            if (!_started) return;
            TimeInState += dt;
            Handlers h;
            if (_map.TryGetValue(Current, out h) && h.update != null) h.update(dt);
        }
    }
}
