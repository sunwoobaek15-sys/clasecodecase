using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 코드로 그린 그림(PaintedSprite) → Texture2D/Sprite 변환 + 캐시.
    /// ArtLibrary 에 같은 키의 스프라이트가 있으면 그걸 우선 사용한다 (아트 교체 지점).
    /// </summary>
    public static class SpriteFactory
    {
        static readonly Dictionary<string, Sprite> Cache = new Dictionary<string, Sprite>();
        static ArtLibrary _art;
        static Material _spriteMaterial;

        public static void Init(ArtLibrary art, Material spriteMaterial)
        {
            _art = art;
            if (spriteMaterial != null) _spriteMaterial = spriteMaterial;
        }

        public static void ResetCache()
        {
            Cache.Clear();
            _art = null;
            _spriteMaterial = null;
        }

        /// <summary>
        /// 모든 월드 렌더러가 쓰는 언릿 스프라이트 머티리얼.
        /// URP 2D / URP / Built-in 어디서든 그려지는 "Sprites/Default" 를 쓴다 (2D 라이트 불필요).
        /// </summary>
        public static Material SpriteMaterial
        {
            get
            {
                if (_spriteMaterial == null)
                {
                    var shader = Shader.Find("Sprites/Default");
                    if (shader == null) shader = Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default");
                    if (shader == null) shader = Shader.Find("UI/Default");
                    _spriteMaterial = new Material(shader) { name = "OneulDoKkwang Sprite (runtime)" };
                }
                return _spriteMaterial;
            }
        }

        static Sprite FromArt(string key)
        {
            return _art != null ? _art.Find(key) : null;
        }

        /// <summary>정적 키 스프라이트 (SpriteCatalog).</summary>
        public static Sprite Get(string key)
        {
            var over = FromArt(key);
            if (over != null) return over;
            Sprite s;
            if (Cache.TryGetValue(key, out s) && s != null) return s;
            PaintedSprite ps;
            if (!SpriteCatalog.TryPaint(key, out ps))
            {
                Debug.LogWarning("[오늘도 꽝] 알 수 없는 스프라이트 키: " + key);
                ps = WorldPainter.Circle();
            }
            s = Create(ps, key);
            Cache[key] = s;
            return s;
        }

        public static Sprite Icon(CatchData c)
        {
            if (c == null) return Get("fx.circle");
            if (c.icon != null) return c.icon;
            string key = "icon." + c.id;
            Sprite s;
            if (Cache.TryGetValue(key, out s) && s != null) return s;
            s = Create(new PaintedSprite(IconPainter.PaintCatch(c.iconStyle, 128), new Vector2(0.5f, 0.5f), 100f), key);
            Cache[key] = s;
            return s;
        }

        public static Sprite RodIcon(RodData r)
        {
            if (r == null) return Get("fx.circle");
            if (r.icon != null) return r.icon;
            string key = "rodicon." + r.id;
            Sprite s;
            if (Cache.TryGetValue(key, out s) && s != null) return s;
            s = Create(new PaintedSprite(IconPainter.PaintRod(r.rodColor, r.accentColor, 128), new Vector2(0.5f, 0.5f), 100f), key);
            Cache[key] = s;
            return s;
        }

        public static Sprite BaitIcon(BaitData b)
        {
            if (b == null) return Get("fx.circle");
            if (b.icon != null) return b.icon;
            string key = "baiticon." + b.id;
            Sprite s;
            if (Cache.TryGetValue(key, out s) && s != null) return s;
            s = Create(new PaintedSprite(IconPainter.PaintBait(b.shape, b.color, b.accentColor, 128), new Vector2(0.5f, 0.5f), 100f), key);
            Cache[key] = s;
            return s;
        }

        public static Sprite LocationThumb(LocationData l)
        {
            if (l == null) return Get("fx.circle");
            if (l.thumbnail != null) return l.thumbnail;
            string key = "locthumb." + l.id;
            Sprite s;
            if (Cache.TryGetValue(key, out s) && s != null) return s;
            s = Create(new PaintedSprite(IconPainter.PaintLocation(l.theme, l.daySky, l.dayWater, 192), new Vector2(0.5f, 0.5f), 100f), key);
            Cache[key] = s;
            return s;
        }

        /// <summary>월드에 그려지는 낚싯대 (낚싯대 데이터 색 반영).</summary>
        public static Sprite RodSprite(RodData r)
        {
            var over = FromArt(SpriteKeys.Rod);
            if (over != null) return over;
            if (r == null) return Get(SpriteKeys.Rod);
            string key = "rodsprite." + r.id;
            Sprite s;
            if (Cache.TryGetValue(key, out s) && s != null) return s;
            s = Create(WorldPainter.Rod(r.rodColor, r.accentColor), key);
            Cache[key] = s;
            return s;
        }

        public static Sprite Create(PaintedSprite ps, string name)
        {
            var cv = ps.canvas;
            var tex = new Texture2D(cv.Width, cv.Height, TextureFormat.RGBA32, false);
            tex.name = name;
            tex.wrapMode = TextureWrapMode.Clamp;
            tex.filterMode = FilterMode.Bilinear;
            tex.SetPixels32(cv.ToPixels());
            tex.Apply(false, true);
            var sprite = Sprite.Create(tex, new Rect(0, 0, cv.Width, cv.Height), ps.pivot, ps.pixelsPerUnit, 0, SpriteMeshType.FullRect, ps.border);
            sprite.name = name;
            return sprite;
        }

        /// <summary>월드 스프라이트 렌더러 생성 (공용 언릿 머티리얼 사용).</summary>
        public static SpriteRenderer Renderer(Transform parent, string name, Sprite sprite, int order, Color? color = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sharedMaterial = SpriteMaterial;
            sr.sprite = sprite;
            sr.sortingOrder = order;
            if (color.HasValue) sr.color = color.Value;
            return sr;
        }

        /// <summary>선형 색공간이면 정점 색을 선형으로 바꿔 준다 (메시 정점 색은 자동 변환되지 않음).</summary>
        public static Color VertexColor(Color c)
        {
            return QualitySettings.activeColorSpace == ColorSpace.Linear ? c.linear : c;
        }
    }
}
