using System;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>날씨: 맑음 / 비. 게임 1시간마다 비가 올지 굴린다. 비가 오면 특정 어종 확률이 올라간다.</summary>
    public sealed class WeatherManager : MonoBehaviour
    {
        [Tooltip("맑을 때 매 게임시간 비가 시작될 확률")]
        [Range(0f, 1f)] public float rainChancePerHour = 0.13f;
        [Tooltip("비가 오는 시간 범위 (게임 시간)")]
        public Vector2 rainHours = new Vector2(2f, 5f);
        [Tooltip("비가 그친 뒤 최소 맑은 시간")]
        public float clearCooldownHours = 2f;

        public WeatherType Current { get; private set; }
        public float HoursLeft { get; private set; }
        /// <summary>0 = 맑음, 1 = 비 (부드럽게 변함, 연출용).</summary>
        public float RainBlend { get; private set; }

        public event Action<WeatherType> Changed;

        float _cooldown;

        public void Init(WeatherType current, float hoursLeft)
        {
            Current = current;
            HoursLeft = hoursLeft;
            RainBlend = current == WeatherType.Rain ? 1f : 0f;
            if (Game.Clock != null) Game.Clock.HourChanged += OnHour;
        }

        void OnDestroy()
        {
            if (Game.Clock != null) Game.Clock.HourChanged -= OnHour;
        }

        void OnHour(int hour)
        {
            if (Current == WeatherType.Rain)
            {
                HoursLeft -= 1f;
                if (HoursLeft <= 0f)
                {
                    _cooldown = clearCooldownHours;
                    Set(WeatherType.Clear, 0f);
                }
            }
            else
            {
                if (_cooldown > 0f)
                {
                    _cooldown -= 1f;
                    return;
                }
                if (Game.Rng.NextDouble() < rainChancePerHour)
                    Set(WeatherType.Rain, Game.Range(rainHours.x, rainHours.y));
            }
        }

        public void Set(WeatherType w, float hours)
        {
            HoursLeft = hours;
            if (w == Current) return;
            Current = w;
            if (Changed != null) Changed(w);
            if (Game.Saver != null) Game.Saver.MarkDirty();
        }

        /// <summary>디버그: 날씨 토글.</summary>
        public void Toggle()
        {
            if (Current == WeatherType.Rain) Set(WeatherType.Clear, 0f);
            else Set(WeatherType.Rain, 4f);
        }

        void Update()
        {
            float target = Current == WeatherType.Rain ? 1f : 0f;
            RainBlend = Mathf.MoveTowards(RainBlend, target, Time.unscaledDeltaTime / 2.5f);
        }
    }
}
