using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace OneulDoKkwang
{
    /// <summary>
    /// 화면 전체를 덮는 투명 입력 영역 (UI 맨 뒤). 마우스 클릭과 터치 모두 UI 이벤트로 들어온다.
    /// 버튼/패널 위를 누르면 그쪽이 이벤트를 가져가므로 낚시 입력과 겹치지 않는다.
    /// </summary>
    public sealed class FishingInputArea : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        public FishingInput input;
        public event Action Tapped;

        public void OnPointerDown(PointerEventData eventData)
        {
            if (eventData.button != PointerEventData.InputButton.Left) return;
            if (input != null) input.PointerDown();
            if (Tapped != null) Tapped();
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData.button != PointerEventData.InputButton.Left) return;
            if (input != null) input.PointerUp();
        }

        void OnApplicationFocus(bool focus)
        {
            if (!focus && input != null) input.ResetAll();
        }
    }
}
