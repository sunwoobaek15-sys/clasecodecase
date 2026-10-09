using System;

namespace OneulDoKkwang
{
    /// <summary>
    /// 게임 시계 계산 (순수 C#). 실제 1분 = 게임 1시간 → 실제 1초 = 게임 1분.
    /// totalMinutes 는 게임 시작(0일차 00:00)부터 흐른 게임 분.
    /// </summary>
    public static class GameClock
    {
        public const double MinutesPerDay = 1440.0;
        /// <summary>실제 1초에 흐르는 게임 분 (1분 = 1시간).</summary>
        public const double GameMinutesPerRealSecond = 1.0;
        /// <summary>0일차의 요일. 금요일에 휴가 도착.</summary>
        public const Weekday FirstDay = Weekday.Fri;
        /// <summary>처음 시작 시각: 0일차 15:00 (조금 지나면 노을).</summary>
        public const double StartMinutes = 15 * 60;

        public const float DayStartHour = 6f;
        public const float SunsetStartHour = 17f;
        public const float NightStartHour = 20f;

        public static int DayIndex(double totalMinutes)
        {
            return (int)Math.Floor(totalMinutes / MinutesPerDay);
        }

        /// <summary>0 ~ 24 (소수 포함).</summary>
        public static float HourOfDay(double totalMinutes)
        {
            double m = totalMinutes % MinutesPerDay;
            if (m < 0) m += MinutesPerDay;
            return (float)(m / 60.0);
        }

        public static TimeOfDay PeriodAt(float hour)
        {
            if (hour >= DayStartHour && hour < SunsetStartHour) return TimeOfDay.Day;
            if (hour >= SunsetStartHour && hour < NightStartHour) return TimeOfDay.Sunset;
            return TimeOfDay.Night;
        }

        public static TimeOfDay Period(double totalMinutes)
        {
            return PeriodAt(HourOfDay(totalMinutes));
        }

        public static Weekday WeekdayOf(int dayIndex)
        {
            int w = ((int)FirstDay + dayIndex) % 7;
            if (w < 0) w += 7;
            return (Weekday)w;
        }

        public static Weekday WeekdayAt(double totalMinutes)
        {
            return WeekdayOf(DayIndex(totalMinutes));
        }

        /// <summary>"금 15:24" 형식.</summary>
        public static string Format(double totalMinutes)
        {
            float h = HourOfDay(totalMinutes);
            int hh = (int)h;
            int mm = (int)((h - hh) * 60f);
            if (mm > 59) mm = 59;
            return WeekdayAt(totalMinutes).Korean() + " " + hh.ToString("00") + ":" + mm.ToString("00");
        }

        /// <summary>
        /// 하늘 색 블렌딩용 가중치 (낮, 노을, 밤). 합은 1.
        /// 새벽(05~07시)엔 노을 팔레트를 살짝 섞어 분홍빛 아침을 만든다.
        /// </summary>
        public static void SkyWeights(float hour, out float day, out float sunset, out float night)
        {
            day = 0f; sunset = 0f; night = 0f;
            if (hour < 4.5f) { night = 1f; }
            else if (hour < 5.5f) { float t = Smooth((hour - 4.5f) / 1f); night = 1f - t; sunset = t * 0.6f; day = t * 0.4f; }
            else if (hour < 7f) { float t = Smooth((hour - 5.5f) / 1.5f); sunset = 0.6f * (1f - t); day = 1f - sunset; }
            else if (hour < 16.5f) { day = 1f; }
            else if (hour < 18f) { float t = Smooth((hour - 16.5f) / 1.5f); day = 1f - t; sunset = t; }
            else if (hour < 19.2f) { sunset = 1f; }
            else if (hour < 20.5f) { float t = Smooth((hour - 19.2f) / 1.3f); sunset = 1f - t; night = t; }
            else { night = 1f; }
        }

        static float Smooth(float t)
        {
            if (t < 0f) t = 0f; else if (t > 1f) t = 1f;
            return t * t * (3f - 2f * t);
        }
    }
}
