using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// Time.timeScale 를 한 곳에서 관리: 메뉴 열림(일시정지) + 슬로모션(전설 연출)을 함께 처리.
    /// </summary>
    public sealed class TimeScaleController : MonoBehaviour
    {
        int _pauseCount;
        float _slowScale = 1f;
        float _slowTimer;

        public bool Paused => _pauseCount > 0;

        public void PushPause()
        {
            _pauseCount++;
            Apply();
        }

        public void PopPause()
        {
            _pauseCount = Mathf.Max(0, _pauseCount - 1);
            Apply();
        }

        public void ClearPause()
        {
            _pauseCount = 0;
            Apply();
        }

        /// <summary>실제 시간(언스케일) 기준으로 duration 동안 느리게.</summary>
        public void SlowMo(float scale, float duration)
        {
            _slowScale = Mathf.Clamp(scale, 0.05f, 1f);
            _slowTimer = duration;
            Apply();
        }

        void Update()
        {
            if (_slowTimer > 0f)
            {
                _slowTimer -= Time.unscaledDeltaTime;
                if (_slowTimer <= 0f)
                {
                    _slowScale = 1f;
                    Apply();
                }
            }
        }

        void Apply()
        {
            Time.timeScale = _pauseCount > 0 ? 0f : _slowScale;
        }

        void OnDestroy()
        {
            Time.timeScale = 1f;
        }
    }
}
