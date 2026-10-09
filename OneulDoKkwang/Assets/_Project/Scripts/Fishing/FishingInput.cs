namespace OneulDoKkwang
{
    /// <summary>
    /// 낚시 입력 상태. 마우스/터치는 화면 전체를 덮는 FishingInputArea(UI 이벤트)가, 키보드는 스페이스바가 넣어준다.
    /// UI 버튼 위를 누르면 이벤트가 버튼에 먹히므로 낚시가 시작되지 않는다.
    /// </summary>
    public sealed class FishingInput
    {
        bool _pointerHeld;
        bool _pressQueued;
        bool _releaseQueued;

        public void PointerDown()
        {
            _pointerHeld = true;
            _pressQueued = true;
        }

        public void PointerUp()
        {
            if (_pointerHeld) _releaseQueued = true;
            _pointerHeld = false;
        }

        public bool Held => _pointerHeld || InputBridge.Held(InputBridge.KeyId.Action);

        /// <summary>이번 프레임에 눌렀는가 (한 번 읽으면 지워짐).</summary>
        public bool ConsumePress()
        {
            bool p = _pressQueued || InputBridge.Down(InputBridge.KeyId.Action);
            _pressQueued = false;
            return p;
        }

        public bool ConsumeRelease()
        {
            bool r = _releaseQueued || InputBridge.Up(InputBridge.KeyId.Action);
            _releaseQueued = false;
            return r;
        }

        /// <summary>이전에 쌓인 '뗌' 이벤트를 버린다 (새로 누르기 시작할 때).</summary>
        public void DropStaleRelease()
        {
            _releaseQueued = false;
        }

        public void Clear()
        {
            _pressQueued = false;
            _releaseQueued = false;
        }

        public void ResetAll()
        {
            _pointerHeld = false;
            Clear();
        }
    }
}
