using System;
using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 입질 타이밍: 착수 후 랜덤 시간 동안 깔짝(가짜 입질)하다가 진짜 입질.
    /// 입질 후 hookWindow(기본 0.6초) 안에 탭해야 걸린다.
    /// </summary>
    public sealed class BiteSystem : MonoBehaviour
    {
        [Tooltip("입질 후 챔질 가능 시간 (초)")]
        public float hookWindow = 0.6f;
        [Tooltip("이 시간 안에 챔질하면 '칼챔질' 보너스")]
        public float quickHookTime = 0.18f;
        [Tooltip("입질까지 기다리는 시간 범위 (초, 미끼 배율 적용 전)")]
        public Vector2 waitRange = new Vector2(2.2f, 6.2f);

        readonly List<float> _nibbles = new List<float>();
        int _nextNibble;
        float _t;
        float _window;

        public CatchData Target { get; private set; }
        public float WaitTime { get; private set; }
        public float WindowElapsed => _window;
        public float WindowProgress => Mathf.Clamp01(_window / Mathf.Max(0.01f, hookWindow));

        public event Action Nibble;

        public void Begin(CatchData target, BaitData bait, WeatherType weather)
        {
            Target = target;
            float w = Game.Range(waitRange.x, waitRange.y);
            if (bait != null) w *= bait.biteSpeed;
            if (weather == WeatherType.Rain) w *= 0.85f;
            if (target != null && target.IsBigEvent) w *= 1.3f;
            WaitTime = Mathf.Max(1.2f, w);
            _t = 0f;
            _nibbles.Clear();
            int n = Game.Rng.Next(0, 4);
            for (int i = 0; i < n; i++) _nibbles.Add(Game.Range(0.5f, WaitTime - 0.45f));
            _nibbles.Sort();
            _nextNibble = 0;
        }

        /// <summary>대기 진행. 진짜 입질 시각이 되면 true.</summary>
        public bool TickWait(float dt)
        {
            _t += dt;
            while (_nextNibble < _nibbles.Count && _t >= _nibbles[_nextNibble])
            {
                _nextNibble++;
                if (Nibble != null) Nibble();
            }
            return _t >= WaitTime;
        }

        public void StartWindow()
        {
            _window = 0f;
        }

        /// <summary>입질 창 진행. 시간이 지나 놓쳤으면 true.</summary>
        public bool TickWindow(float dt)
        {
            _window += dt;
            return _window > hookWindow;
        }

        public bool IsQuickHook => _window <= quickHookTime;
    }
}
