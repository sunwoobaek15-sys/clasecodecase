using System;
using System.Collections.Generic;

namespace OneulDoKkwang
{
    /// <summary>도감 한 칸의 기록.</summary>
    [Serializable]
    public class CatchRecord
    {
        public string id;
        public int count;
        public float bestSizeCm;
        public int firstDay;
    }

    [Serializable]
    public class PlayStats
    {
        public int casts;
        public int catches;
        public int fails;
        public int releases;
        public int catSteals;
        public int bestStreak;
        public long totalEarned;
    }

    /// <summary>
    /// 저장 데이터 (JSON). PlayerPrefs 가 아니라 persistentDataPath 의 파일로 저장한다.
    /// JsonUtility 호환: Dictionary 대신 List 사용.
    /// </summary>
    [Serializable]
    public class SaveData
    {
        public const int CurrentVersion = 1;

        public int version = CurrentVersion;
        public long money;
        public string rodId = "";
        public string baitId = "";
        public string locationId = "";
        public List<string> ownedRods = new List<string>();
        public List<string> ownedBaits = new List<string>();
        public List<string> unlockedLocations = new List<string>();
        public List<CatchRecord> records = new List<CatchRecord>();
        public double gameMinutes = GameClock.StartMinutes;
        public int weather;
        public float weatherHoursLeft;
        public bool introSeen;
        public int streak;
        public PlayStats stats = new PlayStats();
        public float bgmVolume = 0.8f;
        public float sfxVolume = 1f;
        public string lastSavedUtc = "";

        /// <summary>JSON 에서 빠졌거나 깨진 값을 보정.</summary>
        public void Sanitize()
        {
            if (ownedRods == null) ownedRods = new List<string>();
            if (ownedBaits == null) ownedBaits = new List<string>();
            if (unlockedLocations == null) unlockedLocations = new List<string>();
            if (records == null) records = new List<CatchRecord>();
            records.RemoveAll(r => r == null || string.IsNullOrEmpty(r.id));
            if (stats == null) stats = new PlayStats();
            if (rodId == null) rodId = "";
            if (baitId == null) baitId = "";
            if (locationId == null) locationId = "";
            if (money < 0) money = 0;
            if (double.IsNaN(gameMinutes) || double.IsInfinity(gameMinutes) || gameMinutes < 0) gameMinutes = GameClock.StartMinutes;
            if (weather != 0 && weather != 1) weather = 0;
            if (float.IsNaN(weatherHoursLeft) || weatherHoursLeft < 0f) weatherHoursLeft = 0f;
            if (streak < 0) streak = 0;
            if (float.IsNaN(bgmVolume)) bgmVolume = 0.8f;
            if (float.IsNaN(sfxVolume)) sfxVolume = 1f;
            bgmVolume = bgmVolume < 0f ? 0f : (bgmVolume > 1f ? 1f : bgmVolume);
            sfxVolume = sfxVolume < 0f ? 0f : (sfxVolume > 1f ? 1f : sfxVolume);
        }

        public CatchRecord FindRecord(string id)
        {
            foreach (var r in records) if (r.id == id) return r;
            return null;
        }

        public bool IsDiscovered(string id)
        {
            var r = FindRecord(id);
            return r != null && r.count > 0;
        }

        public int DiscoveredCount
        {
            get
            {
                int n = 0;
                foreach (var r in records) if (r.count > 0) n++;
                return n;
            }
        }
    }
}
