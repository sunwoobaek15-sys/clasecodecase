using System;

namespace OneulDoKkwang
{
    /// <summary>릴 감기 미니게임 수치. 낚싯대와 물고기 난이도로 만든다.</summary>
    public sealed class ReelSettings
    {
        /// <summary>초록 바 높이 (트랙 대비 비율).</summary>
        public float barSize = 0.24f;
        public float riseAccel = 3.8f;
        public float fallAccel = 3.1f;
        public float maxRiseSpeed = 1.6f;
        public float maxFallSpeed = 1.85f;
        /// <summary>바닥에 떨어질 때 튕기는 정도.</summary>
        public float bounce = 0.3f;
        public float gainPerSec = 0.28f;
        public float lossPerSec = 0.2f;
        public float startProgress = 0.3f;
        /// <summary>시작 직후 게이지가 줄지 않는 시간.</summary>
        public float startGrace = 0.7f;
        /// <summary>물고기 아이콘 판정 여유.</summary>
        public float tolerance = 0.03f;
        public float difficulty = 0.3f;
        public MovePattern pattern = MovePattern.Calm;

        public static ReelSettings For(CatchData c, RodData rod, bool quickHook)
        {
            var s = new ReelSettings();
            float d = c != null ? c.difficulty : 0.3f;
            s.difficulty = d;
            s.pattern = c != null ? c.movePattern : MovePattern.Calm;
            float bar = rod != null ? rod.barSize : 0.24f;
            float power = rod != null ? rod.reelPower : 1f;
            if (c != null && c.rarity == CatchRarity.Legendary) bar *= 0.92f;
            if (c != null && c.rarity == CatchRarity.Mystery) bar *= 0.9f;
            s.barSize = bar;
            s.gainPerSec = 0.23f * power * (1f - 0.25f * d);
            s.lossPerSec = 0.1f + 0.14f * d;
            s.startProgress = quickHook ? 0.4f : 0.3f;
            return s;
        }
    }

    /// <summary>
    /// 스타듀밸리식 릴 감기 미니게임의 순수 로직.
    /// 홀드하면 초록 바가 올라가고(가속), 놓으면 떨어진다. 물고기가 바 안에 있으면 진행도 상승, 밖이면 하락.
    /// 진행도 100% = 성공, 0% = 실패.
    /// </summary>
    public sealed class ReelModel
    {
        public readonly ReelSettings Settings;
        public readonly FishMotion Fish;

        public float BarPos;
        public float BarVel;
        public float BarSize;
        public float Progress;
        public float Elapsed;
        public bool InZone;
        public bool Done;
        public bool Success;
        /// <summary>도달했던 최고 진행도 (아깝다 연출용).</summary>
        public float BestProgress;
        public int Phase = 1;
        public bool PhaseChanged;

        float _graceAfterBlink;

        public ReelModel(ReelSettings settings, int seed)
        {
            Settings = settings;
            BarSize = settings.barSize;
            Progress = settings.startProgress;
            BestProgress = Progress;
            BarPos = 0f;
            var rng = new System.Random(seed);
            Fish = FishMotion.Create(settings.pattern);
            Fish.Init(rng, settings.difficulty, 0.25f + (float)rng.NextDouble() * 0.5f);
        }

        public float BarCenter => BarPos + BarSize * 0.5f;

        public ReelSnapshot Snapshot()
        {
            return new ReelSnapshot { barPos = BarPos, barSize = BarSize, progress = Progress, time = Elapsed };
        }

        public void Tick(float dt, bool holding)
        {
            PhaseChanged = false;
            if (Done || dt <= 0f) return;
            if (dt > 0.05f) dt = 0.05f;
            Elapsed += dt;

            // --- 초록 바 물리
            var s = Settings;
            BarVel += (holding ? s.riseAccel : -s.fallAccel) * dt;
            if (BarVel > s.maxRiseSpeed) BarVel = s.maxRiseSpeed;
            if (BarVel < -s.maxFallSpeed) BarVel = -s.maxFallSpeed;
            BarPos += BarVel * dt;
            float maxPos = 1f - BarSize;
            if (BarPos < 0f)
            {
                BarPos = 0f;
                BarVel = BarVel < -0.3f ? -BarVel * s.bounce : 0f;
            }
            if (BarPos > maxPos)
            {
                BarPos = maxPos;
                if (BarVel > 0f) BarVel = 0f;
            }

            // --- 물고기
            Fish.Tick(dt, Snapshot());
            if (Fish.Blinked) _graceAfterBlink = 0.5f;
            if (_graceAfterBlink > 0f) _graceAfterBlink -= dt;

            // --- 페이즈 (바다의 왕)
            int phase = Fish.Phase;
            if (phase != Phase)
            {
                Phase = phase;
                PhaseChanged = true;
                float mul = phase == 2 ? 0.95f : (phase >= 3 ? 0.9f : 1f);
                float center = BarCenter;
                BarSize = s.barSize * mul;
                BarPos = Math.Max(0f, Math.Min(1f - BarSize, center - BarSize * 0.5f));
            }

            // --- 판정
            float f = Fish.Pos;
            InZone = f >= BarPos - s.tolerance && f <= BarPos + BarSize + s.tolerance;
            if (InZone)
            {
                Progress += s.gainPerSec * dt;
            }
            else if (Elapsed > s.startGrace)
            {
                float loss = s.lossPerSec * (_graceAfterBlink > 0f ? 0.4f : 1f);
                Progress -= loss * dt;
            }

            if (Progress > BestProgress) BestProgress = Progress;
            if (Progress >= 1f)
            {
                Progress = 1f;
                Done = true;
                Success = true;
            }
            else if (Progress <= 0f)
            {
                Progress = 0f;
                Done = true;
                Success = false;
            }
        }
    }
}
