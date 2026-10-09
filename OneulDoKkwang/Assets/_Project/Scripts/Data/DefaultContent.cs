using System.Collections.Generic;
using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 기본 콘텐츠(어종 34종, 낚싯대 5, 미끼 6, 장소 4)를 코드로 만든다.
    /// - 에디터: Tools/오늘도 꽝/Setup Fishing Scene 이 이 결과를 .asset 으로 저장한다.
    /// - 런타임: GameDatabase 에셋이 없을 때 메모리에서 바로 만들어 쓴다 (Play 즉시 가능).
    /// 밸런스를 바꾸고 싶으면 생성된 에셋(Data/ 폴더)을 인스펙터에서 고치면 된다.
    /// </summary>
    public static class DefaultContent
    {
        public sealed class ContentSet
        {
            public readonly List<CatchData> catches = new List<CatchData>();
            public readonly List<RodData> rods = new List<RodData>();
            public readonly List<BaitData> baits = new List<BaitData>();
            public readonly List<LocationData> locations = new List<LocationData>();
        }

        /// <summary>메모리 상에 GameDatabase 를 통째로 만든다.</summary>
        public static GameDatabase CreateRuntimeDatabase()
        {
            var set = CreateAll();
            var db = ScriptableObject.CreateInstance<GameDatabase>();
            db.name = "GameDatabase (runtime default)";
            db.catches.AddRange(set.catches);
            db.rods.AddRange(set.rods);
            db.baits.AddRange(set.baits);
            db.locations.AddRange(set.locations);
            db.Normalize();
            return db;
        }

        /// <summary>장소 기본값만 만든다 (에디터의 색 업그레이드용).</summary>
        public static List<LocationData> CreateLocations()
        {
            var list = new List<LocationData>();
            AddLocations(list);
            return list;
        }

        public static ContentSet CreateAll()
        {
            var set = new ContentSet();
            AddCatches(set.catches);
            AddRods(set.rods);
            AddBaits(set.baits);
            AddLocations(set.locations);
            return set;
        }

        // ------------------------------------------------------------------ 어종

        static int _order;

        static CatchData Catch(string id, string name, CatchRarity rarity, LocationMask where, TimeMask when,
            float minCm, float maxCm, int price, MovePattern pattern, float difficulty, CatchTags tags,
            string description, IconStyle icon)
        {
            var c = ScriptableObject.CreateInstance<CatchData>();
            c.name = id;
            c.id = id;
            c.displayName = name;
            c.rarity = rarity;
            c.locations = where;
            c.times = when;
            c.sizeRangeCm = new Vector2(minCm, maxCm);
            c.basePrice = price;
            c.movePattern = pattern;
            c.difficulty = difficulty;
            c.tags = tags;
            c.description = description;
            c.iconStyle = icon;
            c.encyclopediaOrder = _order++;
            return c;
        }

        static IconStyle Icon(IconShape shape, string a, string b, string c, float variant = 0f)
        {
            return new IconStyle(shape, Hex.C(a), Hex.C(b), Hex.C(c), variant);
        }

        static void AddCatches(List<CatchData> list)
        {
            _order = 0;
            const LocationMask B = LocationMask.Beach;
            const LocationMask P = LocationMask.Pier;
            const LocationMask V = LocationMask.Volcano;
            const LocationMask C = LocationMask.Cloud;
            const TimeMask D = TimeMask.Day;
            const TimeMask S = TimeMask.Sunset;
            const TimeMask N = TimeMask.Night;
            const TimeMask All = TimeMask.All;

            CatchData c;

            // ---- 흔함 -----------------------------------------------------
            list.Add(Catch("crucian", "붕어", CatchRarity.Common, B | P, All, 15, 35, 30, MovePattern.Calm, 0.15f,
                CatchTags.Fish, "그냥 붕어. 오히려 좋아.",
                Icon(IconShape.Fish, "#C9A15B", "#F3E1B0", "#8A6A35", 0.1f)));

            list.Add(Catch("mackerel", "고등어", CatchRarity.Common, B | P, All, 20, 45, 40, MovePattern.Darting, 0.3f,
                CatchTags.Fish, "등이 푸르다. 오늘 저녁 메뉴 후보 1순위인 걸 본인만 모른다.",
                Icon(IconShape.Fish, "#3E7CB1", "#DDE8F0", "#1F3B5A", 0.6f)));

            list.Add(Catch("yellowtang", "옐로우탱", CatchRarity.Common, P, D | S, 10, 20, 45, MovePattern.Calm, 0.25f,
                CatchTags.Fish | CatchTags.Tropical, "노랗다. 진짜 노랗다. 형광펜 아님 주의.",
                Icon(IconShape.TropicalFish, "#FFD23F", "#FFF3B0", "#F4A100", 0.1f)));

            list.Add(Catch("puffer", "복어", CatchRarity.Common, B | P, All, 15, 40, 55, MovePattern.Calm, 0.35f,
                CatchTags.Fish | CatchTags.Tropical, "건드리면 부푼다. 기분 나빠도 부푼다. 사실 그냥 부푼다.",
                Icon(IconShape.Puffer, "#E8C872", "#FFF6DA", "#7A5C2E")));

            c = Catch("jellyfish", "해파리", CatchRarity.Common, B | P, S | N, 20, 60, 35, MovePattern.Floater, 0.2f,
                CatchTags.Sea, "투명해서 본인도 자기가 어디 있는지 모른다. 비 오는 날 자주 떠오른다.",
                Icon(IconShape.Jellyfish, "#B8A6FF", "#EEE8FF", "#8E7CE0"));
            c.rainMultiplier = 2.2f;
            list.Add(c);

            c = Catch("office_crucian", "출근하기 싫은 붕어", CatchRarity.Common, B | P, D, 18, 30, 50, MovePattern.Lazy, 0.2f,
                CatchTags.Fish | CatchTags.Weird, "월요일엔 절대 안 물림. 오늘은 연차 내고 물어줬다.",
                Icon(IconShape.OfficeFish, "#C9A15B", "#F3E1B0", "#2F4B8A"));
            c.neverOnMonday = true;
            c.escapeLine = "붕어가 \"아 저 오늘 반차예요\" 하고 퇴근했다.";
            list.Add(c);

            c = Catch("boot", "장화 한 짝", CatchRarity.Common, B | P | V, All, 25, 32, 5, MovePattern.Sinker, 0.1f,
                CatchTags.Junk, "나머지 한 짝은 다음 생에.",
                Icon(IconShape.Boot, "#F2C14E", "#3A3A3A", "#FFFFFF"));
            c.spawnWeight = 0.8f;
            list.Add(c);

            list.Add(Catch("bungeoppang", "붕어빵", CatchRarity.Common, B, S | N, 12, 18, 25, MovePattern.Calm, 0.2f,
                CatchTags.Food | CatchTags.Weird, "슈크림이다. 팥파는 분노했다.",
                Icon(IconShape.Bungeoppang, "#D9944A", "#F2C27B", "#8C5223")));

            c = Catch("pet_rock", "반려 돌", CatchRarity.Common, LocationMask.All, All, 8, 15, 1, MovePattern.Still, 0f,
                CatchTags.Junk | CatchTags.Weird, "릴 감기 미니게임에서 전혀 움직이지 않는다. 그게 매력이다.",
                Icon(IconShape.Rock, "#9AA0A6", "#C5CAD0", "#5F6368"));
            c.spawnWeight = 0.6f;
            c.escapeLine = "돌이… 도망쳤다? 움직이지도 않는데?";
            list.Add(c);

            c = Catch("civil_doc", "민원서류", CatchRarity.Common, B | V, D, 29.7f, 29.7f, 15, MovePattern.Bureaucrat, 0.35f,
                CatchTags.Junk, "처리기한 D-3. 담당자는 휴가 중(본인). 크기는 언제나 A4.",
                Icon(IconShape.Document, "#FFFFFF", "#D0D7E2", "#E63946"));
            c.escapeLine = "서류가 반려되었습니다. 사유: 낚시 중 접수 불가.";
            list.Add(c);

            list.Add(Catch("pineapple", "파인애플", CatchRarity.Common, B | P, D | S, 20, 35, 35, MovePattern.Floater, 0.25f,
                CatchTags.Food | CatchTags.Tropical, "피자 위에 올라가기 전, 가장 순수했던 시절.",
                Icon(IconShape.Pineapple, "#F7C548", "#4CAF50", "#C98F1C")));

            list.Add(Catch("coconut", "코코넛", CatchRarity.Common, B, All, 15, 25, 30, MovePattern.Floater, 0.15f,
                CatchTags.Food | CatchTags.Tropical, "바다를 떠돌다 낚였다. 머리 조심. 안에 물 있음.",
                Icon(IconShape.Coconut, "#7B4B2A", "#A0693F", "#F5F0E1")));

            c = Catch("eel", "장어", CatchRarity.Common, B | P, N, 40, 90, 70, MovePattern.Slippery, 0.45f,
                CatchTags.Fish, "미끌미끌. 계약서 조항도 빠져나갈 기세.",
                Icon(IconShape.Eel, "#5B6B3A", "#C9C79A", "#2E3520"));
            c.rainMultiplier = 1.6f;
            list.Add(c);

            list.Add(Catch("grilled_mackerel", "숯불 고등어구이", CatchRarity.Common, V, All, 25, 40, 90, MovePattern.Calm, 0.3f,
                CatchTags.Food | CatchTags.Grilled, "잡자마자 완성. 레몬은 별도 구매.",
                Icon(IconShape.GrilledFish, "#B5651D", "#E8B26A", "#3B2414")));

            list.Add(Catch("medium_squid", "미디엄 레어 오징어", CatchRarity.Common, V, All, 20, 45, 80, MovePattern.Slippery, 0.35f,
                CatchTags.Food | CatchTags.Grilled, "굽기 정도: 미디엄 레어. 셰프의 추천.",
                Icon(IconShape.Squid, "#E8875A", "#F7C9A8", "#8C3B1E")));

            list.Add(Catch("cloud_sheep", "구름 양", CatchRarity.Common, C, All, 40, 80, 120, MovePattern.Floater, 0.3f,
                CatchTags.Weird, "세다 보면 잠든다. 한 마리, 두 마리, 세 마…zzZ",
                Icon(IconShape.Sheep, "#FFFFFF", "#F0E6FA", "#5A4E66")));

            list.Add(Catch("lost_parcel", "떠다니는 택배 상자", CatchRarity.Common, C, All, 30, 60, 100, MovePattern.Lazy, 0.3f,
                CatchTags.Junk, "배송 출발: 3년 전. 현재 위치: 구름 위. 새벽 배송도 된다. 기사님 힘내세요.",
                Icon(IconShape.Parcel, "#C8935A", "#E5BE8A", "#8A5A2B")));

            // ---- 희귀 -----------------------------------------------------
            list.Add(Catch("mahimahi", "마히마히", CatchRarity.Rare, B | P, D | S, 60, 120, 220, MovePattern.Darting, 0.55f,
                CatchTags.Fish | CatchTags.Tropical, "하와이 식당 메뉴판에서 본 그 녀석. 실물이 훨씬 화려하다.",
                Icon(IconShape.Fish, "#2FAF8F", "#FFE45E", "#1B6F8F", 0.35f)));

            c = Catch("humuhumu", "후무후무누쿠누쿠아푸아아", CatchRarity.Rare, P, D, 15, 25, 260, MovePattern.Darting, 0.5f,
                CatchTags.Fish | CatchTags.Tropical, "이름 말하다 놓침. …이번엔 '후무'까지만 말하고 잡았다. 하와이 주(州) 물고기.",
                Icon(IconShape.TropicalFish, "#F2E9D8", "#2B2D42", "#F4D35E", 0.9f));
            c.special = CatchSpecial.LongName;
            c.reelShout = "후무후무누쿠누쿠아푸…아…";
            c.escapeLine = "이름 말하다 놓침. \"후무후무누쿠누쿠아푸아…\" 아.";
            list.Add(c);

            list.Add(Catch("ahi", "참치 (아히)", CatchRarity.Rare, B | P, S | N, 80, 180, 320, MovePattern.Aggressive, 0.65f,
                CatchTags.Fish, "포케 3인분 확정. 참치도 그걸 알고 있다.",
                Icon(IconShape.Tuna, "#23395B", "#C9D6E3", "#F2C14E")));

            list.Add(Catch("opakapaka", "오파카파카", CatchRarity.Rare, P, N, 30, 70, 240, MovePattern.Calm, 0.5f,
                CatchTags.Fish | CatchTags.Tropical, "이름이 귀여운데 본인은 모른다. 알려주지 말자.",
                Icon(IconShape.Fish, "#F28CA0", "#FFE0E6", "#C2556B", 0.3f)));

            c = Catch("sunfish", "개복치", CatchRarity.Rare, B | P, D, 100, 250, 280, MovePattern.Fainter, 0.45f,
                CatchTags.Fish, "릴 감는 소리에 놀라서 세 번 기절했다. 물 밖은 더 무섭다.",
                Icon(IconShape.Sunfish, "#8FA3B8", "#D9E2EC", "#5A6B7D"));
            c.escapeLine = "개복치가 놀라서 기절했다… 가 깨어나서 도망갔다.";
            list.Add(c);

            list.Add(Catch("seahorse", "해마", CatchRarity.Rare, P, D | S, 8, 18, 200, MovePattern.Hula, 0.35f,
                CatchTags.Fish | CatchTags.Tropical, "이 집은 아빠가 출산한다. 육아휴직도 아빠가 쓴다.",
                Icon(IconShape.Seahorse, "#F4A259", "#FFD8A8", "#B8641F")));

            c = Catch("honu", "바다거북 (호누)", CatchRarity.Rare, P, All, 60, 110, 0, MovePattern.Calm, 0.3f,
                CatchTags.Sea, "보호종이다! 잡으면 안 됨. 사진만 한 장 찍고 바로 방생했다.",
                Icon(IconShape.Turtle, "#6A994E", "#A7C957", "#386641"));
            c.special = CatchSpecial.Release;
            c.escapeLine = "거북이가 유유히 떠나갔다. 원래 그래야 한다.";
            list.Add(c);

            c = Catch("bullied_shark", "왕따 당한 상어", CatchRarity.Rare, B | P, S | N, 120, 260, 380, MovePattern.Avoider, 0.6f,
                CatchTags.Fish | CatchTags.Weird, "상어 단톡방에서 강퇴당했다. 지느러미가 축 처져 있다. 조용히 위로해 주자.",
                Icon(IconShape.Shark, "#7D8FA3", "#E3E8EE", "#4A5A6B"));
            c.escapeLine = "상어가 \"나 혼자 있고 싶어…\" 하며 떠났다.";
            list.Add(c);

            c = Catch("wifi_router", "와이파이 공유기", CatchRarity.Rare, P | C, All, 15, 25, 180, MovePattern.Teleport, 0.55f,
                CatchTags.Junk | CatchTags.Weird, "비밀번호는 냉장고 옆에. 신호가 약해지면 순간이동한다.",
                Icon(IconShape.Router, "#F5F5F5", "#3A86FF", "#2B2D42"));
            c.escapeLine = "연결이 끊겼습니다. (공유기를 껐다 켜 보세요)";
            list.Add(c);

            list.Add(Catch("surf_crucian", "서핑보드에 탄 붕어", CatchRarity.Rare, B, D, 140, 200, 230, MovePattern.Surf, 0.5f,
                CatchTags.Fish | CatchTags.Weird, "파도 타다가 낚였다. 본인은 아직 파도 타는 중인 줄 안다. (크기는 보드 포함)",
                Icon(IconShape.SurfFish, "#C9A15B", "#FF6B6B", "#4ECDC4")));

            c = Catch("hawaiian_pizza", "하와이안 피자 한 조각", CatchRarity.Rare, B | V, S | N, 18, 25, 160, MovePattern.Chaos, 0.55f,
                CatchTags.Food | CatchTags.Weird, "논쟁 발생. 파인애플 찬반 토론으로 단톡방이 화(火)와이안 상태다.",
                Icon(IconShape.Pizza, "#FFD166", "#E76F51", "#F7B32B"));
            c.escapeLine = "피자가 \"파인애플은 근본이다!\"라고 외치며 도망갔다.";
            list.Add(c);

            list.Add(Catch("hula_octopus", "훌라 추는 문어", CatchRarity.Rare, P, S, 40, 90, 250, MovePattern.Hula, 0.5f,
                CatchTags.Sea | CatchTags.Tropical | CatchTags.Weird, "다리가 8개라 훌라 박자도 8배. 앙코르 요청은 정중히 거절.",
                Icon(IconShape.Octopus, "#E56B6F", "#F6BD60", "#84A59D")));

            c = Catch("airpod", "잃어버린 에어팟 한쪽", CatchRarity.Rare, B, All, 3, 4, 150, MovePattern.Darting, 0.6f,
                CatchTags.Junk, "노이즈 캔슬링 모드라 내 말이 안 들린다. 나머지 한쪽은 장화가 갖고 있다는 소문.",
                Icon(IconShape.Earbud, "#FFFFFF", "#E0E0E0", "#9E9E9E"));
            c.escapeLine = "블루투스 연결이 끊어졌다.";
            list.Add(c);

            c = Catch("rainbow_trout", "무지개 송어", CatchRarity.Rare, C, D | S, 30, 70, 300, MovePattern.Surf, 0.55f,
                CatchTags.Fish, "비 오는 날 구름 사이에서 자주 보인다. 진짜 무지개를 두르고 있다.",
                Icon(IconShape.Fish, "#8DB6CD", "#F1F7FA", "#FF8FAB", 1f));
            c.rainMultiplier = 3f;
            list.Add(c);

            list.Add(Catch("lava_eel", "용암 장어구이", CatchRarity.Rare, V, N, 50, 90, 350, MovePattern.Aggressive, 0.6f,
                CatchTags.Food | CatchTags.Grilled, "양념까지 다 되어 있다. 화산이 요리 유튜버였다.",
                Icon(IconShape.Eel, "#A0461C", "#E09A4F", "#3B1A0B", 1f)));

            // ---- 전설 -----------------------------------------------------
            c = Catch("sea_king", "바다의 왕", CatchRarity.Legendary, B | P, S | N, 300, 600, 3000, MovePattern.KingPhases, 0.8f,
                CatchTags.Fish, "왕관이 물에 젖어서 기분이 매우 안 좋다. 3단 변신을 한다. 하와이 바다의 진짜 주인.",
                Icon(IconShape.KingFish, "#1D3557", "#A8DADC", "#FFD700"));
            c.special = CatchSpecial.Legendary;
            c.minCastPower = 0.8f;
            c.escapeLine = "왕은 서민의 낚싯대를 거부했다.";
            c.reelShout = "와, 왕관 쓴 물고기다!!";
            list.Add(c);

            // ---- ??? ------------------------------------------------------
            c = Catch("mystery", "진짜 꽝", CatchRarity.Mystery, LocationMask.All, N, 7f, 7.7f, 7777, MovePattern.Mystery, 0.85f,
                CatchTags.Weird, "축하합니다! 꽝입니다. 이 게임에서 제일 귀한 꽝. 뒷면에 '다음 기회에'라고 적혀 있다.",
                Icon(IconShape.Ticket, "#FFD166", "#C0C0C0", "#E63946"));
            c.special = CatchSpecial.Mystery;
            c.weather = WeatherRule.RainOnly;
            c.requiresGoldenBait = true;
            c.escapeLine = "꽝을 놓쳤다. 꽝을 놓치면… 당첨인가?";
            c.reelShout = "이건… 뭔가 이상하다!";
            list.Add(c);
        }

        // ------------------------------------------------------------------ 낚싯대

        static RodData Rod(string id, string name, int price, float bar, float power, float dist, float luck,
            string body, string accent, string desc)
        {
            var r = ScriptableObject.CreateInstance<RodData>();
            r.name = id;
            r.id = id;
            r.displayName = name;
            r.price = price;
            r.barSize = bar;
            r.reelPower = power;
            r.castDistance = dist;
            r.luck = luck;
            r.rodColor = Hex.C(body);
            r.accentColor = Hex.C(accent);
            r.description = desc;
            return r;
        }

        static void AddRods(List<RodData> list)
        {
            int i = 0;
            RodData r;
            r = Rod("bamboo", "대나무 낚싯대", 0, 0.24f, 1f, 1f, 0f, "#C8A165", "#5E8C31",
                "하와이 공항 기념품 가게에서 샀다. 손잡이에 'ALOHA'라고 적혀 있다.");
            r.shopOrder = i++; list.Add(r);
            r = Rod("carbon", "카본 낚싯대", 350, 0.27f, 1.12f, 1.1f, 0.05f, "#2B2D42", "#EF233C",
                "가볍다. 들고 있으면 왠지 프로 같다. 실력은 그대로다.");
            r.shopOrder = i++; list.Add(r);
            r = Rod("surf_rod", "서핑보드 깎은 낚싯대", 1200, 0.3f, 1.22f, 1.2f, 0.1f, "#4ECDC4", "#FF6B6B",
                "서핑보드를 깎아서 만들었다. 파도 타는 물고기에게 강하다 (기분 탓).");
            r.shopOrder = i++; list.Add(r);
            r = Rod("lava_rod", "용암 내열 낚싯대", 3000, 0.32f, 1.32f, 1.28f, 0.15f, "#3D0C02", "#FF7B00",
                "섭씨 1200도에서도 멀쩡하다. 손은 멀쩡하지 않다.");
            r.shopOrder = i++; list.Add(r);
            r = Rod("rainbow_rod", "무지개 낚싯대", 8000, 0.36f, 1.45f, 1.34f, 0.25f, "#B388EB", "#FFD166",
                "구름 위 장인이 무지개를 꼬아 만들었다. 꽝 확률은 여전히 존재한다.");
            r.shopOrder = i++; list.Add(r);
        }

        // ------------------------------------------------------------------ 미끼

        static BaitData Bait(string id, string name, int price, float biteSpeed, float rare, float legend,
            CatchTags favored, float favoredMul, BaitShape shape, string color, string accent, string desc)
        {
            var b = ScriptableObject.CreateInstance<BaitData>();
            b.name = id;
            b.id = id;
            b.displayName = name;
            b.price = price;
            b.biteSpeed = biteSpeed;
            b.rareMultiplier = rare;
            b.legendaryMultiplier = legend;
            b.favoredTags = favored;
            b.favoredMultiplier = favoredMul;
            b.shape = shape;
            b.color = Hex.C(color);
            b.accentColor = Hex.C(accent);
            b.description = desc;
            return b;
        }

        static void AddBaits(List<BaitData> list)
        {
            int i = 0;
            BaitData b;
            b = Bait("worm", "지렁이", 0, 1f, 1f, 1f, CatchTags.Fish, 1.3f, BaitShape.Worm, "#E8879B", "#C9637A",
                "흙냄새가 난다. 하와이 흙이다.");
            b.shopOrder = i++; list.Add(b);
            b = Bait("spam_musubi", "스팸 무스비", 150, 0.8f, 1.1f, 1f, CatchTags.Food, 1.8f, BaitShape.SpamMusubi, "#E07A5F", "#1F2D2A",
                "하와이 편의점 국룰. 물고기도 줄 서서 먹는다. 음식류가 잘 낚인다.");
            b.shopOrder = i++; list.Add(b);
            b = Bait("shrimp", "새우", 400, 0.9f, 1.5f, 1.2f, CatchTags.Fish | CatchTags.Sea, 1.4f, BaitShape.Shrimp, "#FF8C61", "#FFD3B6",
                "탱글탱글. 미끼로 쓰기 아깝다는 의견이 지배적이다.");
            b.shopOrder = i++; list.Add(b);
            b = Bait("pineapple_chunk", "파인애플 조각", 800, 0.9f, 1.6f, 1.2f, CatchTags.Tropical, 2.2f, BaitShape.PineappleChunk, "#F9D56E", "#E8A317",
                "열대어는 못 참지. 피자 쪽에서는 경계 중.");
            b.shopOrder = i++; list.Add(b);
            b = Bait("glitter_lure", "반짝이 루어", 1500, 0.75f, 2.2f, 1.8f, CatchTags.Weird | CatchTags.Junk, 1.5f, BaitShape.Lure, "#7DD3FC", "#F472B6",
                "반짝이는 걸 좋아하는 건 까마귀만이 아니다. 이상한 것들이 잘 낚인다.");
            b.shopOrder = i++; list.Add(b);
            b = Bait("golden_bait", "황금 미끼", 5000, 0.7f, 2f, 3f, CatchTags.None, 1f, BaitShape.GoldenWorm, "#FFD700", "#FFF4B0",
                "금이다. 물고기보다 비싸다. 비 오는 밤에 무언가를 부른다는 소문이…");
            b.isGolden = true;
            b.shopOrder = i++; list.Add(b);
        }

        // ------------------------------------------------------------------ 장소

        static LocationData Location(string id, string name, int order, int price, int discoveries, LocationTheme theme,
            string caption, string arrival, string desc)
        {
            var l = ScriptableObject.CreateInstance<LocationData>();
            l.name = id;
            l.id = id;
            l.displayName = name;
            l.order = order;
            l.unlockPrice = price;
            l.requiredDiscoveries = discoveries;
            l.theme = theme;
            l.arrivalCaption = caption;
            l.arrivalLine = arrival;
            l.description = desc;
            l.visualVersion = LocationData.CurrentVisualVersion;
            return l;
        }

        static SkyColors Sky(string top, string mid, string horizon)
        {
            return new SkyColors(Hex.C(top), Hex.C(mid), Hex.C(horizon));
        }

        static WaterColors Water(string surface, string deep, string crest)
        {
            return new WaterColors(Hex.C(surface), Hex.C(deep), Hex.C(crest));
        }

        static void AddLocations(List<LocationData> list)
        {
            LocationData l;

            l = Location("waikiki", "와이키키 해변", 0, 0, 0, LocationTheme.Beach,
                "하와이 · 와이키키 해변", "냥. 모래가 따끈따끈하다냥.",
                "야자수, 서핑보드, 훌라 추는 이웃. 휴가의 시작점.");
            // 사진 1·3: 위는 짙은 파랑, 수평선 쪽은 맑은 하늘색. 바다는 수평선 짙은 파랑 → 가까운 쪽 청록
            l.daySky = Sky("#1F4FC2", "#3A7DE0", "#80BDF2");
            l.sunsetSky = Sky("#4B2C77", "#E0578A", "#FF9F45");
            l.nightSky = Sky("#0B1033", "#1C2457", "#38407A");
            l.dayWater = Water("#2FB6C6", "#0B4C85", "#E8FCFF");
            l.sunsetWater = Water("#C8607E", "#3A2A6A", "#FFD3A5");
            l.nightWater = Water("#1C3A66", "#050D24", "#8FA9D8");
            l.ambientDay = Color.white;
            l.ambientSunset = new Color(1f, 0.84f, 0.78f);
            l.ambientNight = new Color(0.5f, 0.56f, 0.84f);
            l.waveHeight = 1f;
            l.waveSpeed = 1f;
            list.Add(l);

            l = Location("coral_pier", "산호초 부두", 1, 500, 0, LocationTheme.Pier,
                "하와이 · 산호초 앞 나무 부두", "물이 맑다냥. 거북이 지나가면 인사하라냥.",
                "산호초가 훤히 보이는 나무 부두. 열대어와 거북이가 지나다닌다.");
            // 사진 2·4: 뭉게구름 낀 파란 하늘, 산호초가 비치는 청록 바다
            l.daySky = Sky("#3577CC", "#68A8E3", "#B5D6F0");
            l.sunsetSky = Sky("#3F2A6E", "#D94F8A", "#FFA94D");
            l.nightSky = Sky("#091233", "#17255A", "#2F4B85");
            l.dayWater = Water("#36C2C2", "#0E6A86", "#E8FFFF");
            l.sunsetWater = Water("#D0708A", "#40306E", "#FFE0B5");
            l.nightWater = Water("#17406B", "#041027", "#9BB8E0");
            l.ambientDay = Color.white;
            l.ambientSunset = new Color(1f, 0.85f, 0.8f);
            l.ambientNight = new Color(0.5f, 0.58f, 0.86f);
            l.waveHeight = 0.8f;
            l.waveSpeed = 0.9f;
            list.Add(l);

            l = Location("lava_spot", "화산 옆 용암 낚시터", 2, 2000, 0, LocationTheme.Volcano,
                "하와이 · 화산 옆 용암 낚시터 (화상 주의)", "뜨겁다냥! 여기선 생선이 구워져서 나온다냥.",
                "용암에서 낚시를 한다. 잡히는 건 이미 다 익어 있다. 병맛 해금 지역.");
            l.daySky = Sky("#7A3B2E", "#D9774B", "#F7C08A");
            l.sunsetSky = Sky("#3D1A3A", "#B03A48", "#F4845F");
            l.nightSky = Sky("#14070F", "#3A0F1E", "#7A1F1F");
            l.dayWater = Water("#FF8C1A", "#B32400", "#FFE066");
            l.sunsetWater = Water("#FF6B1A", "#9A1B00", "#FFD166");
            l.nightWater = Water("#FF5A00", "#6A0F00", "#FFC14D");
            l.ambientDay = new Color(1f, 0.9f, 0.82f);
            l.ambientSunset = new Color(1f, 0.78f, 0.7f);
            l.ambientNight = new Color(0.78f, 0.55f, 0.55f);
            l.waveHeight = 0.55f;
            l.waveSpeed = 0.45f;
            list.Add(l);

            l = Location("cloud_spot", "하늘 위 구름 낚시터", 3, 6000, 15, LocationTheme.Cloud,
                "하와이 · 하늘 위 구름 낚시터", "높다냥… 아래는 보지 마라냥.",
                "구름 위에서 구름을 낚는다. 최종 해금 지역. 도감 15종 이상 필요.");
            l.daySky = Sky("#7FA7F5", "#C3D9FF", "#FFE9F5");
            l.sunsetSky = Sky("#6A4C93", "#F28AB2", "#FFC09F");
            l.nightSky = Sky("#1A1446", "#3A2D7A", "#6C5BA8");
            l.dayWater = Water("#FFFFFF", "#CFE0FF", "#FFFFFF");
            l.sunsetWater = Water("#FFE3EE", "#E6B8D6", "#FFF5E8");
            l.nightWater = Water("#B8B8E8", "#4A4A8A", "#E8E8FF");
            l.ambientDay = Color.white;
            l.ambientSunset = new Color(1f, 0.88f, 0.9f);
            l.ambientNight = new Color(0.62f, 0.64f, 0.92f);
            l.waveHeight = 1.4f;
            l.waveSpeed = 0.45f;
            list.Add(l);
        }
    }
}
