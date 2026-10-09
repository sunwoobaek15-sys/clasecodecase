using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 정사영 카메라: 화면비에 맞춰 가로 19.2 이상이 보이게 맞추고, 찌를 부드럽게 따라가며, 흔들림/줌 펀치 연출.
    /// </summary>
    [DefaultExecutionOrder(50)]
    public sealed class CameraRig : MonoBehaviour
    {
        public const float BaseHalfHeight = 5.4f;
        public const float MinHalfWidth = 9.6f;

        /// <summary>현재 카메라 x (패럴랙스 계산용).</summary>
        public static float X { get; private set; }

        public Camera Cam { get; private set; }
        public float minX = 0f;
        public float maxX = 2f;

        float _targetX;
        float _x;
        float _vel;
        float _trauma;
        float _zoom = 1f;
        float _zoomTarget = 1f;
        float _zoomTimer;
        float _seed;

        public void Init(Camera cam)
        {
            Cam = cam;
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.45f, 0.7f, 0.9f);
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 100f;
            _seed = Random.Range(0f, 100f);
            _x = 0f;
            X = 0f;
            Apply(0f);
        }

        public void Follow(float worldX)
        {
            _targetX = Mathf.Clamp(worldX, minX, maxX);
        }

        public void ResetTo(float x)
        {
            _targetX = Mathf.Clamp(x, minX, maxX);
            _x = _targetX;
            _vel = 0f;
            X = _x;
        }

        public void Shake(float amount)
        {
            _trauma = Mathf.Clamp01(_trauma + amount);
        }

        /// <summary>잠깐 줌인 (1.1 = 10% 확대).</summary>
        public void ZoomPunch(float zoom, float seconds)
        {
            _zoomTarget = zoom;
            _zoomTimer = seconds;
        }

        void LateUpdate()
        {
            float dt = Time.unscaledDeltaTime;
            _x = Mathf.SmoothDamp(_x, _targetX, ref _vel, 0.55f, 20f, dt);
            if (_zoomTimer > 0f)
            {
                _zoomTimer -= dt;
                if (_zoomTimer <= 0f) _zoomTarget = 1f;
            }
            _zoom = Mathf.Lerp(_zoom, _zoomTarget, 1f - Mathf.Exp(-6f * dt));
            _trauma = Mathf.Max(0f, _trauma - dt * 1.4f);
            Apply(dt);
        }

        void Apply(float dt)
        {
            if (Cam == null) return;
            float aspect = Mathf.Max(0.3f, Cam.aspect);
            float half = Mathf.Max(BaseHalfHeight, MinHalfWidth / aspect);
            Cam.orthographicSize = half / _zoom;
            float shake = _trauma * _trauma;
            float t = Time.unscaledTime * 22f;
            float sx = (Mathf.PerlinNoise(_seed, t) - 0.5f) * 0.6f * shake;
            float sy = (Mathf.PerlinNoise(_seed + 7f, t) - 0.5f) * 0.6f * shake;
            float zoomShiftY = (half - half / _zoom) * -0.25f;
            transform.position = new Vector3(_x + sx, sy + zoomShiftY, -10f);
            X = _x;
        }
    }
}
