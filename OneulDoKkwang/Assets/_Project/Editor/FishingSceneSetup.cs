using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

namespace OneulDoKkwang.EditorTools
{
    /// <summary>
    /// Tools/Setup Fishing Scene : 폴더 · 데이터 에셋(어종/낚싯대/미끼/장소) · GameDatabase · 머티리얼 · Main 씬 · 빌드 설정을 한 번에 만든다.
    /// 이미 있는 데이터 에셋은 덮어쓰지 않는다 (인스펙터에서 고친 밸런스 유지). 강제로 초기화하려면 "데이터 에셋 강제 재생성".
    /// </summary>
    public static class FishingSceneSetup
    {
        public const string Root = "Assets/_Project";
        public const string DataDir = Root + "/Data";
        public const string CatchDir = DataDir + "/Catches";
        public const string RodDir = DataDir + "/Rods";
        public const string BaitDir = DataDir + "/Baits";
        public const string LocationDir = DataDir + "/Locations";
        public const string ResourcesDir = Root + "/Resources";
        public const string SceneDir = Root + "/Scenes";
        public const string ArtDir = Root + "/Art";
        public const string SettingsDir = Root + "/Settings";
        public const string ScenePath = SceneDir + "/Main.unity";
        public const string DatabasePath = ResourcesDir + "/" + GameDatabase.ResourcesPath + ".asset";
        public const string ArtLibraryPath = DataDir + "/ArtLibrary.asset";
        public const string MaterialPath = ArtDir + "/SpriteUnlit.mat";
        const string Tag = "[오늘도 꽝] ";

        [MenuItem("Tools/Setup Fishing Scene", false, 0)]
        public static void SetupFromMenu()
        {
            Setup(true, false);
        }

        [MenuItem("Tools/오늘도 꽝/Setup Fishing Scene (씬·데이터 자동 생성)", false, 1)]
        public static void SetupFromSubMenu()
        {
            Setup(true, false);
        }

        [MenuItem("Tools/오늘도 꽝/데이터 에셋 강제 재생성 (밸런스 초기화)", false, 20)]
        public static void RegenerateData()
        {
            if (!EditorUtility.DisplayDialog("데이터 재생성", "Data 폴더의 어종/낚싯대/미끼/장소 에셋을 코드 기본값으로 덮어씁니다.\n인스펙터에서 바꾼 값은 사라집니다. 계속할까요?", "덮어쓰기", "취소"))
                return;
            EnsureFolders();
            CreateOrUpdateData(true);
            AssetDatabase.SaveAssets();
            Debug.Log(Tag + "데이터 에셋을 기본값으로 다시 만들었습니다.");
        }

        [MenuItem("Tools/오늘도 꽝/세이브 파일 위치 열기", false, 40)]
        public static void RevealSave()
        {
            Directory.CreateDirectory(Application.persistentDataPath);
            EditorUtility.RevealInFinder(SaveManager.SavePath);
        }

        [MenuItem("Tools/오늘도 꽝/세이브 삭제", false, 41)]
        public static void DeleteSave()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning(Tag + "플레이 중에는 게임 안의 설정 > 저장 초기화를 사용하세요.");
                return;
            }
            SaveManager.Delete();
            Debug.Log(Tag + "세이브 삭제: " + SaveManager.SavePath);
        }

        /// <param name="interactive">사용자가 메뉴로 실행했는가 (대화상자 허용)</param>
        /// <param name="auto">프로젝트 첫 오픈 시 자동 실행인가</param>
        public static void Setup(bool interactive, bool auto)
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning(Tag + "플레이 모드에서는 셋업할 수 없습니다. 플레이를 멈춘 뒤 다시 실행하세요.");
                return;
            }

            bool sceneReplaceOk = true;
            if (interactive)
            {
                sceneReplaceOk = EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo();
            }
            else
            {
                var active = EditorSceneManager.GetActiveScene();
                if (active.isDirty && active.path != ScenePath) sceneReplaceOk = false;
            }

            try
            {
                EditorUtility.DisplayProgressBar("오늘도 꽝", "폴더 만드는 중…", 0.1f);
                EnsureFolders();
                EditorUtility.DisplayProgressBar("오늘도 꽝", "데이터 에셋 만드는 중…", 0.3f);
                var db = CreateOrUpdateData(false);
                var mat = EnsureMaterial();
                EditorUtility.DisplayProgressBar("오늘도 꽝", "렌더 파이프라인 확인 중…", 0.5f);
                TryConfigureUrp2D(true);
                ConfigurePlayerSettings();
                AssetDatabase.SaveAssets();

                if (sceneReplaceOk)
                {
                    EditorUtility.DisplayProgressBar("오늘도 꽝", "Main 씬 만드는 중…", 0.7f);
                    CreateScene(db, mat);
                }
                else
                {
                    Debug.LogWarning(Tag + "열려 있는 씬에 저장 안 된 변경이 있어서 Main 씬은 만들지 않았습니다. Tools > Setup Fishing Scene 을 다시 실행하세요.");
                }
                AddSceneToBuild();
                AssetDatabase.SaveAssets();
                AssetDatabase.Refresh();
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }

            Debug.Log(Tag + "셋업 완료! ▶ Play 를 누르면 바로 낚시할 수 있어요.\n" +
                      "- 데이터: " + DataDir + " (어종 " + CountAssets<CatchData>(CatchDir) + "종)\n" +
                      "- 씬: " + ScenePath + "\n" +
                      "- 사운드: 씬의 'Audio' 오브젝트 아래 AudioSource 6개에 클립만 넣으면 재생됩니다.\n" +
                      "- 아트 교체: " + ArtLibraryPath + " 의 슬롯 또는 각 CatchData 의 icon 필드");
            if (interactive && !auto)
                EditorUtility.DisplayDialog("오늘도 꽝", "셋업 완료!\n\nPlay ▶ 를 누르면 바로 낚시할 수 있어요.\n(데이터는 " + DataDir + " 에 생성됨)", "좋아요");
        }

        // ------------------------------------------------------------------ folders

        public static void EnsureFolders()
        {
            EnsureFolder(Root);
            EnsureFolder(DataDir);
            EnsureFolder(CatchDir);
            EnsureFolder(RodDir);
            EnsureFolder(BaitDir);
            EnsureFolder(LocationDir);
            EnsureFolder(ResourcesDir);
            EnsureFolder(SceneDir);
            EnsureFolder(ArtDir);
        }

        public static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            string parent = Path.GetDirectoryName(path).Replace('\\', '/');
            string name = Path.GetFileName(path);
            if (!AssetDatabase.IsValidFolder(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, name);
        }

        static int CountAssets<T>(string folder) where T : Object
        {
            return AssetDatabase.FindAssets("t:" + typeof(T).Name, new[] { folder }).Length;
        }

        // ------------------------------------------------------------------ data

        static string SafeFileName(string s)
        {
            foreach (char c in Path.GetInvalidFileNameChars()) s = s.Replace(c, '_');
            return s;
        }

        static Dictionary<string, T> LoadExisting<T>(string folder, Func<T, string> idOf) where T : ScriptableObject
        {
            var map = new Dictionary<string, T>();
            foreach (var guid in AssetDatabase.FindAssets("t:" + typeof(T).Name, new[] { folder }))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var a = AssetDatabase.LoadAssetAtPath<T>(path);
                if (a == null) continue;
                string id = idOf(a);
                if (!string.IsNullOrEmpty(id) && !map.ContainsKey(id)) map[id] = a;
            }
            return map;
        }

        /// <summary>폴더의 나머지 에셋도 목록에 넣는다. id 가 비었거나 겹치면(메뉴로 새로 만든 기본값 "new_catch", Ctrl+D 복제 등) 파일 이름으로 바꾼다.</summary>
        static void IncludeUserAssets<T>(List<T> into, string folder, Func<T, string> idOf, Action<T, string> setId) where T : ScriptableObject
        {
            var used = new HashSet<string>();
            foreach (var x in into) if (x != null && !string.IsNullOrEmpty(idOf(x))) used.Add(idOf(x));
            foreach (var guid in AssetDatabase.FindAssets("t:" + typeof(T).Name, new[] { folder }))
            {
                var a = AssetDatabase.LoadAssetAtPath<T>(AssetDatabase.GUIDToAssetPath(guid));
                if (a == null || into.Contains(a)) continue;
                string id = idOf(a);
                if (string.IsNullOrEmpty(id) || used.Contains(id))
                {
                    string fixedId = a.name;
                    for (int n = 2; used.Contains(fixedId); n++) fixedId = a.name + "_" + n;
                    Debug.Log(Tag + a.name + " 의 id '" + id + "' 가 비었거나 다른 에셋과 겹쳐서 '" + fixedId + "' 로 바꿨습니다.");
                    setId(a, fixedId);
                    EditorUtility.SetDirty(a);
                    id = fixedId;
                }
                used.Add(id);
                into.Add(a);
            }
        }

        /// <summary>새로 만든 인스턴스를 에셋으로 저장하거나, 이미 있으면 그걸 쓴다 (overwrite 면 값 덮어쓰기).</summary>
        static T Persist<T>(T fresh, string id, Dictionary<string, T> existing, string folder, string fileName, bool overwrite) where T : ScriptableObject
        {
            T asset;
            if (existing.TryGetValue(id, out asset) && asset != null)
            {
                if (overwrite)
                {
                    string keepName = asset.name;
                    EditorUtility.CopySerialized(fresh, asset);
                    asset.name = keepName;
                    EditorUtility.SetDirty(asset);
                }
                Object.DestroyImmediate(fresh);
                return asset;
            }
            string path = AssetDatabase.GenerateUniqueAssetPath(folder + "/" + SafeFileName(fileName) + ".asset");
            fresh.name = Path.GetFileNameWithoutExtension(path);
            AssetDatabase.CreateAsset(fresh, path);
            return fresh;
        }

        public static GameDatabase CreateOrUpdateData(bool overwrite)
        {
            var set = DefaultContent.CreateAll();

            var catches = LoadExisting<CatchData>(CatchDir, c => c.id);
            var rods = LoadExisting<RodData>(RodDir, r => r.id);
            var baits = LoadExisting<BaitData>(BaitDir, b => b.id);
            var locs = LoadExisting<LocationData>(LocationDir, l => l.id);

            AssetDatabase.StartAssetEditing();
            var catchAssets = new List<CatchData>();
            var rodAssets = new List<RodData>();
            var baitAssets = new List<BaitData>();
            var locAssets = new List<LocationData>();
            try
            {
                foreach (var c in set.catches)
                    catchAssets.Add(Persist(c, c.id, catches, CatchDir, c.encyclopediaOrder.ToString("00") + "_" + c.id, overwrite));
                foreach (var r in set.rods)
                    rodAssets.Add(Persist(r, r.id, rods, RodDir, r.shopOrder.ToString("00") + "_" + r.id, overwrite));
                foreach (var b in set.baits)
                    baitAssets.Add(Persist(b, b.id, baits, BaitDir, b.shopOrder.ToString("00") + "_" + b.id, overwrite));
                foreach (var l in set.locations)
                    locAssets.Add(Persist(l, l.id, locs, LocationDir, l.order.ToString("00") + "_" + l.id, overwrite));
            }
            finally
            {
                AssetDatabase.StopAssetEditing();
            }

            // 사용자가 직접 추가한 에셋도 데이터베이스에 포함 (id 가 비어 있으면 파일 이름으로 채움 → 세이브/도감 키)
            IncludeUserAssets(catchAssets, CatchDir, c => c.id, (c, id) => c.id = id);
            IncludeUserAssets(rodAssets, RodDir, r => r.id, (r, id) => r.id = id);
            IncludeUserAssets(baitAssets, BaitDir, b => b.id, (b, id) => b.id = id);
            IncludeUserAssets(locAssets, LocationDir, l => l.id, (l, id) => l.id = id);

            var art = AssetDatabase.LoadAssetAtPath<ArtLibrary>(ArtLibraryPath);
            if (art == null)
            {
                art = ScriptableObject.CreateInstance<ArtLibrary>();
                AssetDatabase.CreateAsset(art, ArtLibraryPath);
            }
            foreach (var slot in SpriteKeys.All) art.EnsureSlot(slot[0], slot[1]);
            EditorUtility.SetDirty(art);

            var db = AssetDatabase.LoadAssetAtPath<GameDatabase>(DatabasePath);
            if (db == null)
            {
                db = ScriptableObject.CreateInstance<GameDatabase>();
                AssetDatabase.CreateAsset(db, DatabasePath);
            }
            db.catches = catchAssets;
            db.rods = rodAssets;
            db.baits = baitAssets;
            db.locations = locAssets;
            db.art = art;
            db.Normalize();
            EditorUtility.SetDirty(db);
            AssetDatabase.SaveAssets();
            return db;
        }

        static Material EnsureMaterial()
        {
            var mat = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (mat != null) return mat;
            var shader = Shader.Find("Sprites/Default");
            if (shader == null)
            {
                Debug.LogWarning(Tag + "Sprites/Default 셰이더를 찾지 못했습니다. 런타임에 자동으로 대체합니다.");
                return null;
            }
            mat = new Material(shader) { name = "SpriteUnlit" };
            AssetDatabase.CreateAsset(mat, MaterialPath);
            return mat;
        }

        // ------------------------------------------------------------------ scene

        /// <summary>Main 씬이 있으면 열어서 빠진 것만 채우고, 없으면 새로 만든다 (오디오 클립 등 사용자가 넣은 값 유지).</summary>
        static void CreateScene(GameDatabase db, Material mat)
        {
            UnityEngine.SceneManagement.Scene scene;
            if (File.Exists(ScenePath)) scene = EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            else scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            if (Camera.main == null)
            {
                var camGo = new GameObject("Main Camera");
                camGo.tag = "MainCamera";
                camGo.transform.position = new Vector3(0f, 0f, -10f);
                var cam = camGo.AddComponent<Camera>();
                cam.orthographic = true;
                cam.orthographicSize = 5.4f;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0.45f, 0.7f, 0.9f);
                camGo.AddComponent<AudioListener>();
            }

            var boot = Object.FindAnyObjectByType<GameBootstrap>();
            if (boot == null)
            {
                var root = new GameObject("GameRoot");
                boot = root.AddComponent<GameBootstrap>();
            }
            if (boot.database == null) boot.database = db;
            if (boot.spriteMaterial == null) boot.spriteMaterial = mat;

            var audio = boot.audioManager != null ? boot.audioManager : Object.FindAnyObjectByType<AudioManager>();
            if (audio == null)
            {
                audio = AudioManager.CreateDefault(null);
                audio.gameObject.name = "Audio (여기 AudioSource 에 클립을 넣으세요)";
            }
            audio.EnsureSlots();
            boot.audioManager = audio;
            EditorUtility.SetDirty(audio);
            EditorUtility.SetDirty(boot);

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath);
            Selection.activeGameObject = boot.gameObject;
        }

        static void AddSceneToBuild()
        {
            if (!File.Exists(ScenePath)) return;
            var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            scenes.RemoveAll(s => s.path == ScenePath);
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
        }

        static void ConfigurePlayerSettings()
        {
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.runInBackground = true;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
        }

        // ------------------------------------------------------------------ URP 2D

        [MenuItem("Tools/오늘도 꽝/URP 2D 렌더러 만들고 적용", false, 30)]
        public static void ConfigureUrp2DMenu()
        {
            TryConfigureUrp2D(false);
        }

        static Type FindType(string fullName)
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                Type t = null;
                try { t = asm.GetType(fullName, false); }
                catch (Exception) { }
                if (t != null) return t;
            }
            return null;
        }

        /// <summary>
        /// 렌더 파이프라인이 비어 있으면 URP 에셋(2D 렌더러)을 만들어 적용한다. (유니티의 "URP Asset (with 2D Renderer)" 메뉴와 같은 순서)
        /// 이 게임은 모든 스프라이트에 언릿 "Sprites/Default" 머티리얼을 쓰기 때문에 Built-in 이어도 똑같이 보인다.
        /// </summary>
        public static bool TryConfigureUrp2D(bool silent)
        {
            if (GraphicsSettings.defaultRenderPipeline != null)
            {
                if (!silent) Debug.Log(Tag + "이미 렌더 파이프라인이 설정되어 있습니다: " + GraphicsSettings.defaultRenderPipeline.name);
                return true;
            }
            var urpType = FindType("UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset");
            var r2dType = FindType("UnityEngine.Rendering.Universal.Renderer2DData");
            if (urpType == null || r2dType == null)
            {
                if (!silent) Debug.LogWarning(Tag + "URP 패키지를 찾지 못했습니다. Built-in 렌더러로도 게임은 똑같이 동작합니다.");
                return false;
            }
            try
            {
                EnsureFolder(SettingsDir);
                string rendererPath = SettingsDir + "/OneulDoKkwang_Renderer2D.asset";
                string assetPath = SettingsDir + "/OneulDoKkwang_URP2D.asset";

                var data = AssetDatabase.LoadAssetAtPath(rendererPath, r2dType) as ScriptableObject;
                if (data == null)
                {
                    data = ScriptableObject.CreateInstance(r2dType);
                    var ppdType = FindType("UnityEngine.Rendering.Universal.PostProcessData");
                    var getDefault = ppdType != null ? ppdType.GetMethod("GetDefaultPostProcessData", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic) : null;
                    var ppProp = r2dType.GetProperty("postProcessData", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                    if (getDefault != null && ppProp != null && ppProp.CanWrite)
                    {
                        try { ppProp.SetValue(data, getDefault.Invoke(null, null)); }
                        catch (Exception) { }
                    }
                    AssetDatabase.CreateAsset(data, rendererPath);
                    var reloader = FindType("UnityEngine.Rendering.ResourceReloader");
                    var reload = reloader != null ? reloader.GetMethod("ReloadAllNullIn", BindingFlags.Static | BindingFlags.Public, null, new[] { typeof(object), typeof(string) }, null) : null;
                    if (reload != null)
                    {
                        try { reload.Invoke(null, new object[] { data, "Packages/com.unity.render-pipelines.universal" }); }
                        catch (Exception) { }
                    }
                    EditorUtility.SetDirty(data);
                }

                var asset = AssetDatabase.LoadAssetAtPath<RenderPipelineAsset>(assetPath);
                if (asset == null)
                {
                    MethodInfo create = urpType.GetMethods(BindingFlags.Static | BindingFlags.Public)
                        .FirstOrDefault(m => m.Name == "Create" && m.GetParameters().Length == 1 && m.GetParameters()[0].ParameterType.IsAssignableFrom(r2dType));
                    if (create == null) throw new Exception("UniversalRenderPipelineAsset.Create(ScriptableRendererData) 를 찾지 못함");
                    asset = (RenderPipelineAsset)create.Invoke(null, new object[] { data });
                    AssetDatabase.CreateAsset(asset, assetPath);
                }
                GraphicsSettings.defaultRenderPipeline = asset;
                AssetDatabase.SaveAssets();
                Debug.Log(Tag + "URP 2D 렌더러를 적용했습니다: " + assetPath);
                return true;
            }
            catch (Exception e)
            {
                GraphicsSettings.defaultRenderPipeline = null;
                Debug.LogWarning(Tag + "URP 2D 자동 설정 실패 → Built-in 렌더러로 진행합니다 (게임 동작에는 문제 없음). 원인: " + e.Message);
                return false;
            }
        }
    }
}
