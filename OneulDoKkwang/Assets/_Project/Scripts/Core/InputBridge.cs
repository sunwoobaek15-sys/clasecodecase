using UnityEngine;
using UnityEngine.EventSystems;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
#endif

namespace OneulDoKkwang
{
    /// <summary>
    /// 키보드 입력과 UI 입력 모듈을 New Input System / 구 Input Manager 어느 쪽이든 동작하게 감싼다.
    /// 마우스·터치는 UI 이벤트(FishingInputArea)로 받기 때문에 둘 다 자동 지원된다.
    /// </summary>
    public static class InputBridge
    {
        public enum KeyId { Action, Cancel, Debug, Encyclopedia, Shop, Map }

#if ENABLE_INPUT_SYSTEM
        static Key ToKey(KeyId k)
        {
            switch (k)
            {
                case KeyId.Action: return Key.Space;
                case KeyId.Cancel: return Key.Escape;
                case KeyId.Debug: return Key.F1;
                case KeyId.Encyclopedia: return Key.E;
                case KeyId.Shop: return Key.Q;
                default: return Key.M;
            }
        }

        public static bool Down(KeyId k)
        {
            var kb = Keyboard.current;
            if (kb == null) return false;
            var c = kb[ToKey(k)];
            return c != null && c.wasPressedThisFrame;
        }

        public static bool Up(KeyId k)
        {
            var kb = Keyboard.current;
            if (kb == null) return false;
            var c = kb[ToKey(k)];
            return c != null && c.wasReleasedThisFrame;
        }

        public static bool Held(KeyId k)
        {
            var kb = Keyboard.current;
            if (kb == null) return false;
            var c = kb[ToKey(k)];
            return c != null && c.isPressed;
        }
#elif ENABLE_LEGACY_INPUT_MANAGER
        static KeyCode ToKey(KeyId k)
        {
            switch (k)
            {
                case KeyId.Action: return KeyCode.Space;
                case KeyId.Cancel: return KeyCode.Escape;
                case KeyId.Debug: return KeyCode.F1;
                case KeyId.Encyclopedia: return KeyCode.E;
                case KeyId.Shop: return KeyCode.Q;
                default: return KeyCode.M;
            }
        }

        public static bool Down(KeyId k) { return Input.GetKeyDown(ToKey(k)); }
        public static bool Up(KeyId k) { return Input.GetKeyUp(ToKey(k)); }
        public static bool Held(KeyId k) { return Input.GetKey(ToKey(k)); }
#else
        public static bool Down(KeyId k) { return false; }
        public static bool Up(KeyId k) { return false; }
        public static bool Held(KeyId k) { return false; }
#endif

        /// <summary>씬에 EventSystem 이 없으면 만들고, 현재 입력 설정에 맞는 UI 입력 모듈을 붙인다.</summary>
        public static EventSystem EnsureEventSystem()
        {
            var es = EventSystem.current;
            if (es == null) es = Object.FindAnyObjectByType<EventSystem>();
            if (es == null)
            {
                var go = new GameObject("EventSystem");
                es = go.AddComponent<EventSystem>();
            }
#if ENABLE_INPUT_SYSTEM
            var legacy = es.GetComponent<StandaloneInputModule>();
            if (legacy != null)
            {
                legacy.enabled = false; // Destroy 는 프레임 끝에 일어나므로 먼저 꺼서 이번 프레임에 레거시 Input 을 읽지 않게
                Object.Destroy(legacy);
            }
            var module = es.GetComponent<InputSystemUIInputModule>();
            if (module == null) module = es.gameObject.AddComponent<InputSystemUIInputModule>();
            if (module.actionsAsset == null) module.AssignDefaultActions();
#else
            if (es.GetComponent<BaseInputModule>() == null) es.gameObject.AddComponent<StandaloneInputModule>();
#endif
            return es;
        }
    }
}
