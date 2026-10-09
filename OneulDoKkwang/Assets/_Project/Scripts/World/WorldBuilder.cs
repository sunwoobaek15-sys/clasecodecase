using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 월드(하늘·물·배경·장식·캐릭터 자리)를 코드로 조립한다.
    /// 공용 요소는 한 번, 장소 요소(LocationRoot 아래)는 장소를 옮길 때마다 다시 만든다.
    /// 배치 데이터는 LocationLayout, 그림은 SpriteFactory(→ ArtLibrary 로 교체 가능).
    /// </summary>
    public sealed class WorldBuilder : MonoBehaviour
    {
        public Transform LocationRoot { get; private set; }
        public SkyGradient Sky { get; private set; }
        public WaterSurface Water { get; private set; }
        public CelestialSystem Celestial { get; private set; }
        public RainEffect Rain { get; private set; }
        public EffectsManager Effects { get; private set; }
        public LocationLayout Layout { get; private set; }
        public LocationData Location { get; private set; }

        readonly List<GroundMesh> _grounds = new List<GroundMesh>();

        public void BuildStatic()
        {
            Sky = Child<SkyGradient>("Sky");
            Sky.Init();
            Celestial = Child<CelestialSystem>("Celestial (해·달·별)");
            Celestial.Init();
            Water = Child<WaterSurface>("Water (사인파 물결)");
            Water.Init();
            Rain = Child<RainEffect>("Rain");
            Rain.Init();
            Effects = Child<EffectsManager>("Effects");
            Effects.Init();
        }

        T Child<T>(string name) where T : Component
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            return go.AddComponent<T>();
        }

        public void BuildLocation(LocationData loc)
        {
            Location = loc;
            Layout = LocationLayout.For(loc != null ? loc.theme : LocationTheme.Beach);
            if (LocationRoot != null) Destroy(LocationRoot.gameObject);
            var rootGo = new GameObject("Location: " + (loc != null ? loc.displayName : "?"));
            rootGo.transform.SetParent(transform, false);
            LocationRoot = rootGo.transform;
            _grounds.Clear();

            var L = Layout;
            bool farOverride = loc != null && loc.farBackground != null;
            bool midOverride = loc != null && loc.midBackground != null;
            Vector2 farPos = new Vector2(2f, LocationLayout.WaterY);
            Vector2 midPos = new Vector2(-8f, L.groundY);
            bool farPlaced = false, midPlaced = false;

            foreach (var item in L.decor)
            {
                bool isFar = item.order == Sorting.FarBackground || item.order == Sorting.FarBackground - 1;
                bool isMid = item.order >= Sorting.MidBackground && item.order < Sorting.MidBackground + 10;
                if (farOverride && isFar)
                {
                    if (!farPlaced) { farPos = new Vector2(item.x, item.y); farPlaced = true; }
                    continue;
                }
                if (midOverride && isMid)
                {
                    if (!midPlaced) { midPos = new Vector2(item.x, item.y); midPlaced = true; }
                    continue;
                }
                PlaceDecor(item, SpriteFactory.Get(item.sprite));
            }
            if (farOverride)
                PlaceDecor(DecorItem.Make("custom.far", farPos.x, farPos.y, 1f, Sorting.FarBackground).Par(0.8f), loc.farBackground);
            if (midOverride)
                PlaceDecor(DecorItem.Make("custom.mid", midPos.x, midPos.y, 1f, Sorting.MidBackground), loc.midBackground);

            if (L.groundProfile != null)
                _grounds.Add(GroundMesh.Create(LocationRoot, "Ground", L.groundProfile, L.groundTop, L.groundBottom, Sorting.Ground));
            if (L.seabedProfile != null)
                _grounds.Add(GroundMesh.Create(LocationRoot, "Seabed", L.seabedProfile, L.seabedTop, L.seabedBottom, Sorting.Seabed));

            if (L.hulaDancer)
            {
                var go = new GameObject("Hula NPC");
                go.transform.SetParent(LocationRoot, false);
                go.transform.position = new Vector3(L.hulaPosition.x, L.hulaPosition.y, 0f);
                go.AddComponent<HulaDancer>().Init();
            }

            var lifeGo = new GameObject("AmbientLife");
            lifeGo.transform.SetParent(LocationRoot, false);
            lifeGo.AddComponent<AmbientLife>().Init(L);

            if (loc != null)
            {
                Water.Configure(L.WaterStartX - 0.3f, loc.waveHeight, loc.waveSpeed, L.overlayTopAlpha, L.overlayBottomAlpha);
                Water.SetColors(loc.dayWater);
            }
            if (Game.Environment != null) Game.Environment.SetLocation(loc, _grounds);
            if (Game.Cam != null) Game.Cam.ResetTo(0f);
            if (Game.Player != null) Game.Player.PlaceAt(new Vector2(L.playerX, L.groundY));
            if (Game.Cat != null) Game.Cat.PlaceAt(new Vector2(L.catX, L.groundY));
            if (Game.Bucket != null) Game.Bucket.PlaceAt(new Vector2(L.bucketX, L.groundY - 0.02f));
        }

        void PlaceDecor(DecorItem item, Sprite sprite)
        {
            var sr = SpriteFactory.Renderer(LocationRoot, item.sprite, sprite, item.order);
            sr.flipX = item.flipX;
            sr.transform.localScale = new Vector3(item.scale, item.scale, 1f);
            Tintable.Mode mode = Tintable.Mode.Near;
            if (item.sprite.StartsWith("decor.cloud.")) mode = Tintable.Mode.Cloud;
            else if (item.order <= Sorting.Horizon) mode = Tintable.Mode.Far;
            Tintable.Attach(sr, mode, item.tint);
            sr.gameObject.AddComponent<DecorAnimator>().Setup(item);
        }

        public float GroundY => Layout != null ? Layout.groundY : -0.75f;
    }
}
