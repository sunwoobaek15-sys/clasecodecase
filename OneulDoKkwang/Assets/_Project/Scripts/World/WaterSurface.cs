using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 사인파 물결 메시 (스크립트 방식). 물 본체 / 물속 색조 오버레이 / 수면 하이라이트 3겹.
    /// 찌는 Height(x) 로 물결 위에 뜬다. 첨벙(Ripple)도 지원.
    /// </summary>
    public sealed class WaterSurface : MonoBehaviour
    {
        public static WaterSurface Instance { get; private set; }

        public float baseY = LocationLayout.WaterY;
        public float startX = -6f;
        public float endX = 40f;
        public int columns = 190;
        public float deepY = -5.8f;
        public float bottomY = -16f;

        float _waveHeight = 1f;
        float _waveSpeed = 1f;
        float _overlayTop = 0.25f;
        float _overlayBottom = 0.5f;
        WaterColors _colors;

        Mesh _body, _overlay, _crest;
        readonly List<Vector3> _bodyV = new List<Vector3>();
        readonly List<Color> _bodyC = new List<Color>();
        readonly List<Vector3> _ovV = new List<Vector3>();
        readonly List<Color> _ovC = new List<Color>();
        readonly List<Vector3> _crV = new List<Vector3>();
        readonly List<Color> _crC = new List<Color>();
        List<int> _tri3, _tri2;
        bool _needTris = true;

        struct Ripple
        {
            public float x;
            public float t0;
            public float amp;
        }

        readonly List<Ripple> _ripples = new List<Ripple>();

        void Awake()
        {
            Instance = this;
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        public void Init()
        {
            MeshBits.CreateRenderer(transform, "WaterBody", Sorting.WaterBody, out _body);
            MeshBits.CreateRenderer(transform, "WaterOverlay (물속 색조)", Sorting.WaterOverlay, out _overlay);
            MeshBits.CreateRenderer(transform, "WaterCrest (물결 하이라이트)", Sorting.WaterCrest, out _crest);
        }

        public void Configure(float waterStartX, float waveHeight, float waveSpeed, float overlayTopAlpha, float overlayBottomAlpha)
        {
            startX = waterStartX;
            _waveHeight = waveHeight;
            _waveSpeed = waveSpeed;
            _overlayTop = overlayTopAlpha;
            _overlayBottom = overlayBottomAlpha;
            _ripples.Clear();
            _needTris = true;
        }

        public void SetColors(WaterColors c)
        {
            _colors = c;
        }

        public WaterColors Colors => _colors;

        float T => Time.time * _waveSpeed;

        /// <summary>x 위치의 수면 높이.</summary>
        public float Height(float x)
        {
            float t = T;
            float h = baseY + _waveHeight * (0.07f * Mathf.Sin(x * 1.9f + t * 1.3f) + 0.035f * Mathf.Sin(x * 3.7f - t * 2.1f));
            float now = Time.time;
            for (int i = 0; i < _ripples.Count; i++)
            {
                var r = _ripples[i];
                float age = now - r.t0;
                float d = Mathf.Abs(x - r.x);
                if (d > 4f) continue;
                h += r.amp * Mathf.Exp(-1.8f * age) * Mathf.Exp(-d * 0.9f) * Mathf.Sin(d * 7f - age * 9f);
            }
            return h;
        }

        public float Slope(float x)
        {
            return (Height(x + 0.06f) - Height(x - 0.06f)) / 0.12f;
        }

        public void AddRipple(float x, float amplitude)
        {
            if (_ripples.Count > 8) _ripples.RemoveAt(0);
            _ripples.Add(new Ripple { x = x, t0 = Time.time, amp = amplitude });
        }

        void Update()
        {
            float now = Time.time;
            _ripples.RemoveAll(r => now - r.t0 > 3f);
        }

        void LateUpdate()
        {
            if (_body == null) return;
            int cols = Mathf.Max(2, columns);
            float span = Mathf.Max(1f, endX - startX);
            _bodyV.Clear(); _bodyC.Clear(); _ovV.Clear(); _ovC.Clear(); _crV.Clear(); _crC.Clear();

            Color surf = SpriteFactory.VertexColor(_colors.surface);
            Color deep = SpriteFactory.VertexColor(_colors.deep);
            Color ovTop = surf; ovTop.a = _overlayTop;
            Color ovDeep = deep; ovDeep.a = _overlayBottom;
            Color crestTop = SpriteFactory.VertexColor(_colors.crest); crestTop.a = 0.85f;
            Color crestBottom = crestTop; crestBottom.a = 0f;
            surf.a = 1f; deep.a = 1f;

            for (int i = 0; i < cols; i++)
            {
                float x = startX + span * i / (cols - 1);
                float h = Height(x);
                _bodyV.Add(new Vector3(x, h, 0f)); _bodyC.Add(surf);
                _bodyV.Add(new Vector3(x, deepY, 0f)); _bodyC.Add(deep);
                _bodyV.Add(new Vector3(x, bottomY, 0f)); _bodyC.Add(deep);

                _ovV.Add(new Vector3(x, h, 0f)); _ovC.Add(ovTop);
                _ovV.Add(new Vector3(x, deepY, 0f)); _ovC.Add(ovDeep);
                _ovV.Add(new Vector3(x, bottomY, 0f)); _ovC.Add(ovDeep);

                _crV.Add(new Vector3(x, h + 0.025f, 0f)); _crC.Add(crestTop);
                _crV.Add(new Vector3(x, h - 0.09f, 0f)); _crC.Add(crestBottom);
            }

            if (_needTris)
            {
                _tri3 = MeshBits.GridTriangles(cols, 3);
                _tri2 = MeshBits.GridTriangles(cols, 2);
            }
            MeshBits.Push(_body, _bodyV, _bodyC, _tri3, _needTris);
            MeshBits.Push(_overlay, _ovV, _ovC, _tri3, _needTris);
            MeshBits.Push(_crest, _crV, _crC, _tri2, _needTris);
            _needTris = false;
        }
    }
}
