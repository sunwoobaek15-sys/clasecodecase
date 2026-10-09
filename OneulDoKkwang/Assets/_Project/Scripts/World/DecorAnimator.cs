using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>
    /// 배경 장식: 패럴랙스(카메라를 얼마나 따라가는지) + 간단한 애니메이션(흔들림/둥실/흘러가기).
    /// 카메라가 움직인 뒤 위치를 정하도록 실행 순서를 뒤로 둔다.
    /// </summary>
    [DefaultExecutionOrder(100)]
    public sealed class DecorAnimator : MonoBehaviour
    {
        public Vector3 basePosition;
        public float baseRotation;
        [Range(0f, 1f)] public float parallax;
        public DecorAnim anim;
        public float amount;
        public float speed = 1f;
        public float phase;

        float _drift;

        public void Setup(DecorItem item)
        {
            basePosition = new Vector3(item.x, item.y, 0f);
            baseRotation = item.rotation;
            parallax = item.parallax;
            anim = item.anim;
            amount = item.animAmount;
            speed = item.animSpeed;
            phase = item.phase;
            Apply();
        }

        void LateUpdate()
        {
            Apply();
        }

        void Apply()
        {
            float t = Time.time * speed + phase;
            float camX = CameraRig.X;
            float x = basePosition.x + camX * parallax;
            float y = basePosition.y;
            float rot = baseRotation;
            switch (anim)
            {
                case DecorAnim.Sway:
                    rot += Mathf.Sin(t) * amount;
                    break;
                case DecorAnim.Bob:
                    y += Mathf.Sin(t) * amount;
                    break;
                case DecorAnim.Hula:
                    rot += Mathf.Sin(t * 2f) * amount;
                    y += Mathf.Abs(Mathf.Sin(t * 2f)) * amount * 0.01f;
                    break;
                case DecorAnim.Drift:
                    _drift += speed * Time.deltaTime;
                    x += _drift;
                    float rel = x - camX;
                    if (rel > 16f) _drift -= 32f;
                    else if (rel < -16f) _drift += 32f;
                    x = basePosition.x + camX * parallax + _drift;
                    break;
            }
            transform.position = new Vector3(x, y, 0f);
            transform.rotation = Quaternion.Euler(0f, 0f, rot);
        }
    }
}
