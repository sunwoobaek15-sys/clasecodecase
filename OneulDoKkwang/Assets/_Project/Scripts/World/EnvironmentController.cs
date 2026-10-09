using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 시간대(낮/노을/밤) × 날씨(비) × 장소 팔레트를 섞어서 하늘, 물, 땅, 스프라이트 색조, 해/달/별에 반영.
    /// 하와이 노을: 수평선 주황 → 분홍 → 위쪽 보라.
    /// </summary>
    [DefaultExecutionOrder(110)]
    public sealed class EnvironmentController : MonoBehaviour
    {
        SkyGradient _sky;
        WaterSurface _water;
        CelestialSystem _celestial;
        Camera _cam;
        LocationData _location;
        readonly List<GroundMesh> _grounds = new List<GroundMesh>();

        public float DayWeight { get; private set; }
        public float SunsetWeight { get; private set; }
        public float NightWeight { get; private set; }
        public Color Ambient { get; private set; }

        static readonly Color SunsetPink = new Color(1f, 0.72f, 0.78f);

        public void Init(SkyGradient sky, WaterSurface water, CelestialSystem celestial, Camera cam)
        {
            _sky = sky;
            _water = water;
            _celestial = celestial;
            _cam = cam;
            Ambient = Color.white;
        }

        public void SetLocation(LocationData location, List<GroundMesh> grounds)
        {
            _location = location;
            _grounds.Clear();
            if (grounds != null) _grounds.AddRange(grounds);
            LateUpdate();
        }

        static Color Gray(Color c, float k)
        {
            float l = c.r * 0.3f + c.g * 0.59f + c.b * 0.11f;
            var g = new Color(l * 0.9f, l * 0.93f, l, c.a);
            var o = Color.Lerp(c, g, k);
            return new Color(o.r * (1f - 0.15f * k), o.g * (1f - 0.15f * k), o.b * (1f - 0.12f * k), c.a);
        }

        void LateUpdate()
        {
            if (_location == null || Game.Clock == null) return;
            float hour = Game.Clock.Hour;
            float d, s, n;
            GameClock.SkyWeights(hour, out d, out s, out n);
            DayWeight = d; SunsetWeight = s; NightWeight = n;
            float rain = Game.Weather != null ? Game.Weather.RainBlend : 0f;

            var L = _location;
            var sky = new SkyColors(
                L.daySky.top * d + L.sunsetSky.top * s + L.nightSky.top * n,
                L.daySky.middle * d + L.sunsetSky.middle * s + L.nightSky.middle * n,
                L.daySky.horizon * d + L.sunsetSky.horizon * s + L.nightSky.horizon * n);
            var water = new WaterColors(
                L.dayWater.surface * d + L.sunsetWater.surface * s + L.nightWater.surface * n,
                L.dayWater.deep * d + L.sunsetWater.deep * s + L.nightWater.deep * n,
                L.dayWater.crest * d + L.sunsetWater.crest * s + L.nightWater.crest * n);
            Color amb = L.ambientDay * d + L.ambientSunset * s + L.ambientNight * n;
            amb.a = 1f;

            if (rain > 0.001f)
            {
                sky = new SkyColors(Gray(sky.top, 0.5f * rain), Gray(sky.middle, 0.5f * rain), Gray(sky.horizon, 0.45f * rain));
                water = new WaterColors(Gray(water.surface, 0.3f * rain), Gray(water.deep, 0.3f * rain), Gray(water.crest, 0.3f * rain));
                amb = Color.Lerp(amb, amb * new Color(0.78f, 0.8f, 0.88f, 1f), rain);
            }
            Ambient = amb;

            if (_sky != null) _sky.SetColors(sky.top, sky.middle, sky.horizon);
            if (_water != null)
            {
                _water.SetColors(water);
                // 먼 바다: 수평선 쪽은 깊은 색에 하늘빛이 살짝, 가까운 쪽은 수면 색 (사진처럼 짙은 파랑 → 청록)
                var far = Color.Lerp(water.deep, sky.horizon, 0.26f);
                var mid = Color.Lerp(Color.Lerp(water.deep, water.surface, 0.55f), sky.horizon, 0.06f);
                _water.SetFarColors(far, mid, water.surface);
            }
            if (_cam != null) _cam.backgroundColor = sky.horizon;

            Tintable.NearTint = amb;
            Tintable.FarTint = Color.Lerp(amb, sky.horizon, 0.18f) * new Color(1f, 1f, 1f, 1f);
            var cloud = Color.Lerp(Color.white, SunsetPink, s * 0.65f);
            cloud = cloud * Color.Lerp(Color.white, amb, 0.75f);
            cloud = Color.Lerp(cloud, new Color(0.6f, 0.62f, 0.68f), rain * 0.6f);
            cloud.a = 1f;
            Tintable.CloudTint = cloud;
            Tintable.UnderwaterTint = amb;

            foreach (var g in _grounds) if (g != null) g.SetTint(amb);
            if (_celestial != null) _celestial.Apply(hour, d, s, n, rain, sky.horizon);
        }
    }
}
