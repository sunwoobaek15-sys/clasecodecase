using UnityEngine;

namespace OneulDoKkwang
{
    public enum Sfx
    {
        Cast,
        Bite,
        Hook,
        Success,
        Fail,
    }

    /// <summary>
    /// 사운드 슬롯. 클립은 일부러 비워 두었다 — 씬의 Audio 오브젝트 아래 AudioSource 에 클립만 넣으면 바로 재생된다.
    /// (BGM, 던지기, 입질, 챔질, 성공, 실패)
    /// </summary>
    public sealed class AudioManager : MonoBehaviour
    {
        [Header("BGM (loop)")]
        public AudioSource bgm;
        [Header("효과음 - 클립은 비워둠")]
        public AudioSource cast;
        public AudioSource bite;
        public AudioSource hook;
        public AudioSource success;
        public AudioSource fail;

        [Range(0f, 1f)] public float bgmVolume = 0.8f;
        [Range(0f, 1f)] public float sfxVolume = 1f;

        public static AudioManager CreateDefault(Transform parent)
        {
            var go = new GameObject("Audio");
            if (parent != null) go.transform.SetParent(parent, false);
            var am = go.AddComponent<AudioManager>();
            am.EnsureSlots();
            return am;
        }

        /// <summary>비어 있는 슬롯이 있으면 자식 AudioSource 를 만들어 채운다.</summary>
        public void EnsureSlots()
        {
            if (bgm == null) bgm = MakeSource("BGM", true);
            if (cast == null) cast = MakeSource("SFX_Cast (던지기)", false);
            if (bite == null) bite = MakeSource("SFX_Bite (입질)", false);
            if (hook == null) hook = MakeSource("SFX_Hook (챔질)", false);
            if (success == null) success = MakeSource("SFX_Success (성공)", false);
            if (fail == null) fail = MakeSource("SFX_Fail (실패)", false);
        }

        AudioSource MakeSource(string name, bool loop)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var src = go.AddComponent<AudioSource>();
            src.playOnAwake = false;
            src.loop = loop;
            src.spatialBlend = 0f;
            return src;
        }

        public void ApplyVolumes(float bgmVol, float sfxVol)
        {
            bgmVolume = Mathf.Clamp01(bgmVol);
            sfxVolume = Mathf.Clamp01(sfxVol);
            if (bgm != null) bgm.volume = bgmVolume;
        }

        public void StartBgm()
        {
            if (bgm == null || bgm.clip == null) return;
            bgm.loop = true;
            bgm.volume = bgmVolume;
            if (!bgm.isPlaying) bgm.Play();
        }

        AudioSource Slot(Sfx s)
        {
            switch (s)
            {
                case Sfx.Cast: return cast;
                case Sfx.Bite: return bite;
                case Sfx.Hook: return hook;
                case Sfx.Success: return success;
                default: return fail;
            }
        }

        public void Play(Sfx s, float pitch = 1f)
        {
            var src = Slot(s);
            if (src == null || src.clip == null) return;
            src.pitch = pitch;
            src.PlayOneShot(src.clip, sfxVolume);
        }
    }
}
