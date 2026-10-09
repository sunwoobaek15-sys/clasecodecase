using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace OneulDoKkwang.EditorTools
{
    /// <summary>
    /// Tools/오늘도 꽝/어종 출현 검증: 모든 어종이 "어떤 조건에서든" 잡히는지(가중치 > 0) 확인하고,
    /// 가장 잘 나오는 조건과 확률을 표로 출력한다. 밸런스를 고친 뒤 돌려 보면 좋다.
    /// </summary>
    public static class CatchTableValidator
    {
        [MenuItem("Tools/오늘도 꽝/어종 출현 검증 (전부 잡을 수 있나?)", false, 10)]
        public static void Validate()
        {
            var db = AssetDatabase.LoadAssetAtPath<GameDatabase>(FishingSceneSetup.DatabasePath);
            bool temp = false;
            if (db == null || !db.IsUsable)
            {
                db = DefaultContent.CreateRuntimeDatabase();
                temp = true;
            }
            var catches = db.catches.Where(c => c != null).OrderBy(c => c.encyclopediaOrder).ToList();
            var baits = db.baits.Where(b => b != null).ToList();
            var rods = db.rods.Where(r => r != null).ToList();

            var sb = new StringBuilder();
            sb.AppendLine("[오늘도 꽝] 어종 출현 검증 (" + (temp ? "코드 기본값" : "GameDatabase 에셋") + ", " + catches.Count + "종)");
            int bad = 0;
            var ids = new HashSet<string>();
            foreach (var c in catches)
            {
                if (!ids.Add(c.id))
                {
                    sb.AppendLine("  ✗ 중복 id: " + c.id);
                    bad++;
                }
                FishingContext best;
                float chance;
                bool ok = CatchTable.FindBestCondition(catches, c, baits, rods, out best, out chance);
                if (!ok)
                {
                    bad++;
                    sb.AppendLine("  ✗ " + c.displayName + " (" + c.id + ") : 어떤 조건에서도 나오지 않음! 출현 장소/시간/날씨/미끼 조건을 확인하세요.");
                    continue;
                }
                sb.AppendLine(string.Format("  ✓ {0,-3} [{1}] {2} — 최고 {3:0.0}% @ {4} · {5} · {6} · {7}요일 · 미끼 {8}",
                    c.encyclopediaOrder, c.rarity.Korean(), c.displayName, chance * 100f,
                    best.location.Korean(), best.time.Korean(), best.weather.Korean(), best.weekday.Korean(),
                    best.bait != null ? best.bait.displayName : "-"));
            }
            if (catches.Count < 25)
            {
                bad++;
                sb.AppendLine("  ✗ 어종이 25종보다 적습니다: " + catches.Count);
            }
            sb.AppendLine(bad == 0 ? "결과: 전부 잡을 수 있음 ✓" : "결과: 문제 " + bad + "건 ✗");
            if (bad == 0) Debug.Log(sb.ToString());
            else Debug.LogWarning(sb.ToString());
            if (temp)
            {
                foreach (var c in db.catches) if (c != null) Object.DestroyImmediate(c);
                foreach (var r in db.rods) if (r != null) Object.DestroyImmediate(r);
                foreach (var b in db.baits) if (b != null) Object.DestroyImmediate(b);
                foreach (var l in db.locations) if (l != null) Object.DestroyImmediate(l);
                Object.DestroyImmediate(db);
            }
        }
    }
}
