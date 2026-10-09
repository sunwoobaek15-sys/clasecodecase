using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 프로토타입용 간단한 서비스 로케이터. GameBootstrap 이 채워 넣는다.
    /// (Enter Play Mode Options 로 도메인 리로드를 꺼도 안전하도록 시작 시 초기화)
    /// </summary>
    public static class Game
    {
        public static GameManager State;
        public static TimeManager Clock;
        public static WeatherManager Weather;
        public static AudioManager Audio;
        public static SaveManager Saver;
        public static GameDirector Director;
        public static WorldBuilder World;
        public static EnvironmentController Environment;
        public static CameraRig Cam;
        public static EffectsManager Fx;
        public static GameUI UI;
        public static FishingController Fishing;
        public static PlayerAvatar Player;
        public static CatCompanion Cat;
        public static BucketView Bucket;
        public static TweenRunner Tweens;
        public static TimeScaleController TimeScale;

        /// <summary>게임 전체에서 쓰는 난수 (System.Random: 테스트 가능).</summary>
        public static System.Random Rng = new System.Random();

        public static bool Ready => State != null && UI != null && Fishing != null;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void ResetStatics()
        {
            State = null; Clock = null; Weather = null; Audio = null; Saver = null; Director = null;
            World = null; Environment = null; Cam = null; Fx = null; UI = null; Fishing = null;
            Player = null; Cat = null; Bucket = null; Tweens = null; TimeScale = null;
            Rng = new System.Random();
            SpriteFactory.ResetCache();
            FunnyLines.Reset(System.Environment.TickCount);
        }

        public static float Range(float min, float max)
        {
            return min + (float)Rng.NextDouble() * (max - min);
        }

        public static bool Chance(float p)
        {
            return Rng.NextDouble() < p;
        }
    }
}
