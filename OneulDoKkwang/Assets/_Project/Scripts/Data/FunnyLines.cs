using System.Collections.Generic;

namespace OneulDoKkwang
{
    /// <summary>대사 종류.</summary>
    public enum LineType
    {
        MissLate,
        EarlyHook,
        Escape,
        CatConsole,
        CatCommon,
        CatJunk,
        CatFood,
        CatRare,
        CatLegend,
        CatMystery,
        CatRelease,
        CatBigBite,
        CatIdle,
        CatDay,
        CatSunset,
        CatNight,
        CatRain,
        CatRainStop,
        CatMonday,
        CatSteal,
        CatStealTip,
        CatSleepy,
        CatPurchase,
        CatUnlock,
        CatStreak,
        CatNew,
        CatRecord,
        CatGreeting,
        PlayerWake,
        PlayerPerfectCast,
        PlayerHook,
        PlayerBigHook,
        PlayerTinyCatch,
        ResultButton,
        ResultFlavor,
    }

    /// <summary>
    /// 병맛 대사 모음. 종류별로 ShuffleBag 에 넣어 "골고루" 나오게 한다.
    /// 대사를 추가하고 싶으면 아래 배열에 한 줄 추가하면 끝.
    /// </summary>
    public static class FunnyLines
    {
        static readonly Dictionary<LineType, string[]> Table = new Dictionary<LineType, string[]>
        {
            [LineType.MissLate] = new[]
            {
                "물고기가 읽씹했습니다.",
                "입질만 하고 튀었다. 전 애인 같은 녀석.",
                "미끼만 털렸다. 물고기들 오늘 회식함.",
                "물고기: \"아 잠깐만요, 화장실 좀…\"",
                "0.6초는 생각보다 짧았다.",
                "찌가 가라앉았다가… 다시 떠올랐다. 아무 일 없었다는 듯이.",
                "물고기가 '좋아요'만 누르고 갔다.",
                "반응 속도: 거북이 이하. 거북이가 화낼 수도 있음.",
                "방금 그건 입질이었다. 지금은 추억이다.",
                "물고기가 미끼 사진만 찍고 갔다. 인스타 감성.",
                "물고기가 \"나중에 연락할게\"라고 했다. 연락은 오지 않았다.",
                "놓쳤다. 하지만 마음만은 잡았다. (아님)",
            },
            [LineType.EarlyHook] = new[]
            {
                "너무 일찍 챔질했다. 물고기가 비웃고 갔다.",
                "그건 파도였다.",
                "아무것도 안 물었는데 혼자 신났다.",
                "성급한 챔질에 미끼가 하늘을 날았다.",
                "물고기들 사이에 '저 사람 또 저래' 소문이 났다.",
                "기다림의 미학을 배울 시간이다.",
                "허공을 낚았다. 공기 맛은 신선했다.",
            },
            [LineType.Escape] = new[]
            {
                "줄이 끊겼다… 는 핑계고 그냥 놓쳤다.",
                "물고기가 '읽음' 표시만 남기고 떠났다.",
                "물고기가 도망치면서 리뷰 별점 1개를 남겼다.",
                "물고기 승. 물고기 단톡방이 축제 분위기다.",
                "물고기: \"수고하셨습니다~\"",
                "줄다리기 결과: 물고기 1승.",
                "손맛은 봤다. 손만 맛봤다.",
                "놓친 물고기는 원래 다 크다. 아마 2미터였을 것이다.",
                "물고기 탈출 성공. 영화화 결정.",
                "릴이 \"나 오늘 그만할래\"라고 했다.",
                "물고기 퇴근 완료.",
                "물고기가 손을 흔들며 사라졌다. 손이 있었나?",
            },
            [LineType.CatConsole] = new[]
            {
                "냥… 다음엔 될 거다냥.",
                "괜찮다냥. 나도 어제 쥐 놓쳤다냥.",
                "물고기도 사정이 있었을 거다냥.",
                "오늘도 꽝이다냥. 제목 그대로다냥.",
                "울지 마라냥. 츄르 반 줄게냥. (안 줌)",
                "인생은 원래 꽝이 많다냥.",
                "방금 건 연습이었다고 치자냥.",
                "손이 미끄러웠던 거다냥. 그런 거다냥.",
                "다음 물고기는 더 클 거다냥. 아마도냥.",
                "한 번만 더 해보자냥. 딱 한 번만냥.",
                "기운 내라냥. 여기 하와이다냥.",
                "꽝도 추억이다냥.",
            },
            [LineType.CatCommon] = new[]
            {
                "오, 제법이다냥.",
                "그거 나 줄 거지냥?",
                "냄새 좋다냥…",
                "합격이다냥. 오늘 저녁은 그걸로 하자냥.",
                "잘했다냥. 칭찬 스티커 1장이다냥.",
                "흠, 평범하다냥. 평범한 게 최고다냥.",
                "냥! 손맛 좋았냥?",
                "양동이에 넣어두라냥. 나중에 검수하겠다냥.",
            },
            [LineType.CatJunk] = new[]
            {
                "그걸 왜 낚냥…",
                "바다 청소 고맙다냥. 근데 먹을 순 없다냥.",
                "냥… 이건 분리수거냥?",
                "쓰레기도 낚으면 경험치다냥.",
                "그건 내 간식 아니다냥.",
                "바다가 좀 깨끗해졌다냥. 착하다냥.",
            },
            [LineType.CatFood] = new[]
            {
                "잘 익었다냥! 한 입만냥!",
                "이건 내 몫이다냥.",
                "요리 안 해도 되는 바다, 최고다냥.",
                "냄새가… 냄새가 미쳤다냥…",
            },
            [LineType.CatRare] = new[]
            {
                "우와, 희귀하다냥!",
                "그거 비싸게 팔린다냥. 츄르 사줘냥.",
                "오늘 운 좋다냥. 복권 사라냥.",
                "냥냥! 사진 찍자냥!",
                "도감이 두꺼워진다냥.",
            },
            [LineType.CatLegend] = new[]
            {
                "냥?!?! 저게 뭐냥!!",
                "전설이다냥…! 꼬리가 떨린다냥!",
                "평생 자랑할 거리다냥. 아니, 내 자랑이다냥.",
                "냥냥냥냥!! 기절할 것 같다냥!",
            },
            [LineType.CatMystery] = new[]
            {
                "…꽝을 낚았다냥? 이게 무슨 의미냥?",
                "제목 회수냥. 소름 돋았다냥.",
            },
            [LineType.CatRelease] = new[]
            {
                "착하다냥. 오늘의 선행 +1이다냥.",
                "잘 가라 거북아냥. 또 보자냥.",
                "거북이가 고맙다고 했다냥. (내가 통역함)",
            },
            [LineType.CatBigBite] = new[]
            {
                "냥?! 뭔가 엄청 큰 게 걸렸다냥!",
                "줄이 운다냥! 버텨라냥!",
                "꼬리털이 쭈뼛 선다냥!",
            },
            [LineType.CatIdle] = new[]
            {
                "하와이 바람 좋다냥.",
                "알로하냥.",
                "저기 서핑하던 사람 넘어졌다냥.",
                "츄르는 하와이에도 파냥?",
                "화관 예쁘지냥? 칭찬해라냥.",
                "느긋하게 하자냥. 휴가니까냥.",
                "파도 소리 들으니 졸리다냥.",
                "선크림 발랐냥? 나는 털이 있다냥.",
                "오늘의 목표: 꽝 아닌 것 하나냥.",
                "물고기들이 우리 얘기하는 것 같다냥.",
                "멀리 던질수록 이상한 게 잡힌다는 소문이 있다냥.",
                "도감 다 채우면 뭐 주냥? 아무것도 안 주냥? …냥.",
                "황금 미끼는 비 오는 밤에 쓰라는 소문이 있다냥.",
                "월요일엔 출근하기 싫은 붕어가 안 나온다냥. 걔도 월요병이다냥.",
                "노을 지면 다른 애들이 나온다냥.",
                "바다의 왕은 아주 멀리 던져야 만날 수 있다냥.",
            },
            [LineType.CatDay] = new[]
            {
                "아침이다냥. 물고기들도 출근했다냥.",
                "해 떴다냥. 다시 시작이다냥.",
            },
            [LineType.CatSunset] = new[]
            {
                "노을이다냥… 주황이 분홍 되고 보라 된다냥.",
                "이 맛에 하와이 온다냥.",
                "노을 낚시 감성, 미쳤다냥.",
            },
            [LineType.CatNight] = new[]
            {
                "밤바다는 좀 무섭다냥.",
                "별이 많다냥. 소원 빌어라냥. 대어 주세요냥.",
                "밤엔 이상한 게 나온다냥.",
            },
            [LineType.CatRain] = new[]
            {
                "비 온다냥… 털 젖는다냥.",
                "비 오는 날엔 특별한 녀석들이 나온다냥.",
                "우산 없냥? 나도 없다냥.",
            },
            [LineType.CatRainStop] = new[]
            {
                "비 그쳤다냥. 털 말려야겠다냥.",
                "비 그쳤다냥. 무지개 찾아보자냥.",
            },
            [LineType.CatMonday] = new[]
            {
                "월요일이다냥… 출근 붕어는 오늘 안 나온다냥.",
                "월요일엔 나도 일하기 싫다냥.",
            },
            [LineType.CatSteal] = new[]
            {
                "냠. (훔친 거 아님. 시식임)",
                "냠냠… 증거 인멸 완료냥.",
                "생선이 사라졌다냥. 미스터리다냥.",
                "검수 결과: 맛있음냥.",
            },
            [LineType.CatStealTip] = new[]
            {
                "미안해서 조개 하나 두고 간다냥. (+{0}원)",
                "시식비다냥. 받아라냥. (+{0}원)",
            },
            [LineType.CatSleepy] = new[]
            {
                "zZ… 나도 잔다냥…",
                "졸지 마라냥… 나도 졸리다냥…",
            },
            [LineType.CatPurchase] = new[]
            {
                "돈 쓰는 소리 좋다냥.",
                "지름신 강림이다냥.",
                "그거 사면 잘 잡히냥? 기분은 잡힌다냥.",
                "장비빨도 실력이다냥.",
            },
            [LineType.CatUnlock] = new[]
            {
                "새로운 곳이다냥! 가보자냥!",
                "지도에 새 장소가 생겼다냥!",
            },
            [LineType.CatStreak] = new[]
            {
                "{0}연속이다냥! 오늘 날이다냥!",
                "{0}마리 연속냥! 손이 뜨겁다냥!",
            },
            [LineType.CatNew] = new[]
            {
                "새로운 녀석이다냥! 도감 등록이다냥!",
                "처음 보는 애다냥. 도감에 적어둔다냥.",
            },
            [LineType.CatRecord] = new[]
            {
                "최고 기록이다냥! 자로 재봤다냥!",
                "이번 게 제일 크다냥. 자랑해라냥.",
            },
            [LineType.CatGreeting] = new[]
            {
                "또 왔냥? 오늘도 꽝 각이다냥.",
                "어서 와라냥. 물고기들이 기다렸다냥.",
                "휴가 연장이냥? 부럽다냥.",
            },
            [LineType.PlayerWake] = new[]
            {
                "헉! 안 잤어!",
                "잠깐 눈만 감고 있었어.",
                "어… 내 생선 어디 갔지?",
                "꿈에서 대어를 잡았는데…",
            },
            [LineType.PlayerPerfectCast] = new[]
            {
                "퍼펙트!",
                "간다아아!",
                "이게 프로의 캐스팅이다!",
            },
            [LineType.PlayerHook] = new[]
            {
                "왔다!",
                "걸렸다!",
                "느낌 왔어!",
            },
            [LineType.PlayerBigHook] = new[]
            {
                "이, 이건…!",
                "팔 빠질 것 같아!",
            },
            [LineType.PlayerTinyCatch] = new[]
            {
                "귀엽네.",
                "작지만 소중해.",
            },
            [LineType.ResultButton] = new[]
            {
                "한 번 더!",
                "오히려 좋아",
                "다음 캐스팅",
                "좋았어!",
                "하나만 더…",
                "계속 간다!",
            },
            [LineType.ResultFlavor] = new[]
            {
                "오늘의 운세: 꽝은 아님",
                "고양이가 탐내고 있다",
                "양동이 행",
                "SNS에 올릴까?",
                "엄마한테 자랑해야지",
                "휴가 보람 +1",
                "이 맛에 낚시한다",
                "하와이까지 와서 이걸…",
            },
        };

        static Dictionary<LineType, ShuffleBag<string>> _bags;
        static System.Random _rng = new System.Random();

        /// <summary>테스트나 리플레이에서 시드를 고정하고 싶을 때.</summary>
        public static void Reset(int seed)
        {
            _rng = new System.Random(seed);
            _bags = null;
        }

        public static string Get(LineType type)
        {
            if (_bags == null) _bags = new Dictionary<LineType, ShuffleBag<string>>();
            ShuffleBag<string> bag;
            if (!_bags.TryGetValue(type, out bag))
            {
                string[] lines;
                if (!Table.TryGetValue(type, out lines) || lines.Length == 0) return "냥?";
                bag = new ShuffleBag<string>(lines, _rng);
                _bags[type] = bag;
            }
            return bag.Next();
        }

        public static string Get(LineType type, object arg)
        {
            return string.Format(Get(type), arg);
        }

        public static int CountOf(LineType type)
        {
            string[] lines;
            return Table.TryGetValue(type, out lines) ? lines.Length : 0;
        }

        public static IEnumerable<string> All(LineType type)
        {
            string[] lines;
            return Table.TryGetValue(type, out lines) ? lines : new string[0];
        }
    }
}
