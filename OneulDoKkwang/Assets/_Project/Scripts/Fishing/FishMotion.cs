using System;

namespace OneulDoKkwang
{
    /// <summary>물고기 움직임 계산에 넘겨주는 현재 미니게임 상태.</summary>
    public struct ReelSnapshot
    {
        public float barPos;
        public float barSize;
        public float progress;
        public float time;

        public float BarCenter => barPos + barSize * 0.5f;
    }

    /// <summary>
    /// 릴 감기 미니게임에서 물고기 아이콘의 위치(0 = 바닥, 1 = 꼭대기)를 움직이는 패턴.
    /// 순수 C# (System.Random) → 오프라인 시뮬레이션으로 난이도 검증 가능.
    /// </summary>
    public abstract class FishMotion
    {
        public float Pos = 0.5f;
        public float Vel;
        /// <summary>물고기 옆에 잠깐 띄울 상태 문구 ("기절!", "도장 쾅!" 등). 없으면 null.</summary>
        public string Status;
        public float StatusTimer;
        /// <summary>이번 틱에 순간이동했는가 (뷰에서 번쩍 연출).</summary>
        public bool Blinked;

        protected System.Random Rng;
        protected float D;
        protected float T;

        public const float Min = 0.04f;
        public const float Max = 0.96f;

        public static FishMotion Create(MovePattern pattern)
        {
            switch (pattern)
            {
                case MovePattern.Calm: return new CalmMotion();
                case MovePattern.Darting: return new DartingMotion();
                case MovePattern.Aggressive: return new AggressiveMotion();
                case MovePattern.Teleport: return new TeleportMotion();
                case MovePattern.Still: return new StillMotion();
                case MovePattern.Sinker: return new SinkerMotion();
                case MovePattern.Floater: return new FloaterMotion();
                case MovePattern.Surf: return new SurfMotion();
                case MovePattern.Hula: return new HulaMotion();
                case MovePattern.Lazy: return new LazyMotion();
                case MovePattern.Avoider: return new AvoiderMotion();
                case MovePattern.Fainter: return new FainterMotion();
                case MovePattern.Slippery: return new SlipperyMotion();
                case MovePattern.Bureaucrat: return new BureaucratMotion();
                case MovePattern.KingPhases: return new KingMotion();
                case MovePattern.Chaos: return new ChaosMotion(false);
                case MovePattern.Mystery: return new ChaosMotion(true);
                default: return new CalmMotion();
            }
        }

        public virtual void Init(System.Random rng, float difficulty, float startPos)
        {
            Rng = rng;
            D = Clamp(difficulty, 0f, 1f);
            Pos = Clamp(startPos, Min, Max);
            Vel = 0f;
            T = 0f;
        }

        public void Tick(float dt, in ReelSnapshot snap)
        {
            Blinked = false;
            T += dt;
            if (StatusTimer > 0f)
            {
                StatusTimer -= dt;
                if (StatusTimer <= 0f) Status = null;
            }
            Step(dt, snap);
            if (Pos < Min) { Pos = Min; if (Vel < 0f) Vel = 0f; }
            if (Pos > Max) { Pos = Max; if (Vel > 0f) Vel = 0f; }
        }

        protected abstract void Step(float dt, in ReelSnapshot snap);

        /// <summary>현재 페이즈 (바다의 왕 전용, 나머지는 1).</summary>
        public virtual int Phase => 1;

        // ---------------------------------------------------------------- helpers

        protected float Rand(float a, float b)
        {
            return a + (float)Rng.NextDouble() * (b - a);
        }

        protected bool Chance(float p)
        {
            return Rng.NextDouble() < p;
        }

        protected float RandomTarget(float minDistance)
        {
            for (int i = 0; i < 6; i++)
            {
                float t = Rand(0.08f, 0.92f);
                if (Math.Abs(t - Pos) >= minDistance) return t;
            }
            return Pos > 0.5f ? Rand(0.08f, 0.35f) : Rand(0.65f, 0.92f);
        }

        /// <summary>목표 지점으로 스프링처럼 이동 (속도 제한).</summary>
        protected void SpringTo(float target, float stiffness, float damping, float maxSpeed, float dt)
        {
            Vel += ((target - Pos) * stiffness - Vel * damping) * dt;
            Vel = Clamp(Vel, -maxSpeed, maxSpeed);
            Pos += Vel * dt;
        }

        /// <summary>목표 지점으로 일정 속도 이동. 도착하면 true.</summary>
        protected bool MoveTowards(float target, float speed, float dt)
        {
            float delta = target - Pos;
            float step = speed * dt;
            if (Math.Abs(delta) <= step)
            {
                Pos = target;
                Vel = 0f;
                return true;
            }
            Vel = Math.Sign(delta) * speed;
            Pos += Vel * dt;
            return false;
        }

        protected void Say(string status, float seconds)
        {
            Status = status;
            StatusTimer = seconds;
        }

        protected static float Clamp(float v, float a, float b)
        {
            return v < a ? a : (v > b ? b : v);
        }

        /// <summary>난이도에 따라 대기 시간을 줄인다 (어려울수록 자주 움직임).</summary>
        protected float Pace(float seconds)
        {
            return seconds * (1.2f - 0.55f * D);
        }
    }

    // ===================================================================== patterns

    sealed class CalmMotion : FishMotion
    {
        float _target, _timer;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _target = Pos;
            _timer = 0.4f;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _timer -= dt;
            if (_timer <= 0f)
            {
                _target = RandomTarget(0.15f);
                _timer = Pace(Rand(1.2f, 2.3f));
            }
            SpringTo(_target, 5f + 6f * D, 3.6f, 0.3f + 0.4f * D, dt);
        }
    }

    sealed class DartingMotion : FishMotion
    {
        float _rest, _target;
        bool _dashing;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _rest = 0.6f;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            if (_dashing)
            {
                if (MoveTowards(_target, 0.55f + 0.65f * D, dt))
                {
                    _dashing = false;
                    _rest = Pace(Rand(0.6f, 1.3f));
                }
                return;
            }
            _rest -= dt;
            Pos += (float)Math.Sin(T * 14f) * 0.0025f;
            if (_rest <= 0f)
            {
                _target = RandomTarget(0.25f);
                _dashing = true;
            }
        }
    }

    sealed class AggressiveMotion : FishMotion
    {
        float _target, _timer;

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _timer -= dt;
            if (_timer <= 0f)
            {
                _target = RandomTarget(0.2f);
                _timer = Pace(Rand(0.55f, 1.0f));
            }
            SpringTo(_target, 12f + 10f * D, 6f, 0.45f + 0.5f * D, dt);
        }
    }

    sealed class TeleportMotion : FishMotion
    {
        float _hold, _drift;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _hold = Pace(Rand(1.3f, 1.9f));
            _drift = Rand(-0.08f, 0.08f);
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _hold -= dt;
            Pos += _drift * dt + (float)Math.Sin(T * 9f) * 0.002f;
            if (_hold <= 0f)
            {
                Pos = RandomTarget(0.3f);
                Blinked = true;
                Say("신호 끊김!", 0.6f);
                _hold = Pace(Rand(1.4f, 2.2f));
                _drift = Rand(-0.08f, 0.08f);
            }
        }
    }

    sealed class StillMotion : FishMotion
    {
        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            Pos = Rand(0.3f, 0.7f);
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            // 반려 돌: 정말로 아무것도 하지 않는다.
            Vel = 0f;
            if (T > 2f && StatusTimer <= 0f && Chance(dt * 0.15f)) Say("…", 1.2f);
        }
    }

    sealed class SinkerMotion : FishMotion
    {
        protected override void Step(float dt, in ReelSnapshot snap)
        {
            Vel -= (0.22f + 0.25f * D) * dt;
            Vel *= 1f - 0.6f * dt;
            if (Pos < 0.12f || Chance(dt * (0.35f + 0.35f * D)))
            {
                if (Vel < 0.2f)
                {
                    Vel = Rand(0.45f, 0.85f);
                    Say("뽀글", 0.4f);
                }
            }
            Vel = Clamp(Vel, -0.55f, 0.95f);
            Pos += Vel * dt;
        }
    }

    sealed class FloaterMotion : FishMotion
    {
        float _target, _timer;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _target = Rand(0.65f, 0.9f);
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _timer -= dt;
            if (_timer <= 0f)
            {
                _target = Chance(0.18f + 0.15f * D) ? Rand(0.25f, 0.5f) : Rand(0.6f, 0.94f);
                _timer = Pace(Rand(1.5f, 2.6f));
            }
            SpringTo(_target, 4f + 5f * D, 3f, 0.3f + 0.35f * D, dt);
            Pos += (float)Math.Cos(T * 2.3f) * 0.05f * dt;
        }
    }

    sealed class SurfMotion : FishMotion
    {
        float _phase, _amp, _omega, _center;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _phase = Rand(0f, 6.28f);
            _amp = 0.28f + 0.08f * D;
            _omega = 0.95f + 0.95f * D;
            _center = 0.5f;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _phase += _omega * dt;
            float target = _center + _amp * (float)Math.Sin(_phase) + 0.03f * (float)Math.Sin(_phase * 2.7f);
            if (Chance(dt * 0.12f))
            {
                _omega = (0.95f + 0.95f * D) * Rand(0.8f, 1.25f);
                Say("서핑!", 0.6f);
            }
            float prev = Pos;
            Pos = target;
            Vel = (Pos - prev) / Math.Max(0.0001f, dt);
        }
    }

    sealed class HulaMotion : FishMotion
    {
        float _beat, _center, _target;
        int _side, _count;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _center = Clamp(startPos, 0.25f, 0.75f);
            _target = _center;
            _side = 1;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _beat -= dt;
            if (_beat <= 0f)
            {
                _beat = 0.5f - 0.14f * D;
                _side = -_side;
                _count++;
                if (_count % 4 == 0)
                {
                    _center = Rand(0.22f, 0.78f);
                    Say("훌라~", 0.5f);
                }
                _target = _center + _side * (0.08f + 0.05f * D);
            }
            SpringTo(_target, 40f, 9f, 1.4f, dt);
        }
    }

    sealed class LazyMotion : FishMotion
    {
        float _timer, _target, _speed;
        bool _moving;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _timer = 1f;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            if (_moving)
            {
                if (MoveTowards(_target, _speed, dt)) { _moving = false; _timer = Pace(Rand(1.6f, 3f)); }
                return;
            }
            _timer -= dt;
            if (_timer > 0f) return;
            float roll = (float)Rng.NextDouble();
            if (roll < 0.14f + 0.1f * D)
            {
                _target = Rand(0.05f, 0.15f);
                _speed = 0.75f + 0.4f * D;
                Say("출근 거부!", 0.8f);
            }
            else if (roll < 0.8f)
            {
                _target = Clamp(Pos + Rand(-0.25f, 0.25f), 0.08f, 0.92f);
                _speed = 0.12f + 0.18f * D;
            }
            else
            {
                Say("귀찮아…", 0.8f);
                _timer = Pace(Rand(1.2f, 2f));
                return;
            }
            _moving = true;
        }
    }

    sealed class AvoiderMotion : FishMotion
    {
        float _target, _timer, _tired, _energy;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _target = Pos;
            _energy = Rand(2.2f, 3.2f);
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            if (_tired > 0f)
            {
                _tired -= dt;
                Vel *= 1f - 5f * dt;
                Pos += Vel * dt;
                return;
            }
            _energy -= dt;
            if (_energy <= 0f)
            {
                _tired = 0.75f - 0.25f * D;
                _energy = Rand(2.2f, 3.2f);
                Say("훌쩍…", 0.9f);
                return;
            }

            float center = snap.BarCenter;
            float dist = Pos - center;
            float danger = snap.barSize * 0.5f + 0.1f;
            if (Math.Abs(dist) < danger)
            {
                float dir = dist >= 0f ? 1f : -1f;
                // 벽에 몰렸으면 반대쪽으로 크게 도망 (바를 넘어가는 순간이 잡을 기회)
                if ((dir > 0f && Pos > 0.85f) || (dir < 0f && Pos < 0.15f)) dir = -dir;
                _target = Clamp(Pos + dir * 0.35f, 0.06f, 0.94f);
            }
            else
            {
                _timer -= dt;
                if (_timer <= 0f)
                {
                    _target = RandomTarget(0.1f);
                    _timer = Pace(Rand(1f, 1.8f));
                }
            }
            SpringTo(_target, 8f + 6f * D, 4.5f, 0.36f + 0.3f * D, dt);
        }
    }

    sealed class FainterMotion : FishMotion
    {
        float _active, _faint, _target, _timer;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _active = Rand(1.4f, 2.3f);
            _target = Pos;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            if (_faint > 0f)
            {
                _faint -= dt;
                Vel = 0f;
                if (_faint <= 0f) _active = Rand(1.4f, 2.4f);
                return;
            }
            _active -= dt;
            if (_active <= 0f)
            {
                _faint = Rand(1.1f, 1.6f);
                Say("기절!", _faint);
                return;
            }
            _timer -= dt;
            if (_timer <= 0f)
            {
                _target = RandomTarget(0.2f);
                _timer = Pace(Rand(0.45f, 0.9f));
            }
            SpringTo(_target, 10f + 8f * D, 5f, 0.5f + 0.4f * D, dt);
        }
    }

    sealed class SlipperyMotion : FishMotion
    {
        float _center, _target, _timer, _amp, _omega;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _center = Pos;
            _target = Pos;
            _amp = 0.045f + 0.05f * D;
            _omega = 10f + 8f * D;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _timer -= dt;
            if (_timer <= 0f)
            {
                _target = Clamp(RandomTarget(0.18f), 0.12f, 0.88f);
                _timer = Pace(Rand(0.8f, 1.5f));
            }
            float speed = 0.22f + 0.25f * D;
            float delta = _target - _center;
            float step = speed * dt;
            _center += Math.Abs(delta) <= step ? delta : Math.Sign(delta) * step;
            float prev = Pos;
            Pos = _center + _amp * (float)Math.Sin(T * _omega);
            Vel = (Pos - prev) / Math.Max(0.0001f, dt);
        }
    }

    sealed class BureaucratMotion : FishMotion
    {
        float _timer, _target;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _target = Pos;
            _timer = 0.8f;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _timer -= dt;
            if (_timer <= 0f)
            {
                _timer = Pace(Rand(0.75f, 1.1f));
                if (Chance(0.12f + 0.08f * D))
                {
                    _target = Rand(0.05f, 0.2f);
                    Say("반려!", 0.7f);
                }
                else
                {
                    float step = Rand(0.1f, 0.22f) * (Chance(0.5f) ? 1f : -1f);
                    if (Pos + step < 0.06f || Pos + step > 0.94f) step = -step;
                    _target = Clamp(Pos + step, 0.06f, 0.94f);
                    if (Chance(0.35f)) Say("도장 쾅!", 0.5f);
                }
            }
            SpringTo(_target, 60f, 14f, 1.6f, dt);
        }
    }

    /// <summary>바다의 왕: 진행도에 따라 1 → 2 → 3 페이즈로 패턴이 바뀐다 (뒤로 돌아가지 않음).</summary>
    sealed class KingMotion : FishMotion
    {
        int _phase = 1;
        float _target, _timer, _teleport;

        public override int Phase => _phase;

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            _target = Pos;
            _teleport = 1.3f;
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            int want = snap.progress < 0.4f ? 1 : (snap.progress < 0.72f ? 2 : 3);
            if (want > _phase)
            {
                _phase = want;
                Say(_phase == 2 ? "왕의 분노!" : "왕관 던지기!!", 1.2f);
                _timer = 0f;
            }

            _timer -= dt;
            switch (_phase)
            {
                case 1:
                    if (_timer <= 0f) { _target = RandomTarget(0.2f); _timer = Pace(Rand(0.9f, 1.5f)); }
                    SpringTo(_target, 8f, 4.2f, 0.55f, dt);
                    break;
                case 2:
                    if (_timer <= 0f) { _target = RandomTarget(0.25f); _timer = Pace(Rand(0.7f, 1.1f)); }
                    SpringTo(_target, 16f, 6f, 0.85f, dt);
                    break;
                default:
                    _teleport -= dt;
                    if (_teleport <= 0f)
                    {
                        Pos = RandomTarget(0.3f);
                        Vel = 0f;
                        Blinked = true;
                        _teleport = Rand(1.8f, 2.4f);
                    }
                    if (_timer <= 0f) { _target = RandomTarget(0.2f); _timer = Pace(Rand(0.7f, 1.1f)); }
                    SpringTo(_target, 16f, 6f, 0.85f, dt);
                    break;
            }
        }
    }

    /// <summary>
    /// 하와이안 피자(논쟁): 수시로 다른 패턴으로 바뀐다.
    /// mystery = true 면 ??? 용: 순간이동/회피까지 섞고 더 자주 바뀐다.
    /// </summary>
    sealed class ChaosMotion : FishMotion
    {
        readonly bool _mystery;
        FishMotion _inner;
        float _switch;
        bool _pro;

        static readonly MovePattern[] ChaosSet =
        {
            MovePattern.Calm, MovePattern.Darting, MovePattern.Aggressive, MovePattern.Surf, MovePattern.Lazy, MovePattern.Hula,
        };

        static readonly MovePattern[] MysterySet =
        {
            MovePattern.Calm, MovePattern.Darting, MovePattern.Aggressive, MovePattern.Surf, MovePattern.Teleport,
            MovePattern.Avoider, MovePattern.Slippery, MovePattern.Bureaucrat, MovePattern.Hula,
        };

        public ChaosMotion(bool mystery)
        {
            _mystery = mystery;
        }

        public override void Init(System.Random rng, float difficulty, float startPos)
        {
            base.Init(rng, difficulty, startPos);
            Switch();
        }

        void Switch()
        {
            var set = _mystery ? MysterySet : ChaosSet;
            var pattern = set[Rng.Next(set.Length)];
            _inner = Create(pattern);
            _inner.Init(Rng, D, Pos);
            _switch = _mystery ? Rand(1f, 1.6f) : Rand(1.2f, 2f);
            if (_mystery)
            {
                Say("???", 0.5f);
            }
            else
            {
                _pro = !_pro;
                Say(_pro ? "찬성!" : "반대!", 0.7f);
            }
        }

        protected override void Step(float dt, in ReelSnapshot snap)
        {
            _switch -= dt;
            if (_switch <= 0f) Switch();
            _inner.Tick(dt, snap);
            if (_inner.Blinked) Blinked = true;
            if (_inner.Status != null && _inner.StatusTimer > 0f && Status == null && !_mystery) Say(_inner.Status, _inner.StatusTimer);
            Pos = _inner.Pos;
            Vel = _inner.Vel;
        }
    }
}
