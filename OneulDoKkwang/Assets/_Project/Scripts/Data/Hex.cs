using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>"#RRGGBB" / "#RRGGBBAA" 문자열을 Color 로. (UnityEngine.ColorUtility 없이 순수 C#)</summary>
    public static class Hex
    {
        public static Color C(string hex)
        {
            return C(hex, 1f);
        }

        public static Color C(string hex, float alpha)
        {
            if (string.IsNullOrEmpty(hex)) return new Color(1f, 0f, 1f, alpha);
            int start = hex[0] == '#' ? 1 : 0;
            int len = hex.Length - start;
            if (len != 6 && len != 8) return new Color(1f, 0f, 1f, alpha);
            float r = Byte(hex, start) / 255f;
            float g = Byte(hex, start + 2) / 255f;
            float b = Byte(hex, start + 4) / 255f;
            float a = len == 8 ? Byte(hex, start + 6) / 255f : alpha;
            return new Color(r, g, b, a);
        }

        static int Byte(string s, int i)
        {
            return Nibble(s[i]) * 16 + Nibble(s[i + 1]);
        }

        static int Nibble(char c)
        {
            if (c >= '0' && c <= '9') return c - '0';
            if (c >= 'a' && c <= 'f') return c - 'a' + 10;
            if (c >= 'A' && c <= 'F') return c - 'A' + 10;
            return 0;
        }

        public static Color WithAlpha(this Color c, float a)
        {
            c.a = a;
            return c;
        }

        /// <summary>밝기 조절 (0 = 검정, 1 = 그대로, 2 = 흰색 쪽).</summary>
        public static Color Shade(this Color c, float k)
        {
            if (k <= 1f) return new Color(c.r * k, c.g * k, c.b * k, c.a);
            float t = Mathf.Clamp01(k - 1f);
            return new Color(c.r + (1f - c.r) * t, c.g + (1f - c.g) * t, c.b + (1f - c.b) * t, c.a);
        }
    }
}
