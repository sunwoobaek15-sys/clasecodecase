using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 모든 데이터 에셋 목록. 에디터 셋업이 Resources/GameDatabase.asset 으로 만들어 둔다.
    /// 에셋이 없으면 런타임에 DefaultContent 로 메모리 상에서 만든다.
    /// </summary>
    [CreateAssetMenu(menuName = "오늘도 꽝/Game Database", fileName = "GameDatabase", order = 9)]
    public class GameDatabase : ScriptableObject
    {
        public const string ResourcesPath = "GameDatabase";

        public List<CatchData> catches = new List<CatchData>();
        public List<RodData> rods = new List<RodData>();
        public List<BaitData> baits = new List<BaitData>();
        public List<LocationData> locations = new List<LocationData>();
        [Tooltip("코드 생성 스프라이트를 교체할 슬롯 (선택)")]
        public ArtLibrary art;

        Dictionary<string, CatchData> _catchById;

        void OnEnable()
        {
            _catchById = null;
        }

        public bool IsUsable
        {
            get
            {
                return CountValid(catches) > 0 && CountValid(rods) > 0 && CountValid(baits) > 0 && CountValid(locations) > 0;
            }
        }

        static int CountValid<T>(List<T> list) where T : Object
        {
            if (list == null) return 0;
            int n = 0;
            foreach (var x in list) if (x != null) n++;
            return n;
        }

        /// <summary>null 항목 제거 + 정렬.</summary>
        public void Normalize()
        {
            catches.RemoveAll(c => c == null);
            rods.RemoveAll(r => r == null);
            baits.RemoveAll(b => b == null);
            locations.RemoveAll(l => l == null);
            catches.Sort((a, b) => a.encyclopediaOrder.CompareTo(b.encyclopediaOrder));
            rods.Sort((a, b) => a.shopOrder != b.shopOrder ? a.shopOrder.CompareTo(b.shopOrder) : a.price.CompareTo(b.price));
            baits.Sort((a, b) => a.shopOrder != b.shopOrder ? a.shopOrder.CompareTo(b.shopOrder) : a.price.CompareTo(b.price));
            locations.Sort((a, b) => a.order.CompareTo(b.order));
            _catchById = null;
        }

        public CatchData GetCatch(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            if (_catchById == null)
            {
                _catchById = new Dictionary<string, CatchData>();
                foreach (var c in catches)
                    if (c != null && !string.IsNullOrEmpty(c.id)) _catchById[c.id] = c;
            }
            CatchData d;
            return _catchById.TryGetValue(id, out d) ? d : null;
        }

        public RodData GetRod(string id)
        {
            foreach (var r in rods) if (r != null && r.id == id) return r;
            return null;
        }

        public BaitData GetBait(string id)
        {
            foreach (var b in baits) if (b != null && b.id == id) return b;
            return null;
        }

        public LocationData GetLocation(string id)
        {
            foreach (var l in locations) if (l != null && l.id == id) return l;
            return null;
        }

        public RodData StarterRod
        {
            get
            {
                RodData best = null;
                foreach (var r in rods) if (r != null && (best == null || r.price < best.price)) best = r;
                return best;
            }
        }

        public BaitData StarterBait
        {
            get
            {
                BaitData best = null;
                foreach (var b in baits) if (b != null && (best == null || b.price < best.price)) best = b;
                return best;
            }
        }

        public LocationData StarterLocation
        {
            get
            {
                LocationData best = null;
                foreach (var l in locations) if (l != null && (best == null || l.order < best.order)) best = l;
                return best;
            }
        }
    }
}
