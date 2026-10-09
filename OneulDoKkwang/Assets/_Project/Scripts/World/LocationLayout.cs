using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>스프라이트 정렬 순서 (모두 Default 정렬 레이어 안에서 order 로만 구분).</summary>
    public static class Sorting
    {
        public const int Sky = -1000;
        public const int Stars = -990;
        public const int Celestial = -980;
        public const int CloudsFar = -970;
        public const int FarBackground = -960;
        public const int Horizon = -950;
        /// <summary>수평선 ~ 수면 사이 먼 바다 띠 (메시).</summary>
        public const int FarSea = -940;
        /// <summary>먼 바다 위: 흰 파도 줄, 산호초 얼룩, 요트, 노을 반짝임.</summary>
        public const int FarSeaDecor = -937;
        /// <summary>해변 뒤쪽 먼 모래사장 / 잔디.</summary>
        public const int BackShore = -935;
        /// <summary>그 위의 인명구조 탑, 텐트, 사람, 작은 야자수.</summary>
        public const int BackShoreDecor = -933;
        public const int WaterBody = -930;
        public const int Seabed = -922;
        public const int Underwater = -920;
        public const int Swimmers = -918;
        public const int Ground = -915;
        public const int PierPost = -914;
        /// <summary>가까운 땅 면 위의 그림자·수건·바위 (땅 앞면을 비스듬히 본 바닥으로 취급).</summary>
        public const int GroundDecor = -913;
        public const int HookLine = -912;
        public const int Hooked = -911;
        public const int WaterOverlay = -905;
        public const int Reflection = -904;
        public const int WaterCrest = -903;
        public const int SurfaceDecor = -902;
        public const int MidBackground = -60;
        public const int Props = -20;
        public const int Deck = -8;
        public const int Npc = -5;
        public const int Cat = 4;
        public const int Bucket = 8;
        public const int Player = 10;
        public const int Rod = 16;
        public const int Line = 19;
        public const int Bobber = 20;
        public const int Effects = 30;
        public const int Rain = 40;
        public const int Foreground = 50;
    }

    public enum DecorAnim
    {
        None = 0,
        Sway = 1,
        Bob = 2,
        Drift = 3,
        Hula = 4,
        Twinkle = 5,
    }

    /// <summary>장소에 놓이는 장식 하나 (순수 데이터).</summary>
    public struct DecorItem
    {
        public string sprite;
        public float x, y;
        public float scale;
        public float rotation;
        public bool flipX;
        public int order;
        /// <summary>0 = 월드에 고정, 1 = 카메라를 그대로 따라감(무한히 먼 배경).</summary>
        public float parallax;
        public Color tint;
        public DecorAnim anim;
        public float animAmount;
        public float animSpeed;
        public float phase;

        public static DecorItem Make(string sprite, float x, float y, float scale, int order)
        {
            return new DecorItem { sprite = sprite, x = x, y = y, scale = scale, order = order, tint = Color.white, animSpeed = 1f };
        }

        public DecorItem Par(float p) { parallax = p; return this; }
        public DecorItem Rot(float deg) { rotation = deg; return this; }
        public DecorItem Flip() { flipX = true; return this; }
        public DecorItem Tint(Color c) { tint = c; return this; }
        public DecorItem Anim(DecorAnim a, float amount, float speed, float ph = 0f) { anim = a; animAmount = amount; animSpeed = speed; phase = ph; return this; }
    }

    /// <summary>
    /// 장소별 배치도 (순수 데이터). 런타임 WorldBuilder 와 오프라인 미리보기가 같은 데이터를 쓴다.
    /// 좌표는 월드 단위 (카메라 정사영 크기 5.4 → 화면 높이 10.8).
    /// </summary>
    public sealed class LocationLayout
    {
        public const float WaterY = -1f;

        public LocationTheme theme;
        /// <summary>
        /// 수평선 높이. WaterY 보다 높으면 그 사이에 먼 바다 띠가 생긴다 (사진처럼 수평선까지 바다가 펼쳐짐).
        /// WaterY 와 같으면 띠 없음 (화산·구름 낚시터).
        /// </summary>
        public float horizonY = WaterY;
        /// <summary>주인공/고양이가 서 있는 높이.</summary>
        public float groundY;
        public float playerX;
        public float catX;
        public float bucketX;
        /// <summary>수면이 시작되는 x (이보다 왼쪽은 땅/부두).</summary>
        public float shoreX;
        public float castMinX;
        public float castMaxX;

        /// <summary>가까운 땅 윗면 (왼쪽 → 오른쪽). null 이면 땅 메시 없음.</summary>
        public List<Vector2> groundProfile;
        public Color groundTop = Color.white;
        public Color groundBottom = Color.gray;
        /// <summary>땅 윗면 띠 (예: 검은 용암 바위 위 잔디). 알파 0 이면 없음.</summary>
        public Color groundBand = Color.clear;
        public float groundBandDepth;
        public List<Vector2> seabedProfile;
        public Color seabedTop = Color.gray;
        public Color seabedBottom = Color.black;

        /// <summary>물속 색조 오버레이의 알파 (수면 / 바닥). 클수록 물이 탁하다.</summary>
        public float overlayTopAlpha = 0.25f;
        public float overlayBottomAlpha = 0.5f;
        /// <summary>훌라 NPC 위치.</summary>
        public Vector2 hulaPosition;

        /// <summary>땅 윗면이 수면 아래로 내려가는 x. 이보다 오른쪽이 물.</summary>
        public float WaterStartX
        {
            get
            {
                if (groundProfile == null || groundProfile.Count < 2) return -30f;
                for (int i = 1; i < groundProfile.Count; i++)
                {
                    var a = groundProfile[i - 1];
                    var b = groundProfile[i];
                    if (a.y >= WaterY && b.y < WaterY)
                    {
                        float t = (WaterY - a.y) / (b.y - a.y);
                        return a.x + (b.x - a.x) * t;
                    }
                }
                return groundProfile[0].x;
            }
        }

        public bool HasFarSea => horizonY > WaterY + 0.05f;

        public readonly List<DecorItem> decor = new List<DecorItem>();

        /// <summary>배경에서 헤엄치는 물고기 수와 색.</summary>
        public int swimmerCount;
        public Color[] swimmerColors;
        public bool turtlePasses;
        public bool hulaDancer;
        public bool embers;
        public bool volcanoSmoke;
        public Vector2 smokeOrigin;
        public float smokeParallax;

        public static LocationLayout For(LocationTheme theme)
        {
            switch (theme)
            {
                case LocationTheme.Pier: return Pier();
                case LocationTheme.Volcano: return Volcano();
                case LocationTheme.Cloud: return Cloud();
                default: return Beach();
            }
        }

        static List<Vector2> Pts(params float[] xy)
        {
            var l = new List<Vector2>(xy.Length / 2);
            for (int i = 0; i < xy.Length; i += 2) l.Add(new Vector2(xy[i], xy[i + 1]));
            return l;
        }

        static List<Vector2> Seabed(float y, float amp)
        {
            var l = new List<Vector2>();
            for (float x = -8f; x <= 26f; x += 1.25f) l.Add(new Vector2(x, y + amp * Mathf.Sin(x * 0.9f) + amp * 0.5f * Mathf.Sin(x * 2.3f + 1f)));
            return l;
        }

        static void AddClouds(LocationLayout L, float alpha)
        {
            var c = new Color(1f, 1f, 1f, alpha);
            L.decor.Add(DecorItem.Make("decor.cloud.0", -6.5f, 3.4f, 0.8f, Sorting.CloudsFar).Par(0.92f).Tint(c).Anim(DecorAnim.Drift, 0f, 0.12f));
            L.decor.Add(DecorItem.Make("decor.cloud.1", 1.2f, 4.1f, 1f, Sorting.CloudsFar).Par(0.92f).Tint(c).Anim(DecorAnim.Drift, 0f, 0.09f));
            L.decor.Add(DecorItem.Make("decor.cloud.0", 8f, 2.9f, 0.6f, Sorting.CloudsFar).Par(0.92f).Tint(c).Anim(DecorAnim.Drift, 0f, 0.15f));
            L.decor.Add(DecorItem.Make("decor.cloud.1", 14f, 3.8f, 0.7f, Sorting.CloudsFar).Par(0.92f).Tint(c).Anim(DecorAnim.Drift, 0f, 0.11f));
        }

        // ---------------------------------------------------------------- 1. 와이키키 해변 (사진 1 + 3)
        // 짙은 파란 하늘, 하얀 모래, 아주 키 큰 야자수, 인명구조 탑·텐트·사람들, 수평선까지 짙어지는 바다와 흰 파도 줄,
        // 해변 위로 길게 기운 야자수와 왼쪽 위를 덮는 잎.

        static LocationLayout Beach()
        {
            var L = new LocationLayout
            {
                theme = LocationTheme.Beach,
                horizonY = WaterY + 1.05f,
                groundY = -0.75f,
                playerX = -5.6f,
                catX = -6.95f,
                bucketX = -4.5f,
                shoreX = -3.1f,
                castMinX = -1.2f,
                castMaxX = 9f,
                groundProfile = Pts(-18, -0.75f, -6.2f, -0.75f, -4.6f, -0.77f, -3.6f, -0.84f, -2.8f, -1.15f, -2f, -1.8f, -1f, -2.8f, 0.4f, -3.8f, 2f, -4.5f, 4f, -4.9f),
                groundTop = Hex.C("#F3ECDD"),
                groundBottom = Hex.C("#CDBB98"),
                seabedProfile = Seabed(-4.55f, 0.12f),
                seabedTop = Hex.C("#EADCBE"),
                seabedBottom = Hex.C("#B0956A"),
                swimmerCount = 4,
                swimmerColors = new[] { new Color(0.1f, 0.2f, 0.3f, 0.3f) },
                hulaDancer = true,
                hulaPosition = new Vector2(-8.05f, -0.76f),
                overlayTopAlpha = 0.18f,
                overlayBottomAlpha = 0.42f,
            };
            float hz = L.horizonY;
            // 하늘: 수평선 근처 옅은 새털구름 + 오른쪽에 작은 뭉게구름 (사진 1·3)
            L.decor.Add(DecorItem.Make("decor.wisps.0", -2f, hz + 0.55f, 1f, Sorting.CloudsFar).Par(0.94f).Anim(DecorAnim.Drift, 0f, 0.05f));
            L.decor.Add(DecorItem.Make("decor.wisps.1", 8.5f, hz + 0.9f, 0.9f, Sorting.CloudsFar).Par(0.94f).Anim(DecorAnim.Drift, 0f, 0.04f));
            L.decor.Add(DecorItem.Make("decor.cumulus.3", 5.2f, hz + 3.3f, 0.75f, Sorting.CloudsFar).Par(0.92f).Anim(DecorAnim.Drift, 0f, 0.08f));
            L.decor.Add(DecorItem.Make("decor.cumulus.1", 11.5f, hz + 2.2f, 0.7f, Sorting.CloudsFar).Par(0.92f).Anim(DecorAnim.Drift, 0f, 0.07f));
            // 먼 바다: 흰 파도 줄 + 수평선의 요트
            L.decor.Add(DecorItem.Make("decor.surf.beach", 3f, hz, 1f, Sorting.FarSeaDecor).Par(0.55f));
            L.decor.Add(DecorItem.Make("decor.sailboat.far", 6.4f, hz - 0.08f, 0.45f, Sorting.FarSeaDecor + 2).Par(0.75f).Anim(DecorAnim.Drift, 0f, 0.05f));
            // 해변 뒤쪽 모래사장 (오른쪽 끝이 바다 쪽으로 휘어 들어감)
            L.decor.Add(DecorItem.Make("decor.backbeach", -13.2f, -0.75f, 1f, Sorting.BackShore));
            L.decor.Add(DecorItem.Make("decor.tent.blue", -9.15f, -0.52f, 0.45f, Sorting.BackShoreDecor));
            L.decor.Add(DecorItem.Make("decor.people.0", -7.45f, -0.5f, 0.55f, Sorting.BackShoreDecor));
            L.decor.Add(DecorItem.Make("decor.people.1", -6.35f, -0.52f, 0.55f, Sorting.BackShoreDecor));
            L.decor.Add(DecorItem.Make("decor.canopy.teal", -3.95f, -0.5f, 0.5f, Sorting.BackShoreDecor));
            L.decor.Add(DecorItem.Make("decor.people.3", -3.45f, -0.52f, 0.5f, Sorting.BackShoreDecor));
            L.decor.Add(DecorItem.Make("decor.farpalm.0", -2.35f, -0.48f, 0.34f, Sorting.BackShoreDecor - 1));
            L.decor.Add(DecorItem.Make("decor.farpalm.1", -1.95f, -0.55f, 0.29f, Sorting.BackShoreDecor - 1));
            L.decor.Add(DecorItem.Make("decor.lifeguard", -2.75f, -0.56f, 0.5f, Sorting.BackShoreDecor));
            L.decor.Add(DecorItem.Make("decor.people.2", -2.25f, -0.6f, 0.45f, Sorting.BackShoreDecor + 1));
            // 키 큰 야자수 두 그루 (사진 1) + 해변 위로 기운 야자수 (사진 3)
            L.decor.Add(DecorItem.Make("decor.tallpalm.1", -7.35f, -0.5f, 0.95f, Sorting.MidBackground).Anim(DecorAnim.Sway, 0.7f, 0.5f, 1.1f));
            L.decor.Add(DecorItem.Make("decor.tallpalm.0", -8.75f, -0.8f, 1.08f, Sorting.MidBackground + 1).Anim(DecorAnim.Sway, 0.8f, 0.45f));
            L.decor.Add(DecorItem.Make("decor.leanpalm", -11.2f, -0.78f, 0.82f, Sorting.MidBackground + 2).Anim(DecorAnim.Sway, 0.5f, 0.4f, 2f));
            // 모래에 꽂힌 서핑보드
            L.decor.Add(DecorItem.Make("decor.surfboard.1", -9.42f, -0.86f, 0.82f, Sorting.MidBackground + 3).Rot(-7f));
            L.decor.Add(DecorItem.Make("decor.surfboard.0", -8.45f, -0.88f, 0.86f, Sorting.MidBackground + 4).Rot(6f));
            // 모래 위 야자수 그림자 (땅 앞면을 비스듬히 본 바닥으로)
            L.decor.Add(DecorItem.Make("decor.palmshadow.0", -8.6f, -1.05f, 0.75f, Sorting.GroundDecor).Rot(-7f));
            L.decor.Add(DecorItem.Make("decor.palmshadow.1", -5.2f, -1.55f, 0.6f, Sorting.GroundDecor).Rot(-4f));
            L.decor.Add(DecorItem.Make("decor.starfish", -6.25f, -0.82f, 0.55f, Sorting.Props));
            L.decor.Add(DecorItem.Make("decor.shell", -3.55f, -0.88f, 0.55f, Sorting.Props).Rot(-10f));
            // 앞쪽 왼쪽 위를 덮는 잎 (사진 3)
            L.decor.Add(DecorItem.Make("decor.cornerfronds", -9.75f, 5.5f, 0.85f, Sorting.Foreground).Anim(DecorAnim.Sway, 1.2f, 0.35f));
            // 물속 (맑은 바다)
            L.decor.Add(DecorItem.Make("decor.seaweed", 0.6f, -4.35f, 1f, Sorting.Underwater).Anim(DecorAnim.Sway, 7f, 1.1f));
            L.decor.Add(DecorItem.Make("decor.seaweed", 4.1f, -4.55f, 0.8f, Sorting.Underwater).Anim(DecorAnim.Sway, 8f, 0.9f, 1f));
            L.decor.Add(DecorItem.Make("decor.seaweed", 8.2f, -4.45f, 1.1f, Sorting.Underwater).Anim(DecorAnim.Sway, 6f, 1f, 2f));
            L.decor.Add(DecorItem.Make("decor.rock.0", 2.4f, -4.6f, 0.9f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.rock.1", 6.3f, -4.55f, 0.75f, Sorting.Underwater).Flip());
            L.decor.Add(DecorItem.Make("decor.coral.1", 9.6f, -4.5f, 0.8f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.starfish", 5f, -4.5f, 0.5f, Sorting.Underwater).Rot(20f));
            return L;
        }

        // ---------------------------------------------------------------- 2. 산호초 부두 (사진 2 + 4)
        // 오른쪽 수평선 위로 솟은 쿠알로아 능선과 해안 숲, 바닥의 산호초가 비치는 청록 바다, 뭉게구름,
        // 왼쪽은 노란빛 잔디(야자수·일광욕하는 사람들)와 검은 용암 바위에서 부서지는 파도, 거기서 시작하는 나무 부두.

        static LocationLayout Pier()
        {
            var L = new LocationLayout
            {
                theme = LocationTheme.Pier,
                horizonY = WaterY + 0.9f,
                groundY = -0.3f,
                playerX = -4.4f,
                catX = -5.75f,
                bucketX = -3.25f,
                shoreX = -2.1f,
                castMinX = -0.2f,
                castMaxX = 9.5f,
                groundProfile = Pts(-18, -0.42f, -7.6f, -0.42f, -7.05f, -0.6f, -6.7f, -1.15f, -6.1f, -1.9f, -5f, -2.9f, -3f, -3.9f, 0f, -4.6f),
                groundBand = Hex.C("#9FB431"),
                groundBandDepth = 0.32f,
                groundTop = Hex.C("#4B4F56"),
                groundBottom = Hex.C("#23252A"),
                seabedProfile = Seabed(-4.6f, 0.1f),
                seabedTop = Hex.C("#E8DDBA"),
                seabedBottom = Hex.C("#A98F64"),
                swimmerCount = 6,
                swimmerColors = new[] { Hex.C("#FFD43B", 0.8f), Hex.C("#4DABF7", 0.8f), Hex.C("#FF8787", 0.8f), Hex.C("#63E6BE", 0.8f) },
                turtlePasses = true,
                overlayTopAlpha = 0.08f,
                overlayBottomAlpha = 0.28f,
            };
            float hz = L.horizonY;
            // 뭉게구름 (사진 2·4): 일부는 능선 뒤로
            L.decor.Add(DecorItem.Make("decor.cumulus.2", -4.5f, hz + 3.15f, 0.8f, Sorting.CloudsFar).Par(0.92f).Anim(DecorAnim.Drift, 0f, 0.06f));
            L.decor.Add(DecorItem.Make("decor.cumulus.0", 2.2f, hz + 3.9f, 0.7f, Sorting.CloudsFar).Par(0.92f).Anim(DecorAnim.Drift, 0f, 0.07f));
            L.decor.Add(DecorItem.Make("decor.cumulus.1", 8.4f, hz + 4.3f, 0.75f, Sorting.CloudsFar).Par(0.92f).Anim(DecorAnim.Drift, 0f, 0.05f));
            L.decor.Add(DecorItem.Make("decor.cumulus.3", 12.5f, hz + 3.2f, 0.8f, Sorting.CloudsFar).Par(0.92f).Anim(DecorAnim.Drift, 0f, 0.08f));
            L.decor.Add(DecorItem.Make("decor.wisps.0", -1f, hz + 0.6f, 0.9f, Sorting.CloudsFar).Par(0.94f));
            L.decor.Add(DecorItem.Make("decor.cumulus.3", -0.6f, hz + 2.5f, 0.55f, Sorting.CloudsFar).Par(0.93f).Anim(DecorAnim.Drift, 0f, 0.09f));
            L.decor.Add(DecorItem.Make("decor.cumulus.1", 5.6f, hz + 2.9f, 0.5f, Sorting.CloudsFar).Par(0.93f).Anim(DecorAnim.Drift, 0f, 0.06f));
            // 쿠알로아 능선 (높은 쪽이 오른쪽) + 산 밑 해안 숲
            L.decor.Add(DecorItem.Make("decor.kualoa", 5.9f, hz, 0.74f, Sorting.FarBackground).Par(0.85f).Flip());
            L.decor.Add(DecorItem.Make("decor.coast", 4.5f, hz - 0.02f, 0.82f, Sorting.FarBackground + 1).Par(0.85f));
            // 먼 바다: 산호초 얼룩 + 옅은 흰 물결
            L.decor.Add(DecorItem.Make("decor.reef", 2.5f, hz, 1f, Sorting.FarSeaDecor).Par(0.6f));
            L.decor.Add(DecorItem.Make("decor.surf.pier", 2.5f, hz, 1f, Sorting.FarSeaDecor + 1).Par(0.6f).Tint(new Color(1f, 1f, 1f, 0.7f)));
            // 왼쪽 잔디 (사진 4): 키 큰 야자수, 수건 위 사람들, 잔디 가장자리, 물가의 용암 바위
            L.decor.Add(DecorItem.Make("decor.tallpalm.2", -8.05f, -0.42f, 0.78f, Sorting.MidBackground).Anim(DecorAnim.Sway, 0.7f, 0.5f, 0.6f));
            L.decor.Add(DecorItem.Make("decor.tallpalm.3", -9.3f, -0.45f, 0.92f, Sorting.MidBackground + 1).Anim(DecorAnim.Sway, 0.8f, 0.42f, 1.7f));
            L.decor.Add(DecorItem.Make("decor.grass", -18f, -0.44f, 1f, Sorting.Props - 1));
            L.decor.Add(DecorItem.Make("decor.grass", -9f, -0.44f, 0.6f, Sorting.Props - 1));
            L.decor.Add(DecorItem.Make("decor.towel.0", -8.55f, -0.44f, 0.8f, Sorting.Props - 2));
            L.decor.Add(DecorItem.Make("decor.towel.3", -9.75f, -0.44f, 0.8f, Sorting.Props - 2));
            L.decor.Add(DecorItem.Make("decor.palmshadow.1", -8.3f, -0.6f, 0.6f, Sorting.GroundDecor).Rot(-3f));
            L.decor.Add(DecorItem.Make("decor.lavarocks.0", -6.85f, -1.02f, 0.55f, Sorting.GroundDecor));
            // 용암 바위 절벽 면의 울퉁불퉁한 바위 (물속 부분은 물 색조가 덮는다)
            L.decor.Add(DecorItem.Make("decor.lavarocks.face", -8.7f, -1.3f, 0.85f, Sorting.GroundDecor).Tint(new Color(0.9f, 0.9f, 0.95f)));
            L.decor.Add(DecorItem.Make("decor.lavarocks.face", -6.35f, -2.2f, 0.75f, Sorting.GroundDecor).Flip().Tint(new Color(0.85f, 0.88f, 0.92f)));
            // 나무 부두 (잔디 끝에서 바다 쪽으로)
            for (int i = 0; i < 4; i++)
                L.decor.Add(DecorItem.Make("decor.pier.post", -6.5f + i * 1.65f, -0.42f, 1f, Sorting.PierPost));
            for (int i = 0; i < 3; i++)
                L.decor.Add(DecorItem.Make("decor.pier.plank", -6.4f + i * 2f, -0.3f, 1f, Sorting.Deck));
            // 물속 산호초 (사진 2 의 맑은 물)
            L.decor.Add(DecorItem.Make("decor.coral.0", 1.3f, -4.5f, 1f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.coral.1", 3.3f, -4.55f, 1.1f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.coral.2", 5.1f, -4.5f, 1f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.coral.3", 7.2f, -4.55f, 0.95f, Sorting.Underwater).Flip());
            L.decor.Add(DecorItem.Make("decor.coral.0", 9.2f, -4.55f, 0.8f, Sorting.Underwater).Flip());
            L.decor.Add(DecorItem.Make("decor.coral.2", -1.4f, -4.4f, 0.75f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.seaweed", 0.1f, -4.45f, 1.1f, Sorting.Underwater).Anim(DecorAnim.Sway, 7f, 1f));
            L.decor.Add(DecorItem.Make("decor.seaweed", 6.2f, -4.5f, 0.9f, Sorting.Underwater).Anim(DecorAnim.Sway, 8f, 1.2f, 2f));
            L.decor.Add(DecorItem.Make("decor.starfish", 2.4f, -4.55f, 0.5f, Sorting.Underwater).Rot(-15f));
            L.decor.Add(DecorItem.Make("decor.rock.1", 8.3f, -4.6f, 0.7f, Sorting.Underwater));
            return L;
        }

        // ---------------------------------------------------------------- 3. 화산 용암 낚시터

        static LocationLayout Volcano()
        {
            var L = new LocationLayout
            {
                theme = LocationTheme.Volcano,
                groundY = -0.55f,
                playerX = -5.4f,
                catX = -6.75f,
                bucketX = -4.3f,
                shoreX = -3f,
                castMinX = -1.2f,
                castMaxX = 9f,
                groundProfile = Pts(-18, -0.55f, -10f, -0.5f, -8.6f, -0.62f, -7.4f, -0.5f, -6f, -0.55f, -4.6f, -0.55f, -3.7f, -0.62f, -3.2f, -1.1f, -2.7f, -2.2f, -2f, -3.2f, -0.6f, -4.1f, 1.5f, -4.7f, 4f, -5f),
                groundTop = Hex.C("#4A4A4A"),
                groundBottom = Hex.C("#1E1E1E"),
                seabedProfile = Seabed(-4.6f, 0.2f),
                seabedTop = Hex.C("#3A2420"),
                seabedBottom = Hex.C("#120A08"),
                swimmerCount = 0,
                embers = true,
                volcanoSmoke = true,
                smokeOrigin = new Vector2(4.2f, 3.55f),
                smokeParallax = 0.8f,
                overlayTopAlpha = 0.45f,
                overlayBottomAlpha = 0.8f,
            };
            AddClouds(L, 0.55f);
            L.decor.Add(DecorItem.Make("decor.volcano", 4.2f, WaterY + 0.02f, 1f, Sorting.FarBackground).Par(0.8f));
            L.decor.Add(DecorItem.Make("decor.volcano", -6f, WaterY + 0.02f, 0.45f, Sorting.FarBackground - 1).Par(0.86f).Tint(new Color(0.75f, 0.68f, 0.7f)).Flip());
            L.decor.Add(DecorItem.Make("decor.lavarock.0", -8.7f, -0.6f, 1.2f, Sorting.MidBackground));
            L.decor.Add(DecorItem.Make("decor.lavarock.1", -10.6f, -0.55f, 1.4f, Sorting.MidBackground).Flip());
            L.decor.Add(DecorItem.Make("decor.lavarock.1", -3.7f, -0.62f, 0.6f, Sorting.Props));
            L.decor.Add(DecorItem.Make("decor.lavarock.0", 1.6f, -4.6f, 1f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.lavarock.1", 5.5f, -4.75f, 1.2f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.lavarock.0", 8.6f, -4.7f, 0.9f, Sorting.Underwater).Flip());
            return L;
        }

        // ---------------------------------------------------------------- 4. 구름 낚시터

        static LocationLayout Cloud()
        {
            var L = new LocationLayout
            {
                theme = LocationTheme.Cloud,
                groundY = -0.6f,
                playerX = -5.4f,
                catX = -6.75f,
                bucketX = -4.3f,
                shoreX = -3.4f,
                castMinX = -1f,
                castMaxX = 9.5f,
                groundProfile = null,
                seabedProfile = null,
                swimmerCount = 3,
                swimmerColors = new[] { new Color(1f, 1f, 1f, 0.55f) },
                overlayTopAlpha = 0.25f,
                overlayBottomAlpha = 0.45f,
            };
            AddClouds(L, 1f);
            L.decor.Add(DecorItem.Make("decor.rainbow", 3f, WaterY - 0.2f, 1f, Sorting.FarBackground).Par(0.85f));
            L.decor.Add(DecorItem.Make("decor.island", 6.8f, 2.3f, 0.75f, Sorting.Horizon).Par(0.7f).Anim(DecorAnim.Bob, 0.18f, 0.5f));
            L.decor.Add(DecorItem.Make("decor.island", -2.2f, 3.5f, 0.45f, Sorting.Horizon).Par(0.75f).Flip().Anim(DecorAnim.Bob, 0.12f, 0.6f, 1.5f));
            L.decor.Add(DecorItem.Make("decor.cloudplatform", -8f, -0.6f, 1f, Sorting.Ground));
            L.decor.Add(DecorItem.Make("decor.cloudplatform", -16.5f, -0.45f, 1f, Sorting.Ground - 1).Flip());
            L.decor.Add(DecorItem.Make("decor.cloud.0", 1.5f, -1.25f, 0.9f, Sorting.SurfaceDecor).Anim(DecorAnim.Drift, 0f, 0.1f));
            L.decor.Add(DecorItem.Make("decor.cloud.1", 6.5f, -1.3f, 1.1f, Sorting.SurfaceDecor).Anim(DecorAnim.Drift, 0f, 0.08f));
            L.decor.Add(DecorItem.Make("decor.cloud.0", 11.5f, -1.2f, 0.8f, Sorting.SurfaceDecor).Anim(DecorAnim.Drift, 0f, 0.12f));
            return L;
        }
    }
}
