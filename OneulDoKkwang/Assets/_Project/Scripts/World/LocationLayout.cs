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
        public const int WaterBody = -930;
        public const int Seabed = -922;
        public const int Underwater = -920;
        public const int Swimmers = -918;
        public const int Ground = -915;
        public const int PierPost = -914;
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

        // ---------------------------------------------------------------- 1. 와이키키 해변

        static LocationLayout Beach()
        {
            var L = new LocationLayout
            {
                theme = LocationTheme.Beach,
                groundY = -0.75f,
                playerX = -5.6f,
                catX = -6.95f,
                bucketX = -4.5f,
                shoreX = -3.1f,
                castMinX = -1.2f,
                castMaxX = 9f,
                groundProfile = Pts(-18, -0.75f, -6.2f, -0.75f, -4.6f, -0.77f, -3.6f, -0.84f, -2.8f, -1.15f, -2f, -1.8f, -1f, -2.8f, 0.4f, -3.8f, 2f, -4.5f, 4f, -4.9f),
                groundTop = Hex.C("#F4D9A0"),
                groundBottom = Hex.C("#D9B26F"),
                seabedProfile = Seabed(-4.55f, 0.12f),
                seabedTop = Hex.C("#E2C48E"),
                seabedBottom = Hex.C("#A98458"),
                swimmerCount = 4,
                swimmerColors = new[] { new Color(0.1f, 0.2f, 0.3f, 0.35f) },
                hulaDancer = true,
                hulaPosition = new Vector2(-8.05f, -0.76f),
                overlayTopAlpha = 0.22f,
                overlayBottomAlpha = 0.45f,
            };
            AddClouds(L, 0.95f);
            L.decor.Add(DecorItem.Make("decor.diamondhead", 1.4f, WaterY + 0.02f, 0.72f, Sorting.FarBackground).Par(0.8f));
            L.decor.Add(DecorItem.Make("decor.sailboat", 5.6f, WaterY + 0.02f, 0.5f, Sorting.Horizon).Par(0.75f).Anim(DecorAnim.Drift, 0f, 0.06f));
            L.decor.Add(DecorItem.Make("decor.umbrella", -12.6f, -0.78f, 0.75f, Sorting.MidBackground));
            L.decor.Add(DecorItem.Make("decor.palm.1", -8.95f, -0.8f, 1f, Sorting.MidBackground + 2).Anim(DecorAnim.Sway, 1.2f, 0.6f));
            L.decor.Add(DecorItem.Make("decor.palm.0", -11f, -0.8f, 0.85f, Sorting.MidBackground + 1).Anim(DecorAnim.Sway, 1f, 0.7f, 1.3f));
            // 서핑보드: 야자수 옆 모래에 꽂아 둠 (16:9 화면 왼쪽 끝 -9.6 안쪽에 보이게)
            L.decor.Add(DecorItem.Make("decor.surfboard.1", -9.42f, -0.86f, 0.82f, Sorting.MidBackground + 1).Rot(-7f));
            L.decor.Add(DecorItem.Make("decor.surfboard.0", -8.55f, -0.88f, 0.88f, Sorting.MidBackground + 3).Rot(6f));
            L.decor.Add(DecorItem.Make("decor.surfboard.2", -12f, -0.92f, 0.5f, Sorting.MidBackground + 6).Rot(4f));
            L.decor.Add(DecorItem.Make("decor.starfish", -6.25f, -0.82f, 0.55f, Sorting.Props));
            L.decor.Add(DecorItem.Make("decor.shell", -3.55f, -0.88f, 0.55f, Sorting.Props).Rot(-10f));
            L.decor.Add(DecorItem.Make("decor.seaweed", 0.6f, -4.35f, 1f, Sorting.Underwater).Anim(DecorAnim.Sway, 7f, 1.1f));
            L.decor.Add(DecorItem.Make("decor.seaweed", 4.1f, -4.55f, 0.8f, Sorting.Underwater).Anim(DecorAnim.Sway, 8f, 0.9f, 1f));
            L.decor.Add(DecorItem.Make("decor.seaweed", 8.2f, -4.45f, 1.1f, Sorting.Underwater).Anim(DecorAnim.Sway, 6f, 1f, 2f));
            L.decor.Add(DecorItem.Make("decor.rock.0", 2.4f, -4.6f, 0.9f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.rock.1", 6.3f, -4.55f, 0.75f, Sorting.Underwater).Flip());
            L.decor.Add(DecorItem.Make("decor.coral.1", 9.6f, -4.5f, 0.8f, Sorting.Underwater));
            L.decor.Add(DecorItem.Make("decor.starfish", 5f, -4.5f, 0.5f, Sorting.Underwater).Rot(20f));
            return L;
        }

        // ---------------------------------------------------------------- 2. 산호초 부두

        static LocationLayout Pier()
        {
            var L = new LocationLayout
            {
                theme = LocationTheme.Pier,
                groundY = -0.3f,
                playerX = -4.4f,
                catX = -5.75f,
                bucketX = -3.25f,
                shoreX = -2.1f,
                castMinX = -0.2f,
                castMaxX = 9.5f,
                groundProfile = Pts(-18, -0.72f, -10f, -0.72f, -9f, -1.1f, -7.5f, -2.3f, -5.5f, -3.4f, -3f, -4.2f, 0f, -4.6f),
                groundTop = Hex.C("#F4D9A0"),
                groundBottom = Hex.C("#D9B26F"),
                seabedProfile = Seabed(-4.6f, 0.1f),
                seabedTop = Hex.C("#EED9A8"),
                seabedBottom = Hex.C("#B59466"),
                swimmerCount = 6,
                swimmerColors = new[] { Hex.C("#FFD43B", 0.8f), Hex.C("#4DABF7", 0.8f), Hex.C("#FF8787", 0.8f), Hex.C("#63E6BE", 0.8f) },
                turtlePasses = true,
                overlayTopAlpha = 0.08f,
                overlayBottomAlpha = 0.28f,
            };
            AddClouds(L, 0.95f);
            L.decor.Add(DecorItem.Make("decor.diamondhead", 6.4f, WaterY + 0.02f, 0.45f, Sorting.FarBackground).Par(0.85f).Tint(Hex.C("#8FB8A0")));
            L.decor.Add(DecorItem.Make("decor.diamondhead", -0.6f, WaterY + 0.02f, 0.28f, Sorting.FarBackground).Par(0.85f).Flip().Tint(Hex.C("#9CC3B5")));
            L.decor.Add(DecorItem.Make("decor.sailboat", 3.6f, WaterY + 0.02f, 0.42f, Sorting.Horizon).Par(0.75f).Anim(DecorAnim.Drift, 0f, 0.05f));
            L.decor.Add(DecorItem.Make("decor.palm.1", -10.6f, -0.75f, 0.9f, Sorting.MidBackground).Anim(DecorAnim.Sway, 1.2f, 0.6f));
            for (int i = 0; i < 5; i++)
                L.decor.Add(DecorItem.Make("decor.pier.post", -9.7f + i * 2.05f, -0.42f, 1f, Sorting.PierPost));
            for (int i = 0; i < 5; i++)
                L.decor.Add(DecorItem.Make("decor.pier.plank", -10.95f + i * 2f, -0.3f, 1f, Sorting.Deck));
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
