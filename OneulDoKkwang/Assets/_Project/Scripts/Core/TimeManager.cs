using System;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 게임 내 시계. 실제 1분 = 게임 1시간. Time.deltaTime 기준이라 메뉴가 열려 일시정지되면 시계도 멈춘다.
    /// </summary>
    public sealed class TimeManager : MonoBehaviour
    {
        [Tooltip("시간 배속 (디버그용, 1 = 실제 1분에 게임 1시간)")]
        public float speed = 1f;
        public bool paused;

        public double TotalMinutes { get; private set; }
        public float Hour => GameClock.HourOfDay(TotalMinutes);
        public int Day => GameClock.DayIndex(TotalMinutes);
        public Weekday Weekday => GameClock.WeekdayAt(TotalMinutes);
        public TimeOfDay Period { get; private set; }

        public event Action<TimeOfDay> PeriodChanged;
        public event Action<int> HourChanged;   // 0~23
        public event Action<int> DayChanged;

        int _lastHour = -1;
        int _lastDay = -1;

        public void Init(double totalMinutes)
        {
            TotalMinutes = totalMinutes;
            Period = GameClock.Period(TotalMinutes);
            _lastHour = (int)Hour;
            _lastDay = Day;
        }

        void Update()
        {
            if (paused) return;
            Advance(Time.deltaTime * GameClock.GameMinutesPerRealSecond * speed);
        }

        /// <summary>게임 분 단위로 시계를 진행 (디버그 버튼도 사용).</summary>
        public void Advance(double gameMinutes)
        {
            if (gameMinutes <= 0) return;
            TotalMinutes += gameMinutes;
            int hour = (int)Hour;
            int day = Day;
            if (day != _lastDay)
            {
                _lastDay = day;
                if (DayChanged != null) DayChanged(day);
            }
            if (hour != _lastHour)
            {
                // 여러 시간을 한 번에 건너뛰면 마지막 시각만 알린다
                _lastHour = hour;
                if (HourChanged != null) HourChanged(hour);
            }
            var p = GameClock.Period(TotalMinutes);
            if (p != Period)
            {
                Period = p;
                if (PeriodChanged != null) PeriodChanged(p);
            }
        }

        public string Formatted => GameClock.Format(TotalMinutes);
    }
}
