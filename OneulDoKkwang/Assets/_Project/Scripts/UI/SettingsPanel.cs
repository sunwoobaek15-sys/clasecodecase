using UnityEngine;
using UnityEngine.UI;

namespace OneulDoKkwang
{
    /// <summary>
    /// 설정 + 개발자 도구 (F1 또는 시계 5번 탭).
    /// 개발자 도구는 "25종 전부 잡을 수 있는지" 빠르게 확인하려고 넣어 둔 것.
    /// </summary>
    public sealed class SettingsPanel : ModalPanel
    {
        Text _forcedLabel;
        Text _resetLabel;
        Text _info;
        float _resetArmedUntil;

        public static SettingsPanel Create(RectTransform parent)
        {
            var p = CreateOn<SettingsPanel>(parent, "Settings (설정)");
            p.Build();
            return p;
        }

        void Build()
        {
            BuildFrame("설정", new Vector2(1180f, 860f));
            var gm = Game.State;

            Label("BGM 볼륨", new Vector2(70f, -120f));
            var bgm = UIBuilder.Slider(Window, "BgmSlider", gm.Save.bgmVolume, v =>
            {
                gm.Save.bgmVolume = v;
                if (Game.Audio != null) Game.Audio.ApplyVolumes(gm.Save.bgmVolume, gm.Save.sfxVolume);
            });
            UIBuilder.Place((RectTransform)bgm.transform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(270f, -122f), new Vector2(360f, 44f));
            Label("효과음 볼륨", new Vector2(70f, -186f));
            var sfx = UIBuilder.Slider(Window, "SfxSlider", gm.Save.sfxVolume, v =>
            {
                gm.Save.sfxVolume = v;
                if (Game.Audio != null) Game.Audio.ApplyVolumes(gm.Save.bgmVolume, gm.Save.sfxVolume);
            });
            UIBuilder.Place((RectTransform)sfx.transform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(270f, -188f), new Vector2(360f, 44f));

            Btn("인트로 다시 보기", new Vector2(680f, -116f), UIColors.Teal, () => { Close(); if (Game.Director != null) Game.Director.PlayIntro(true); });
            var reset = Btn("저장 초기화", new Vector2(680f, -196f), UIColors.Coral, OnReset);
            _resetLabel = UIBuilder.ButtonLabel(reset);

            var line = UIBuilder.Image(Window, "Line", null, UIColors.Ink.WithAlpha(0.2f));
            UIBuilder.Place(line.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -262f), new Vector2(1060f, 3f));
            var dev = UIBuilder.Text(Window, "DevTitle", "개발자 도구 (테스트용)", 30, UIColors.SubText, TextAnchor.MiddleLeft, FontStyle.Bold);
            UIBuilder.Place(dev.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(70f, -290f), new Vector2(600f, 44f));

            Btn("+1,000원", new Vector2(70f, -350f), UIColors.Yellow, () => gm.AddMoney(1000, false), UIColors.Text);
            Btn("+10,000원", new Vector2(420f, -350f), UIColors.Yellow, () => gm.AddMoney(10000, false), UIColors.Text);
            Btn("모두 해금", new Vector2(770f, -350f), UIColors.Purple, () => { gm.DebugUnlockAll(); Toast("낚싯대·미끼·장소 전부 해금"); });
            Btn("시간 +1시간", new Vector2(70f, -450f), UIColors.Teal, () => AdvanceHours(1));
            Btn("시간 +6시간", new Vector2(420f, -450f), UIColors.Teal, () => AdvanceHours(6));
            Btn("날씨 전환", new Vector2(770f, -450f), UIColors.Teal, () => { if (Game.Weather != null) { Game.Weather.Toggle(); Toast("날씨: " + Game.Weather.Current.Korean()); } });
            var forced = Btn("다음 입질 지정", new Vector2(70f, -550f), UIColors.Coral, OnForceNext);
            _forcedLabel = UIBuilder.ButtonLabel(forced);
            ((RectTransform)forced.transform).sizeDelta = new Vector2(1030f, 82f);

            _info = UIBuilder.Text(Window, "Info", "", 24, UIColors.SubText, TextAnchor.UpperLeft);
            UIBuilder.Place(_info.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(70f, -650f), new Vector2(1040f, 170f));
        }

        void Label(string text, Vector2 pos)
        {
            var t = UIBuilder.Text(Window, "Label_" + text, text, 30, UIColors.Text, TextAnchor.MiddleLeft, FontStyle.Bold);
            UIBuilder.Place(t.rectTransform, new Vector2(0f, 1f), new Vector2(0f, 1f), pos, new Vector2(200f, 44f));
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
        }

        Button Btn(string label, Vector2 pos, Color color, System.Action onClick, Color? textColor = null)
        {
            var b = UIBuilder.Button(Window, "Btn_" + label, label, color, textColor ?? Color.white, new Vector2(330f, 82f), onClick, 30);
            UIBuilder.Place((RectTransform)b.transform, new Vector2(0f, 1f), new Vector2(0f, 1f), pos, new Vector2(330f, 82f));
            return b;
        }

        void Toast(string msg)
        {
            if (Game.UI != null) Game.UI.Announcer.Toast(msg);
            RefreshInfo();
        }

        void AdvanceHours(float h)
        {
            if (Game.Clock != null) Game.Clock.Advance(h * 60.0);
            Toast("지금: " + (Game.Clock != null ? Game.Clock.Formatted : ""));
        }

        void OnForceNext()
        {
            var gm = Game.State;
            gm.DebugForcedCatch = gm.NextUndiscovered(gm.DebugForcedCatch);
            if (_forcedLabel != null) _forcedLabel.text = "다음 입질: " + (gm.DebugForcedCatch != null ? gm.DebugForcedCatch.displayName : "-");
            RefreshInfo();
        }

        void OnReset()
        {
            if (Time.unscaledTime > _resetArmedUntil)
            {
                _resetArmedUntil = Time.unscaledTime + 3f;
                if (_resetLabel != null) _resetLabel.text = "한 번 더 누르면 삭제";
                return;
            }
            Close();
            if (Game.Director != null) Game.Director.ResetSaveAndRestart();
        }

        protected override void OnOpened()
        {
            _resetArmedUntil = 0f;
            if (_resetLabel != null) _resetLabel.text = "저장 초기화";
            var gm = Game.State;
            if (_forcedLabel != null) _forcedLabel.text = gm.DebugForcedCatch != null ? "다음 입질: " + gm.DebugForcedCatch.displayName : "다음 입질 지정 (못 잡은 것 순서대로)";
            RefreshInfo();
        }

        void RefreshInfo()
        {
            var gm = Game.State;
            if (gm == null || _info == null) return;
            var ctx = gm.BuildContext(0.6f, false);
            var dist = CatchTable.Distribution(gm.Catches, ctx);
            var sb = new System.Text.StringBuilder();
            sb.Append("지금 조건: ").Append(gm.Location != null ? gm.Location.displayName : "-").Append(" · ")
              .Append(ctx.time.Korean()).Append(" · ").Append(ctx.weather.Korean()).Append(" · ").Append(ctx.weekday.Korean()).Append("요일 · 미끼 ")
              .Append(gm.Bait != null ? gm.Bait.displayName : "-").Append('\n');
            int shown = 0;
            foreach (var kv in dist)
            {
                if (shown++ >= 8) { sb.Append(" …"); break; }
                sb.Append(gm.IsDiscovered(kv.Key) ? kv.Key.displayName : kv.Key.hiddenName).Append(' ').Append((kv.Value * 100f).ToString("0.0")).Append("%   ");
            }
            sb.Append("\n세이브: ").Append(SaveManager.SavePath);
            _info.text = sb.ToString();
        }
    }
}
