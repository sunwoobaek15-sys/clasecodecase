using System;
using UnityEngine;

namespace OneulDoKkwang
{
    [Serializable]
    public struct SkyColors
    {
        public Color top;
        public Color middle;
        public Color horizon;

        public SkyColors(Color top, Color middle, Color horizon)
        {
            this.top = top;
            this.middle = middle;
            this.horizon = horizon;
        }

        public static SkyColors Lerp(SkyColors a, SkyColors b, float t)
        {
            return new SkyColors(Color.Lerp(a.top, b.top, t), Color.Lerp(a.middle, b.middle, t), Color.Lerp(a.horizon, b.horizon, t));
        }
    }

    [Serializable]
    public struct WaterColors
    {
        [Tooltip("수면 바로 아래 색")] public Color surface;
        [Tooltip("깊은 곳 색")] public Color deep;
        [Tooltip("물결 하이라이트 색")] public Color crest;

        public WaterColors(Color surface, Color deep, Color crest)
        {
            this.surface = surface;
            this.deep = deep;
            this.crest = crest;
        }

        public static WaterColors Lerp(WaterColors a, WaterColors b, float t)
        {
            return new WaterColors(Color.Lerp(a.surface, b.surface, t), Color.Lerp(a.deep, b.deep, t), Color.Lerp(a.crest, b.crest, t));
        }
    }

    /// <summary>낚시 장소 하나 (전부 하와이 섬 안).</summary>
    [CreateAssetMenu(menuName = "오늘도 꽝/Location Data", fileName = "NewLocation", order = 3)]
    public class LocationData : ScriptableObject
    {
        [Header("기본 정보")]
        public string id = "new_location";
        public string displayName = "새 장소";
        [TextArea(2, 4)] public string description = "";
        public int order;
        [Min(0)] public int unlockPrice;
        [Tooltip("해금에 필요한 도감 발견 수")]
        [Min(0)] public int requiredDiscoveries;
        public LocationTheme theme = LocationTheme.Beach;

        [Header("하늘 (낮 / 노을 / 밤)")]
        public SkyColors daySky;
        public SkyColors sunsetSky;
        public SkyColors nightSky;

        [Header("물 (낮 / 노을 / 밤)")]
        public WaterColors dayWater;
        public WaterColors sunsetWater;
        public WaterColors nightWater;

        [Header("스프라이트 색조 (낮 / 노을 / 밤)")]
        public Color ambientDay = Color.white;
        public Color ambientSunset = new Color(1f, 0.85f, 0.78f);
        public Color ambientNight = new Color(0.5f, 0.55f, 0.8f);

        [Header("물결")]
        [Min(0f)] public float waveHeight = 1f;
        [Min(0f)] public float waveSpeed = 1f;

        [Header("연출 문구")]
        [Tooltip("도착했을 때 화면에 뜨는 자막")]
        public string arrivalCaption = "";
        [Tooltip("도착했을 때 고양이가 하는 말")]
        [TextArea(1, 3)] public string arrivalLine = "";

        [Header("아트 교체용 (비워두면 코드로 생성)")]
        public Sprite thumbnail;
        [Tooltip("먼 배경 (화산, 산 등) 전체를 대체할 스프라이트")]
        public Sprite farBackground;
        [Tooltip("중간 배경 (야자수 등) 전체를 대체할 스프라이트")]
        public Sprite midBackground;

        /// <summary>
        /// 코드 기본 색(하늘·물·색조)의 버전. 에디터 셋업이 이 값이 낮은 에셋을 찾으면 색만 새 기본값으로 바꿔 준다
        /// (해금 가격 등 인스펙터에서 고친 다른 값은 그대로).
        /// </summary>
        [HideInInspector] public int visualVersion;

        /// <summary>2 = 하와이 사진(와이키키·쿠알로아·포이푸) 색으로 바꾼 버전.</summary>
        public const int CurrentVisualVersion = 2;

        /// <summary>하늘·물·스프라이트 색조만 복사한다.</summary>
        public void CopyVisualsFrom(LocationData src)
        {
            daySky = src.daySky;
            sunsetSky = src.sunsetSky;
            nightSky = src.nightSky;
            dayWater = src.dayWater;
            sunsetWater = src.sunsetWater;
            nightWater = src.nightWater;
            ambientDay = src.ambientDay;
            ambientSunset = src.ambientSunset;
            ambientNight = src.ambientNight;
            visualVersion = src.visualVersion;
        }
    }
}
