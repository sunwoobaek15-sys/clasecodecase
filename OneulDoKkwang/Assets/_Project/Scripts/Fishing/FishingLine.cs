using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 낚싯줄 (LineRenderer): 초릿대 끝 → 찌 (처짐 표현), 찌 → 물속 바늘. 릴 감는 동안 바늘에 걸린 실루엣이 퍼덕인다.
    /// </summary>
    [DefaultExecutionOrder(70)]
    public sealed class FishingLine : MonoBehaviour
    {
        const int Points = 18;

        LineRenderer _main;
        LineRenderer _under;
        SpriteRenderer _hook;
        SpriteRenderer _hooked;
        readonly Vector3[] _pts = new Vector3[Points];

        public Bobber bobber;
        /// <summary>0 = 팽팽, 1 = 축 처짐.</summary>
        public float slack = 0.4f;
        public bool showUnderwater;
        public bool showHooked;

        float _slackSmooth = 0.4f;

        public static FishingLine Create(Transform parent, Bobber bobber)
        {
            var go = new GameObject("FishingLine (낚싯줄)");
            go.transform.SetParent(parent, false);
            var fl = go.AddComponent<FishingLine>();
            fl.bobber = bobber;
            fl._main = MakeLine(go.transform, "Line", Sorting.Line, 0.018f, new Color(1f, 1f, 1f, 0.85f));
            fl._main.positionCount = Points;
            fl._under = MakeLine(go.transform, "UnderwaterLine", Sorting.HookLine, 0.014f, new Color(1f, 1f, 1f, 0.5f));
            fl._under.positionCount = 2;
            fl._hook = SpriteFactory.Renderer(go.transform, "Hook", SpriteFactory.Get(SpriteKeys.Hook), Sorting.HookLine);
            fl._hooked = SpriteFactory.Renderer(go.transform, "Hooked", null, Sorting.Hooked, new Color(0.08f, 0.1f, 0.16f, 0.75f));
            fl._hooked.enabled = false;
            return fl;
        }

        static LineRenderer MakeLine(Transform parent, string name, int order, float width, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var lr = go.AddComponent<LineRenderer>();
            lr.sharedMaterial = SpriteFactory.SpriteMaterial;
            lr.useWorldSpace = true;
            lr.widthMultiplier = width;
            lr.numCapVertices = 2;
            lr.startColor = color;
            lr.endColor = color;
            lr.sortingOrder = order;
            lr.textureMode = LineTextureMode.Stretch;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
            return lr;
        }

        public void SetHookedSprite(Sprite s)
        {
            _hooked.sprite = s;
        }

        void LateUpdate()
        {
            if (bobber == null || Game.Player == null) return;
            Vector3 a = Game.Player.RodTip;
            Vector3 b = bobber.Position + new Vector3(0f, 0.27f, 0f);
            bool hanging = bobber.Current == Bobber.Mode.Hanging;
            float targetSlack = hanging ? 0f : slack;
            _slackSmooth = Mathf.Lerp(_slackSmooth, targetSlack, 1f - Mathf.Exp(-8f * Time.unscaledDeltaTime));
            float dist = Vector3.Distance(a, b);
            float sag = _slackSmooth * Mathf.Min(1.6f, dist * 0.12f);
            for (int i = 0; i < Points; i++)
            {
                float t = i / (float)(Points - 1);
                var p = Vector3.Lerp(a, b, t);
                p.y -= sag * 4f * t * (1f - t);
                _pts[i] = p;
            }
            _main.SetPositions(_pts);

            bool under = showUnderwater && (bobber.Current == Bobber.Mode.Floating || bobber.Current == Bobber.Mode.Reeling);
            _under.enabled = under;
            _hook.enabled = under;
            _hooked.enabled = under && showHooked && _hooked.sprite != null;
            if (under)
            {
                float t = Time.time;
                var top = bobber.Position + new Vector3(0f, -0.2f, 0f);
                float depth = bobber.Current == Bobber.Mode.Reeling ? 1.2f : 1.0f;
                float swayX = Mathf.Sin(t * 1.3f) * 0.08f;
                if (bobber.Current == Bobber.Mode.Reeling) swayX += (Mathf.PerlinNoise(t * 5f, 2f) - 0.5f) * 0.6f;
                var hookPos = top + new Vector3(swayX, -depth, 0f);
                _under.SetPosition(0, top);
                _under.SetPosition(1, hookPos);
                _hook.transform.position = hookPos;
                if (_hooked.enabled)
                {
                    _hooked.transform.position = hookPos + new Vector3(0.05f, -0.25f, 0f);
                    float wig = Mathf.Sin(t * 18f) * 18f;
                    _hooked.transform.rotation = Quaternion.Euler(0f, 0f, -70f + wig);
                    _hooked.transform.localScale = new Vector3(0.55f, 0.55f, 1f);
                }
            }
        }
    }
}
