using System;
using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    public enum ShopResult
    {
        Ok,
        NotEnoughMoney,
        AlreadyOwned,
        Locked,
        Invalid,
    }

    /// <summary>
    /// 게임 상태(돈, 장비, 장소, 도감 기록)와 규칙. UI/낚시 쪽은 이벤트로 변화를 받는다.
    /// </summary>
    public sealed class GameManager : MonoBehaviour
    {
        public GameDatabase Database { get; private set; }
        public SaveData Save { get; private set; }

        public readonly List<CatchData> Catches = new List<CatchData>();
        public readonly List<RodData> Rods = new List<RodData>();
        public readonly List<BaitData> Baits = new List<BaitData>();
        public readonly List<LocationData> Locations = new List<LocationData>();

        public RodData Rod { get; private set; }
        public BaitData Bait { get; private set; }
        public LocationData Location { get; private set; }

        public event Action<long, long> MoneyChanged;      // (이전, 현재)
        public event Action EquipmentChanged;
        public event Action LocationChanged;
        public event Action<CatchResult> CatchRegistered;
        public event Action ProgressChanged;               // 도감/해금 등

        /// <summary>디버그: 다음 입질을 이 대상으로 강제.</summary>
        public CatchData DebugForcedCatch;

        public long Money => Save != null ? Save.money : 0;
        public int Streak => Save != null ? Save.streak : 0;
        public int DiscoveredCount => Save != null ? Save.DiscoveredCount : 0;
        public int TotalSpecies => Catches.Count;

        public void Init(GameDatabase db, SaveData save)
        {
            Database = db;
            Catches.Clear(); Rods.Clear(); Baits.Clear(); Locations.Clear();
            foreach (var c in db.catches) if (c != null) Catches.Add(c);
            foreach (var r in db.rods) if (r != null) Rods.Add(r);
            foreach (var b in db.baits) if (b != null) Baits.Add(b);
            foreach (var l in db.locations) if (l != null) Locations.Add(l);
            Catches.Sort((a, b) => a.encyclopediaOrder.CompareTo(b.encyclopediaOrder));
            Rods.Sort((a, b) => a.shopOrder != b.shopOrder ? a.shopOrder.CompareTo(b.shopOrder) : a.price.CompareTo(b.price));
            Baits.Sort((a, b) => a.shopOrder != b.shopOrder ? a.shopOrder.CompareTo(b.shopOrder) : a.price.CompareTo(b.price));
            Locations.Sort((a, b) => a.order.CompareTo(b.order));

            Save = save ?? new SaveData();
            Save.Sanitize();
            EnsureStarterItems();
            Rod = FindRod(Save.rodId) ?? db.StarterRod;
            Bait = FindBait(Save.baitId) ?? db.StarterBait;
            Location = FindLocation(Save.locationId);
            if (Location == null || !IsUnlocked(Location)) Location = db.StarterLocation;
            WriteRuntimeStateToSave();
        }

        void EnsureStarterItems()
        {
            var rod = Database.StarterRod;
            var bait = Database.StarterBait;
            var loc = Database.StarterLocation;
            if (rod != null && !Save.ownedRods.Contains(rod.id)) Save.ownedRods.Add(rod.id);
            if (bait != null && !Save.ownedBaits.Contains(bait.id)) Save.ownedBaits.Add(bait.id);
            if (loc != null && !Save.unlockedLocations.Contains(loc.id)) Save.unlockedLocations.Add(loc.id);
            // 가격 0 짜리는 처음부터 보유
            foreach (var r in Rods) if (r.price <= 0 && !Save.ownedRods.Contains(r.id)) Save.ownedRods.Add(r.id);
            foreach (var b in Baits) if (b.price <= 0 && !Save.ownedBaits.Contains(b.id)) Save.ownedBaits.Add(b.id);
            foreach (var l in Locations) if (l.unlockPrice <= 0 && l.requiredDiscoveries <= 0 && !Save.unlockedLocations.Contains(l.id)) Save.unlockedLocations.Add(l.id);
        }

        /// <summary>시계/날씨 등 런타임 상태를 세이브 객체에 반영.</summary>
        public void WriteRuntimeStateToSave()
        {
            if (Save == null) return;
            Save.rodId = Rod != null ? Rod.id : "";
            Save.baitId = Bait != null ? Bait.id : "";
            Save.locationId = Location != null ? Location.id : "";
            if (Game.Clock != null) Save.gameMinutes = Game.Clock.TotalMinutes;
            if (Game.Weather != null)
            {
                Save.weather = (int)Game.Weather.Current;
                Save.weatherHoursLeft = Game.Weather.HoursLeft;
            }
        }

        void RequestSave()
        {
            if (Game.Saver != null) Game.Saver.MarkDirty();
        }

        // ------------------------------------------------------------- lookup

        public RodData FindRod(string id) { foreach (var r in Rods) if (r.id == id) return r; return null; }
        public BaitData FindBait(string id) { foreach (var b in Baits) if (b.id == id) return b; return null; }
        public LocationData FindLocation(string id) { foreach (var l in Locations) if (l.id == id) return l; return null; }
        public CatchData FindCatch(string id) { foreach (var c in Catches) if (c.id == id) return c; return null; }

        public bool OwnsRod(RodData r) { return r != null && Save.ownedRods.Contains(r.id); }
        public bool OwnsBait(BaitData b) { return b != null && Save.ownedBaits.Contains(b.id); }
        public bool IsUnlocked(LocationData l) { return l != null && Save.unlockedLocations.Contains(l.id); }
        public bool IsDiscovered(CatchData c) { return c != null && Save.IsDiscovered(c.id); }
        public CatchRecord GetRecord(CatchData c) { return c != null ? Save.FindRecord(c.id) : null; }

        // ------------------------------------------------------------- money

        public void AddMoney(long amount, bool earned = true)
        {
            if (amount == 0) return;
            long before = Save.money;
            Save.money = Math.Max(0, Save.money + amount);
            if (earned && amount > 0) Save.stats.totalEarned += amount;
            if (MoneyChanged != null) MoneyChanged(before, Save.money);
            RequestSave();
        }

        public bool TrySpend(long amount)
        {
            if (amount < 0 || Save.money < amount) return false;
            long before = Save.money;
            Save.money -= amount;
            if (MoneyChanged != null) MoneyChanged(before, Save.money);
            RequestSave();
            return true;
        }

        // ------------------------------------------------------------- shop

        public ShopResult BuyRod(RodData r)
        {
            if (r == null) return ShopResult.Invalid;
            if (OwnsRod(r)) return ShopResult.AlreadyOwned;
            if (!TrySpend(r.price)) return ShopResult.NotEnoughMoney;
            Save.ownedRods.Add(r.id);
            EquipRod(r);
            return ShopResult.Ok;
        }

        public ShopResult BuyBait(BaitData b)
        {
            if (b == null) return ShopResult.Invalid;
            if (OwnsBait(b)) return ShopResult.AlreadyOwned;
            if (!TrySpend(b.price)) return ShopResult.NotEnoughMoney;
            Save.ownedBaits.Add(b.id);
            EquipBait(b);
            return ShopResult.Ok;
        }

        public void EquipRod(RodData r)
        {
            if (r == null || !OwnsRod(r)) return;
            Rod = r;
            Save.rodId = r.id;
            if (EquipmentChanged != null) EquipmentChanged();
            RequestSave();
        }

        public void EquipBait(BaitData b)
        {
            if (b == null || !OwnsBait(b)) return;
            Bait = b;
            Save.baitId = b.id;
            if (EquipmentChanged != null) EquipmentChanged();
            RequestSave();
        }

        public bool MeetsRequirement(LocationData l)
        {
            return l != null && DiscoveredCount >= l.requiredDiscoveries;
        }

        public ShopResult UnlockLocation(LocationData l)
        {
            if (l == null) return ShopResult.Invalid;
            if (IsUnlocked(l)) return ShopResult.AlreadyOwned;
            if (!MeetsRequirement(l)) return ShopResult.Locked;
            if (!TrySpend(l.unlockPrice)) return ShopResult.NotEnoughMoney;
            Save.unlockedLocations.Add(l.id);
            if (ProgressChanged != null) ProgressChanged();
            RequestSave();
            return ShopResult.Ok;
        }

        /// <summary>장소 상태만 바꾼다 (화면 전환 연출은 GameDirector.Travel).</summary>
        public void SetLocation(LocationData l)
        {
            if (l == null || !IsUnlocked(l)) return;
            Location = l;
            Save.locationId = l.id;
            if (LocationChanged != null) LocationChanged();
            RequestSave();
        }

        // ------------------------------------------------------------- fishing

        public FishingContext BuildContext(float castPower, bool perfect)
        {
            return new FishingContext
            {
                location = Location != null ? Location.theme : LocationTheme.Beach,
                time = Game.Clock != null ? Game.Clock.Period : TimeOfDay.Day,
                weather = Game.Weather != null ? Game.Weather.Current : WeatherType.Clear,
                weekday = Game.Clock != null ? Game.Clock.Weekday : Weekday.Fri,
                bait = Bait,
                rod = Rod,
                castPower = castPower,
                perfectCast = perfect,
            };
        }

        /// <summary>낚아 올린 결과를 도감/돈/통계에 반영하고 결과 객체를 완성한다.</summary>
        public CatchResult RegisterCatch(CatchData data, float sizeT)
        {
            var result = new CatchResult();
            result.data = data;
            result.location = Location != null ? Location.theme : LocationTheme.Beach;
            result.released = data.special == CatchSpecial.Release;
            Save.streak = Save.streak + 1;
            result.streak = Save.streak;
            if (Save.streak > Save.stats.bestStreak) Save.stats.bestStreak = Save.streak;
            result.sizeCm = CatchMath.SizeFromT(data, sizeT);
            result.price = CatchMath.Price(data, sizeT, Save.streak);

            var rec = Save.FindRecord(data.id);
            if (rec == null)
            {
                rec = new CatchRecord { id = data.id, count = 0, bestSizeCm = 0f, firstDay = Game.Clock != null ? Game.Clock.Day : 0 };
                Save.records.Add(rec);
            }
            result.isNew = rec.count == 0;
            result.isRecord = !result.isNew && result.sizeCm > rec.bestSizeCm + 0.05f;
            rec.count++;
            if (result.sizeCm > rec.bestSizeCm) rec.bestSizeCm = result.sizeCm;

            Save.stats.catches++;
            if (result.released) Save.stats.releases++;
            if (result.price > 0) AddMoney(result.price);

            if (CatchRegistered != null) CatchRegistered(result);
            if (result.isNew && ProgressChanged != null) ProgressChanged();
            if (Game.Saver != null) Game.Saver.SaveNow();
            return result;
        }

        public void RegisterFail()
        {
            Save.streak = 0;
            Save.stats.fails++;
            RequestSave();
        }

        public void RegisterCast()
        {
            Save.stats.casts++;
        }

        // ------------------------------------------------------------- debug

        public void DebugUnlockAll()
        {
            foreach (var r in Rods) if (!Save.ownedRods.Contains(r.id)) Save.ownedRods.Add(r.id);
            foreach (var b in Baits) if (!Save.ownedBaits.Contains(b.id)) Save.ownedBaits.Add(b.id);
            foreach (var l in Locations) if (!Save.unlockedLocations.Contains(l.id)) Save.unlockedLocations.Add(l.id);
            if (EquipmentChanged != null) EquipmentChanged();
            if (ProgressChanged != null) ProgressChanged();
            RequestSave();
        }

        /// <summary>아직 못 잡은 대상 중 다음 것 (디버그 강제 입질용).</summary>
        public CatchData NextUndiscovered(CatchData after)
        {
            int start = after != null ? Catches.IndexOf(after) + 1 : 0;
            for (int i = 0; i < Catches.Count; i++)
            {
                var c = Catches[(start + i) % Catches.Count];
                if (!IsDiscovered(c)) return c;
            }
            return Catches.Count > 0 ? Catches[start % Catches.Count] : null;
        }
    }
}
