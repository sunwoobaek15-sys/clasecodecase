using System;

namespace OneulDoKkwang
{
    /// <summary>도감 등급. 흔함/희귀/전설/???</summary>
    public enum CatchRarity
    {
        Common = 0,
        Rare = 1,
        Legendary = 2,
        Mystery = 3,
    }

    /// <summary>출현 장소 (여러 곳 선택 가능).</summary>
    [Flags]
    public enum LocationMask
    {
        None = 0,
        Beach = 1 << 0,
        Pier = 1 << 1,
        Volcano = 1 << 2,
        Cloud = 1 << 3,
        All = Beach | Pier | Volcano | Cloud,
    }

    /// <summary>출현 시간대 (여러 개 선택 가능).</summary>
    [Flags]
    public enum TimeMask
    {
        None = 0,
        Day = 1 << 0,
        Sunset = 1 << 1,
        Night = 1 << 2,
        All = Day | Sunset | Night,
    }

    /// <summary>게임 내 시간대. 낮 06~17시, 노을 17~20시, 밤 20~06시.</summary>
    public enum TimeOfDay
    {
        Day = 0,
        Sunset = 1,
        Night = 2,
    }

    public enum WeatherType
    {
        Clear = 0,
        Rain = 1,
    }

    public enum WeatherRule
    {
        Any = 0,
        ClearOnly = 1,
        RainOnly = 2,
    }

    /// <summary>장소 연출 테마. LocationData가 하나씩 가진다.</summary>
    public enum LocationTheme
    {
        Beach = 0,
        Pier = 1,
        Volcano = 2,
        Cloud = 3,
    }

    /// <summary>릴 감기 미니게임에서 물고기 아이콘이 움직이는 방식.</summary>
    public enum MovePattern
    {
        Calm = 0,        // 차분
        Darting = 1,     // 쉬다가 휙
        Aggressive = 2,  // 난폭
        Teleport = 3,    // 순간이동
        Still = 4,       // 아예 안 움직임
        Sinker = 5,      // 가라앉음
        Floater = 6,     // 위쪽에 둥둥
        Surf = 7,        // 큰 파도 타기
        Hula = 8,        // 박자 맞춰 좌우(위아래)
        Lazy = 9,        // 귀찮음
        Avoider = 10,    // 초록 바를 피함
        Fainter = 11,    // 가끔 기절
        Slippery = 12,   // 미끌미끌 진동
        Bureaucrat = 13, // 계단식 이동 (도장 쾅)
        KingPhases = 14, // 전설: 3단계 페이즈
        Chaos = 15,      // 패턴이 수시로 바뀜 (논쟁)
        Mystery = 16,    // ???: 모든 패턴을 흉내냄
    }

    [Flags]
    public enum CatchTags
    {
        None = 0,
        Fish = 1 << 0,
        Junk = 1 << 1,
        Food = 1 << 2,
        Tropical = 1 << 3,
        Grilled = 1 << 4,
        Weird = 1 << 5,
        Sea = 1 << 6,
    }

    /// <summary>잡았을 때 특수 연출.</summary>
    public enum CatchSpecial
    {
        None = 0,
        Release = 1,    // 보호종: 바로 방생 (판매가 0)
        LongName = 2,   // 이름이 너무 김
        Legendary = 3,  // 전설 연출
        Mystery = 4,    // ??? 연출
    }

    /// <summary>코드로 그리는 도감 아이콘의 모양.</summary>
    public enum IconShape
    {
        Fish = 0,
        Puffer,
        Sunfish,
        Eel,
        Seahorse,
        Turtle,
        Jellyfish,
        Shark,
        Boot,
        Bungeoppang,
        Rock,
        Document,
        Router,
        Pineapple,
        Pizza,
        Octopus,
        Coconut,
        Squid,
        Sheep,
        Parcel,
        Earbud,
        Ticket,
        KingFish,
        SurfFish,
        OfficeFish,
        GrilledFish,
        TropicalFish,
        Tuna,
    }

    public enum BaitShape
    {
        Worm = 0,
        SpamMusubi,
        Shrimp,
        PineappleChunk,
        Lure,
        GoldenWorm,
    }

    public enum Weekday
    {
        Mon = 0,
        Tue,
        Wed,
        Thu,
        Fri,
        Sat,
        Sun,
    }

    public static class EnumText
    {
        public static string Korean(this CatchRarity r)
        {
            switch (r)
            {
                case CatchRarity.Common: return "흔함";
                case CatchRarity.Rare: return "희귀";
                case CatchRarity.Legendary: return "전설";
                default: return "???";
            }
        }

        public static string Korean(this TimeOfDay t)
        {
            switch (t)
            {
                case TimeOfDay.Day: return "낮";
                case TimeOfDay.Sunset: return "노을";
                default: return "밤";
            }
        }

        public static string Korean(this WeatherType w)
        {
            return w == WeatherType.Rain ? "비" : "맑음";
        }

        public static string Korean(this Weekday d)
        {
            switch (d)
            {
                case Weekday.Mon: return "월";
                case Weekday.Tue: return "화";
                case Weekday.Wed: return "수";
                case Weekday.Thu: return "목";
                case Weekday.Fri: return "금";
                case Weekday.Sat: return "토";
                default: return "일";
            }
        }

        public static string Korean(this LocationTheme t)
        {
            switch (t)
            {
                case LocationTheme.Beach: return "와이키키 해변";
                case LocationTheme.Pier: return "산호초 부두";
                case LocationTheme.Volcano: return "용암 낚시터";
                default: return "구름 낚시터";
            }
        }

        public static LocationMask ToMask(this LocationTheme t)
        {
            return (LocationMask)(1 << (int)t);
        }

        public static TimeMask ToMask(this TimeOfDay t)
        {
            return (TimeMask)(1 << (int)t);
        }
    }
}
