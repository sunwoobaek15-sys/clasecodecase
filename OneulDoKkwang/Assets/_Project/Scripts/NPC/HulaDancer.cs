using UnityEngine;

namespace OneulDoKkwang
{
    /// <summary>해변 배경의 훌라 추는 이웃. 엉덩이 흔들기 + 가끔 하트.</summary>
    public sealed class HulaDancer : MonoBehaviour
    {
        public SpriteRenderer sprite;
        float _phase;
        float _heartTimer;

        public void Init()
        {
            sprite = SpriteFactory.Renderer(transform, "Hula", SpriteFactory.Get(SpriteKeys.HulaDancer), Sorting.Npc);
            Tintable.Attach(sprite, Tintable.Mode.Near);
            sprite.transform.localScale = new Vector3(0.8f, 0.8f, 1f);
            _phase = Random.Range(0f, 6f);
            _heartTimer = Random.Range(6f, 12f);
        }

        void Update()
        {
            float t = Time.time * 2.6f + _phase;
            sprite.transform.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(t) * 6f);
            sprite.transform.localPosition = new Vector3(Mathf.Sin(t) * 0.03f, Mathf.Abs(Mathf.Cos(t)) * 0.03f, 0f);
            _heartTimer -= Time.deltaTime;
            if (_heartTimer <= 0f && Game.Fx != null)
            {
                _heartTimer = Random.Range(8f, 15f);
                Game.Fx.Hearts(transform.position + new Vector3(0f, 1.6f, 0f), 1);
            }
        }
    }
}
