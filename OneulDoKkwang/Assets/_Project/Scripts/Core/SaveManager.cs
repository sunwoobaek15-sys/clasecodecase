using System;
using System.IO;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// JSON 파일 저장 (PlayerPrefs 아님). 경로: Application.persistentDataPath/oneuldo_kkwang_save.json
    /// 임시 파일에 먼저 쓰고 교체해서, 저장 중 꺼져도 기존 세이브가 깨지지 않게 한다.
    /// </summary>
    public sealed class SaveManager : MonoBehaviour
    {
        public const string FileName = "oneuldo_kkwang_save.json";

        [Tooltip("자동 저장 간격 (초, 실제 시간)")]
        public float autoSaveInterval = 20f;

        float _timer;
        bool _dirty;

        public static string SavePath => Path.Combine(Application.persistentDataPath, FileName);

        public static SaveData Load()
        {
            try
            {
                string path = SavePath;
                if (!File.Exists(path)) return null;
                string json = File.ReadAllText(path);
                if (string.IsNullOrWhiteSpace(json)) return null;
                var data = JsonUtility.FromJson<SaveData>(json);
                if (data == null) return null;
                data.Sanitize();
                return data;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[오늘도 꽝] 세이브 파일을 읽지 못해 새로 시작합니다: " + e.Message);
                TryBackupCorrupt();
                return null;
            }
        }

        static void TryBackupCorrupt()
        {
            try
            {
                string path = SavePath;
                if (File.Exists(path)) File.Copy(path, path + ".corrupt", true);
            }
            catch (Exception)
            {
                // 백업 실패는 무시
            }
        }

        public static bool Write(SaveData data)
        {
            if (data == null) return false;
            try
            {
                data.version = SaveData.CurrentVersion;
                data.lastSavedUtc = DateTime.UtcNow.ToString("o");
                string json = JsonUtility.ToJson(data, true);
                string path = SavePath;
                string dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
                string tmp = path + ".tmp";
                File.WriteAllText(tmp, json);
                if (File.Exists(path)) File.Delete(path);
                File.Move(tmp, path);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[오늘도 꽝] 저장 실패: " + e.Message);
                return false;
            }
        }

        public static void Delete()
        {
            try
            {
                if (File.Exists(SavePath)) File.Delete(SavePath);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[오늘도 꽝] 세이브 삭제 실패: " + e.Message);
            }
        }

        /// <summary>다음 프레임 끝 즈음 저장 (여러 번 불러도 한 번만 씀).</summary>
        public void MarkDirty()
        {
            _dirty = true;
        }

        public void SaveNow()
        {
            if (Game.State == null) return;
            Game.State.WriteRuntimeStateToSave();
            Write(Game.State.Save);
            _dirty = false;
            _timer = 0f;
        }

        void LateUpdate()
        {
            _timer += Time.unscaledDeltaTime;
            if (_dirty || _timer >= autoSaveInterval) SaveNow();
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) SaveNow();
        }

        void OnApplicationQuit()
        {
            SaveNow();
        }
    }
}
