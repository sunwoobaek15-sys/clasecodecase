using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace OneulDoKkwang.EditorTools
{
    /// <summary>
    /// 프로젝트를 처음 열었을 때 데이터 에셋/Main 씬이 없으면 자동으로 Setup 을 실행하고 Main 씬을 연다.
    /// → 프로젝트를 열고 바로 ▶ Play 하면 낚시할 수 있게.
    /// (끄고 싶으면 Tools > 오늘도 꽝 > 자동 셋업 끄기)
    /// </summary>
    [InitializeOnLoad]
    static class FishingAutoSetup
    {
        const string SessionKey = "OneulDoKkwang.AutoSetupChecked";
        const string DisableKey = "OneulDoKkwang.AutoSetupDisabled";
        static int _retries;

        static FishingAutoSetup()
        {
            if (Application.isBatchMode) return;
            EditorApplication.delayCall += TryRun;
        }

        static void TryRun()
        {
            if (SessionState.GetBool(SessionKey, false)) return;
            if (EditorPrefs.GetBool(DisableKey, false)) return;
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;
            if (EditorApplication.isCompiling || EditorApplication.isUpdating)
            {
                if (_retries++ < 600) EditorApplication.delayCall += TryRun;
                return;
            }
            SessionState.SetBool(SessionKey, true);

            bool hasDb = AssetDatabase.LoadAssetAtPath<GameDatabase>(FishingSceneSetup.DatabasePath) != null;
            bool hasScene = File.Exists(FishingSceneSetup.ScenePath);
            if (!hasDb || !hasScene)
            {
                Debug.Log("[오늘도 꽝] 첫 실행이네요! 데이터 에셋과 Main 씬을 자동으로 만듭니다… (Tools > Setup Fishing Scene 과 동일)");
                FishingSceneSetup.Setup(false, true);
                return;
            }

            // 예전 버전으로 만든 장소 에셋이면 하늘·바다 색만 새 기본값으로 (사진 기반 배경)
            if (FishingSceneSetup.LocationVisualsOutdated()) FishingSceneSetup.UpgradeLocationVisuals();

            // 빈 Untitled 씬이 열려 있으면 Main 씬을 열어 준다
            var active = EditorSceneManager.GetActiveScene();
            if (string.IsNullOrEmpty(active.path) && !active.isDirty && active.rootCount <= 2)
                EditorSceneManager.OpenScene(FishingSceneSetup.ScenePath, OpenSceneMode.Single);
        }

        [MenuItem("Tools/오늘도 꽝/자동 셋업 끄기", false, 50)]
        static void Disable()
        {
            EditorPrefs.SetBool(DisableKey, true);
            Debug.Log("[오늘도 꽝] 프로젝트를 열 때 자동 셋업을 하지 않습니다.");
        }

        [MenuItem("Tools/오늘도 꽝/자동 셋업 끄기", true)]
        static bool DisableValidate()
        {
            return !EditorPrefs.GetBool(DisableKey, false);
        }

        [MenuItem("Tools/오늘도 꽝/자동 셋업 켜기", false, 51)]
        static void Enable()
        {
            EditorPrefs.SetBool(DisableKey, false);
            Debug.Log("[오늘도 꽝] 프로젝트를 열 때 필요하면 자동 셋업을 합니다.");
        }

        [MenuItem("Tools/오늘도 꽝/자동 셋업 켜기", true)]
        static bool EnableValidate()
        {
            return EditorPrefs.GetBool(DisableKey, false);
        }
    }
}
