using UnityEngine;
using UnityEngine.SceneManagement;

namespace OneulDoKkwang
{
    /// <summary>
    /// 게임 진입점. 씬에 이 컴포넌트 하나만 있으면 카메라·월드·UI·매니저를 전부 코드로 조립한다.
    /// 씬에 아무것도 없어도(새 씬/Untitled/Main/SampleScene) Play 하면 자동으로 생성되어 바로 낚시할 수 있다.
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    public sealed class GameBootstrap : MonoBehaviour
    {
        [Header("데이터 (비워두면 Resources/GameDatabase → 그것도 없으면 코드 기본값)")]
        public GameDatabase database;
        [Tooltip("스프라이트용 언릿 머티리얼 (비워두면 Sprites/Default 로 자동 생성). 빌드에 셰이더를 포함시키려면 에셋으로 지정 권장")]
        public Material spriteMaterial;
        [Tooltip("씬에 미리 만들어 둔 AudioManager (비워두면 자식으로 자동 생성)")]
        public AudioManager audioManager;

        [Header("개발 옵션")]
        [Tooltip("인트로를 건너뛴다 (테스트용)")]
        public bool skipIntro;
        [Tooltip("시작할 때 세이브를 지운다 (테스트용)")]
        public bool resetSaveOnStart;

        public static GameBootstrap Instance { get; private set; }

        bool _built;

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning("[오늘도 꽝] GameBootstrap 이 두 개 있어서 하나를 끕니다.");
                enabled = false;
                return;
            }
            Instance = this;
        }

        void Start()
        {
            if (Instance == this && !_built) Build();
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>씬에 GameBootstrap 이 없으면 자동 생성 (새 프로젝트에서 Play 만 눌러도 동작).</summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoCreate()
        {
            if (FindAnyObjectByType<GameBootstrap>() != null) return;
            var scene = SceneManager.GetActiveScene();
            bool allowed = string.IsNullOrEmpty(scene.path) || scene.name == "Main" || scene.name == "SampleScene" || scene.buildIndex == 0;
            if (!allowed) return;
            var go = new GameObject("GameRoot (auto)");
            go.AddComponent<GameBootstrap>();
        }

        void Build()
        {
            _built = true;
            Application.targetFrameRate = 60;
            Time.timeScale = 1f;

            // ---------- 데이터
            var db = database;
            if (db == null) db = Resources.Load<GameDatabase>(GameDatabase.ResourcesPath);
            if (db == null || !db.IsUsable)
            {
                Debug.Log("[오늘도 꽝] GameDatabase 에셋이 없어 코드 기본 콘텐츠로 시작합니다. (Tools > 오늘도 꽝 > Setup Fishing Scene 으로 에셋 생성 가능)");
                db = DefaultContent.CreateRuntimeDatabase();
            }
            SpriteFactory.Init(db.art, spriteMaterial);
            UIFonts.Reset();

            if (resetSaveOnStart) SaveManager.Delete();
            var save = SaveManager.Load();
            bool firstRun = save == null;

            // ---------- 매니저
            Game.Tweens = gameObject.AddComponent<TweenRunner>();
            Game.TimeScale = gameObject.AddComponent<TimeScaleController>();
            Game.Saver = gameObject.AddComponent<SaveManager>();
            Game.State = gameObject.AddComponent<GameManager>();
            Game.State.Init(db, save);
            Game.Clock = gameObject.AddComponent<TimeManager>();
            Game.Clock.Init(Game.State.Save.gameMinutes);
            Game.Weather = gameObject.AddComponent<WeatherManager>();
            Game.Weather.Init((WeatherType)Game.State.Save.weather, Game.State.Save.weatherHoursLeft);

            var audio = audioManager != null ? audioManager : FindAnyObjectByType<AudioManager>();
            if (audio == null) audio = AudioManager.CreateDefault(transform);
            audio.EnsureSlots();
            audio.ApplyVolumes(Game.State.Save.bgmVolume, Game.State.Save.sfxVolume);
            Game.Audio = audio;

            // ---------- 카메라
            var cam = Camera.main;
            if (cam == null)
            {
                var camGo = new GameObject("Main Camera");
                camGo.tag = "MainCamera";
                camGo.transform.SetParent(transform, false);
                cam = camGo.AddComponent<Camera>();
                camGo.AddComponent<AudioListener>();
            }
            if (FindAnyObjectByType<AudioListener>() == null) cam.gameObject.AddComponent<AudioListener>();
            Game.Cam = cam.GetComponent<CameraRig>();
            if (Game.Cam == null) Game.Cam = cam.gameObject.AddComponent<CameraRig>();
            Game.Cam.Init(cam);

            // ---------- 월드
            var worldGo = new GameObject("World");
            worldGo.transform.SetParent(transform, false);
            Game.World = worldGo.AddComponent<WorldBuilder>();
            Game.World.BuildStatic();
            Game.Fx = Game.World.Effects;
            Game.Environment = worldGo.AddComponent<EnvironmentController>();
            Game.Environment.Init(Game.World.Sky, Game.World.Water, Game.World.Celestial, cam);

            var charRoot = new GameObject("Characters").transform;
            charRoot.SetParent(worldGo.transform, false);
            Game.Player = PlayerAvatar.Create(charRoot);
            Game.Player.SetRod(Game.State.Rod);
            Game.Cat = CatCompanion.Create(charRoot);
            Game.Bucket = BucketView.Create(charRoot);

            // ---------- 낚시 장비
            var fishingGo = new GameObject("Fishing");
            fishingGo.transform.SetParent(transform, false);
            var bobber = Bobber.Create(worldGo.transform);
            var line = FishingLine.Create(worldGo.transform, bobber);

            // ---------- UI
            Game.UI = GameUI.Build(transform);
            Game.UI.BindAnchors(Game.Player.bubbleAnchor, Game.Cat.bubbleAnchor);

            // ---------- 낚시 상태머신
            var fc = fishingGo.AddComponent<FishingController>();
            fc.cast = fishingGo.AddComponent<CastController>();
            fc.bite = fishingGo.AddComponent<BiteSystem>();
            fc.resolver = fishingGo.AddComponent<CatchResolver>();
            fc.bobber = bobber;
            fc.line = line;
            Game.Fishing = fc;
            fc.Init(Game.UI.Input);

            // ---------- 장소
            Game.World.BuildLocation(Game.State.Location);
            bobber.Hang(true);

            // ---------- 연출 / UI 초기화
            Game.UI.Hud.Init();
            Game.Director = gameObject.AddComponent<GameDirector>();
            Game.Director.Init();
            Game.State.EquipmentChanged += () => { if (Game.Player != null) Game.Player.SetRod(Game.State.Rod); };
            audio.StartBgm();

            if (skipIntro && firstRun) Game.State.Save.introSeen = true;
            Game.Director.StartGame();
            Game.Saver.MarkDirty();
            Debug.Log("[오늘도 꽝] 준비 완료! 세이브: " + SaveManager.SavePath);
        }

        /// <summary>전부 지우고 다시 조립 (세이브 초기화 등).</summary>
        public void Restart(bool deleteSave)
        {
            if (deleteSave) SaveManager.Delete();
            bool sceneAudio = audioManager != null && !audioManager.transform.IsChildOf(transform);
            Instance = null;
            Game.ResetStatics();
            Time.timeScale = 1f;
            var go = new GameObject(gameObject.name);
            var nb = go.AddComponent<GameBootstrap>();
            nb.database = database;
            nb.spriteMaterial = spriteMaterial;
            nb.audioManager = sceneAudio ? audioManager : null;
            nb.skipIntro = skipIntro;
            nb.resetSaveOnStart = false;
            gameObject.SetActive(false);
            Destroy(gameObject);
        }
    }
}
