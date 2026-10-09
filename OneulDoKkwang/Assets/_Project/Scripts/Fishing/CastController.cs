using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>던지기: 꾹 누르는 동안 파워 게이지가 오르내리고(핑퐁), 놓으면 파워만큼 멀리 날아간다.</summary>
    public sealed class CastController : MonoBehaviour
    {
        [Tooltip("파워 게이지 왕복 속도 (1 = 1초에 0→1)")]
        public float chargeSpeed = 1.1f;
        [Tooltip("이 이상이면 퍼펙트 캐스팅")]
        [Range(0.5f, 1f)] public float perfectThreshold = 0.92f;
        [Tooltip("최소 파워 (살짝 눌렀다 떼도 조금은 날아간다)")]
        [Range(0f, 0.5f)] public float minPower = 0.08f;

        float _t;

        public float Power { get; private set; }
        public bool IsPerfect => Power >= perfectThreshold;

        public void BeginCharge()
        {
            _t = 0f;
            Power = 0f;
        }

        public void TickCharge(float dt)
        {
            _t += dt;
            float p = Mathf.PingPong(_t * chargeSpeed, 1f);
            // 꼭대기 근처에서 살짝 머무르게 (퍼펙트 노리기 쉽게)
            Power = Mathf.Sin(p * Mathf.PI * 0.5f);
        }

        public float FinalPower => Mathf.Max(minPower, Power);

        /// <summary>파워 → 찌가 떨어질 x.</summary>
        public static float TargetX(LocationLayout layout, RodData rod, float power)
        {
            float reach = Mathf.Clamp01(0.75f * (rod != null ? rod.castDistance : 1f));
            return layout.castMinX + (layout.castMaxX - layout.castMinX) * reach * Mathf.Clamp01(power);
        }

        /// <summary>화면 표시용 비거리 (m).</summary>
        public static float Meters(float fromX, float toX)
        {
            return Mathf.Max(0f, toX - fromX) * 3.2f;
        }
    }
}
