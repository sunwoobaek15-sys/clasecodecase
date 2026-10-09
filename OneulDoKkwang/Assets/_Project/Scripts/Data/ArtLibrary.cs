using System;
using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 코드로 생성되는 임시 스프라이트를 진짜 아트로 교체하기 위한 슬롯 모음.
    /// key 에 맞는 sprite 를 넣으면 그 스프라이트가 우선 사용된다 (비워두면 코드 생성).
    /// 키 목록은 SpriteKeys 참고.
    /// </summary>
    [CreateAssetMenu(menuName = "오늘도 꽝/Art Library", fileName = "ArtLibrary", order = 10)]
    public class ArtLibrary : ScriptableObject
    {
        [Serializable]
        public class Entry
        {
            public string key;
            public Sprite sprite;
            [Tooltip("이 슬롯의 용도 설명 (참고용)")]
            public string note;
        }

        [Tooltip("한글이 들어있는 폰트를 넣으면 UI 전체에 사용 (비우면 OS 한글 폰트 자동 탐색)")]
        public Font uiFont;
        public List<Entry> overrides = new List<Entry>();

        Dictionary<string, Sprite> _cache;

        void OnEnable()
        {
            _cache = null;
        }

        public Sprite Find(string key)
        {
            if (_cache == null)
            {
                _cache = new Dictionary<string, Sprite>();
                foreach (var e in overrides)
                {
                    if (e != null && e.sprite != null && !string.IsNullOrEmpty(e.key))
                        _cache[e.key] = e.sprite;
                }
            }
            Sprite s;
            return _cache.TryGetValue(key, out s) ? s : null;
        }

        public void EnsureSlot(string key, string note)
        {
            foreach (var e in overrides)
                if (e != null && e.key == key) return;
            overrides.Add(new Entry { key = key, note = note });
            _cache = null;
        }
    }

    /// <summary>ArtLibrary 에서 쓰는 스프라이트 키.</summary>
    public static class SpriteKeys
    {
        public const string PlayerBody = "player.body";
        public const string PlayerHead = "player.head";
        public const string PlayerFaceOpen = "player.face.open";
        public const string PlayerFaceSleep = "player.face.sleep";
        public const string PlayerFaceSurprised = "player.face.surprised";
        public const string Rod = "player.rod";
        public const string CatBody = "cat.body";
        public const string CatTail = "cat.tail";
        public const string CatFaceOpen = "cat.face.open";
        public const string CatFaceHappy = "cat.face.happy";
        public const string CatFaceSurprised = "cat.face.surprised";
        public const string CatFaceSleep = "cat.face.sleep";
        public const string Bobber = "bobber";
        public const string Hook = "hook";
        public const string Bucket = "bucket";
        public const string HulaDancer = "npc.hula";
        public const string Turtle = "decor.turtle";
        public const string Sun = "sky.sun";
        public const string Moon = "sky.moon";

        /// <summary>(키, 설명) 목록. 에디터 셋업이 ArtLibrary 에 슬롯을 미리 만들어 둔다.</summary>
        public static readonly string[][] All =
        {
            new[] { PlayerBody, "주인공 몸통 (알로하 셔츠). 피벗: 발 아래 중앙" },
            new[] { PlayerHead, "주인공 머리 + 밀짚모자. 피벗: 목" },
            new[] { PlayerFaceOpen, "주인공 얼굴 - 기본" },
            new[] { PlayerFaceSleep, "주인공 얼굴 - 조는 중" },
            new[] { PlayerFaceSurprised, "주인공 얼굴 - 놀람" },
            new[] { Rod, "낚싯대. 피벗: 손잡이 끝(왼쪽 중앙), 오른쪽 끝이 초릿대" },
            new[] { CatBody, "화관 쓴 고양이 몸통. 피벗: 발 아래 중앙" },
            new[] { CatTail, "고양이 꼬리. 피벗: 꼬리 뿌리" },
            new[] { CatFaceOpen, "고양이 얼굴 - 기본" },
            new[] { CatFaceHappy, "고양이 얼굴 - 웃음" },
            new[] { CatFaceSurprised, "고양이 얼굴 - 놀람" },
            new[] { CatFaceSleep, "고양이 얼굴 - 잠" },
            new[] { Bobber, "찌. 피벗: 수면에 닿는 지점" },
            new[] { Hook, "바늘" },
            new[] { Bucket, "양동이" },
            new[] { HulaDancer, "훌라 추는 NPC (해변 배경)" },
            new[] { Turtle, "지나가는 바다거북 (부두 배경)" },
            new[] { Sun, "해" },
            new[] { Moon, "달" },
        };
    }
}
