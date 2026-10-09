using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 한글이 보이는 폰트를 고른다.
    /// 1) ArtLibrary.uiFont (직접 넣은 폰트) → 2) OS 한글 폰트(맑은 고딕, 애플 SD 고딕 Neo, Noto Sans CJK…)
    /// → 3) 유니티 기본 폰트 (LegacyRuntime.ttf, OS 폴백으로 한글 표시).
    /// </summary>
    public static class UIFonts
    {
        static Font _main;

        static readonly string[] KoreanFontNames =
        {
            "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "AppleSDGothicNeo-Regular", "AppleGothic",
            "Noto Sans CJK KR", "Noto Sans KR", "NanumGothic", "NanumBarunGothic", "Nanum Gothic",
            "Noto Sans CJK JP", "Droid Sans Fallback", "Arial Unicode MS",
        };

        public static void Reset()
        {
            _main = null;
        }

        public static Font Main
        {
            get
            {
                if (_main != null) return _main;
                var db = Game.State != null ? Game.State.Database : null;
                if (db != null && db.art != null && db.art.uiFont != null)
                {
                    _main = db.art.uiFont;
                    return _main;
                }
                try
                {
                    var installed = new HashSet<string>(Font.GetOSInstalledFontNames());
                    var pick = new List<string>();
                    foreach (var n in KoreanFontNames) if (installed.Contains(n)) pick.Add(n);
                    if (pick.Count > 0)
                    {
                        pick.Add("Arial");
                        _main = Font.CreateDynamicFontFromOSFont(pick.ToArray(), 32);
                    }
                }
                catch (System.Exception e)
                {
                    Debug.LogWarning("[오늘도 꽝] OS 폰트를 불러오지 못했습니다: " + e.Message);
                }
                if (_main == null) _main = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                return _main;
            }
        }
    }
}
