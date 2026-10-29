/* 메뉴용 SVG 그림 (외부 이미지 없이 직접 그린 그래픽) */
(function (KK) {
  'use strict';

  const O = '#3b2620'; // 공통 외곽선 색

  const kiwiBird = `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="58" cy="92" rx="38" ry="5" fill="rgba(0,0,0,.15)"/>
  <path d="M44 74l-4 16M40 90h-8M40 90l-3 4M64 76l2 14M66 90h8M66 90l3 4" stroke="#c98a3c" stroke-width="4" stroke-linecap="round" fill="none"/>
  <ellipse cx="54" cy="56" rx="36" ry="27" fill="#8a5a33" stroke="${O}" stroke-width="3.5"/>
  <path d="M30 52q8-6 14 0M42 64q8-6 14 0M56 48q8-6 14 0M64 62q7-5 12 0" stroke="#6b4325" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <circle cx="84" cy="44" r="15" fill="#8a5a33" stroke="${O}" stroke-width="3.5"/>
  <path d="M97 48 Q114 60 117 78" stroke="#e9cf96" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M97 48 Q114 60 117 78" stroke="${O}" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".35"/>
  <circle cx="88" cy="41" r="3.2" fill="${O}"/><circle cx="89" cy="40" r="1" fill="#fff"/>
  <ellipse cx="80" cy="50" rx="4" ry="2.4" fill="#ff8fa3" opacity=".7"/>
</svg>`;

  const kimchiJar = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="50" cy="94" rx="32" ry="4.5" fill="rgba(0,0,0,.15)"/>
  <path d="M30 92 C10 70 14 36 32 30 L68 30 C86 36 90 70 70 92Z" fill="#6b3a20" stroke="${O}" stroke-width="3.5"/>
  <path d="M26 56 q8 -6 16 0 t16 0 t16 0 t16 0" stroke="#a8683f" stroke-width="3" fill="none"/>
  <path d="M36 40 q-10 18 -4 40" stroke="#fff" stroke-opacity=".3" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M30 32 Q34 8 50 16 Q56 4 66 14 Q78 12 70 32Z" fill="#e8473b" stroke="${O}" stroke-width="3"/>
  <path d="M42 30 Q46 18 52 22 M58 30 Q60 20 66 22" stroke="#ffb199" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="50" cy="31" rx="22" ry="5" fill="#4a2414" stroke="${O}" stroke-width="3"/>
</svg>`;

  const cards = {
    'kimchi-run': `
<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kimchi Run">
  <defs>
    <linearGradient id="kr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd98f"/><stop offset="1" stop-color="#ff9a6b"/></linearGradient>
    <linearGradient id="kr-jar" x1="0" x2="1"><stop offset="0" stop-color="#84502e"/><stop offset=".5" stop-color="#5d321b"/><stop offset="1" stop-color="#3d1f0f"/></linearGradient>
  </defs>
  <rect width="320" height="200" fill="url(#kr-sky)"/>
  <circle cx="262" cy="48" r="24" fill="#fff4cf"/>
  <path d="M0 120 L40 92 L78 112 L120 80 L170 110 L210 88 L260 108 L320 86 V200 H0Z" fill="#f08a5d" opacity=".55"/>
  <path d="M-10 126 Q20 112 34 116 H150 Q166 112 194 124 Z" fill="#5b4a52"/>
  <rect x="36" y="124" width="110" height="34" fill="#fff4e2"/>
  <path d="M50 124v34M78 124v34M106 124v34M134 124v34" stroke="#6b4129" stroke-width="5"/>
  <rect x="0" y="156" width="320" height="44" fill="#e9c48c"/>
  <path d="M0 158 H320" stroke="#c9945c" stroke-width="4"/>
  <path d="M30 176h40M110 186h50M200 174h46M268 188h40" stroke="#d4a873" stroke-width="3" stroke-linecap="round"/>
  <g transform="translate(150 60)">
    <ellipse cx="50" cy="118" rx="52" ry="7" fill="rgba(0,0,0,.18)"/>
    <path d="M18 116 C-12 84 -6 28 22 20 L78 20 C106 28 112 84 82 116Z" fill="url(#kr-jar)" stroke="${O}" stroke-width="4"/>
    <path d="M10 64 q10 -8 20 0 t20 0 t20 0 t20 0" stroke="#b07246" stroke-width="3.5" fill="none"/>
    <path d="M28 34 q-14 26 -6 60" stroke="#fff" stroke-opacity=".28" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M22 24 Q24 -14 50 -2 Q62 -22 76 -4 Q94 -6 80 24Z" fill="#e8473b" stroke="${O}" stroke-width="3.5"/>
    <path d="M38 18 Q44 0 52 6 M60 18 Q64 2 72 6" stroke="#ffb59e" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="22" rx="31" ry="7" fill="#4a2414" stroke="${O}" stroke-width="3.5"/>
  </g>
  <g transform="translate(98 116) rotate(-24)">
    <ellipse cx="0" cy="8" rx="15" ry="27" fill="#f2f5dc" stroke="${O}" stroke-width="3"/>
    <path d="M-15 6 C-19 -18 -9 -30 0 -30 C9 -30 19 -18 15 6 Q10 13 5 5 Q0 14 -5 5 Q-10 13 -15 6Z" fill="#79c957" stroke="${O}" stroke-width="3"/>
    <path d="M0 26V-22M-7 20q-2-18-3-34M7 20q2-18 3-34" stroke="#fff" stroke-width="2" fill="none"/>
  </g>
  <g transform="translate(262 134)">
    <path d="M-10 0 Q12 -2 8 26 Q2 6 -12 8Z" fill="#e0362b" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M-11 4 l-6 -6" stroke="#3e9a3a" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g transform="translate(282 146) rotate(30)">
    <path d="M-10 0 Q12 -2 8 26 Q2 6 -12 8Z" fill="#e85a2b" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M-11 4 l-6 -6" stroke="#3e9a3a" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g transform="translate(242 150)">
    <path d="M0 -14 C2 -8 14 -4 13 4 C12 14 -12 14 -13 4 C-14 -4 -2 -8 0 -14Z" fill="#fbf5e8" stroke="${O}" stroke-width="2.6"/>
    <path d="M0 -8 Q-6 2 -3 11 M0 -8 Q6 2 3 11" stroke="#d9c7ad" stroke-width="1.8" fill="none"/>
  </g>
  <path d="M18 70h44M8 84h36M26 98h30" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
</svg>`,

    'pavlova-dash': `
<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pavlova Dash">
  <defs>
    <linearGradient id="pd-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bff3e6"/><stop offset="1" stop-color="#ffd1e1"/></linearGradient>
    <linearGradient id="pd-mer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#f3e3cc"/></linearGradient>
  </defs>
  <rect width="320" height="200" fill="url(#pd-bg)"/>
  <circle cx="60" cy="40" r="46" fill="#fff" opacity=".35"/>
  <circle cx="280" cy="170" r="60" fill="#fff" opacity=".3"/>
  <path d="M40 30l4 9 9 4-9 4-4 9-4-9-9-4 9-4z M268 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z M250 110l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff"/>
  <ellipse cx="160" cy="176" rx="104" ry="14" fill="#ffffff" stroke="${O}" stroke-width="3.5"/>
  <rect x="146" y="176" width="28" height="18" fill="#ffffff" stroke="${O}" stroke-width="3.5"/>
  <path d="M74 158 C70 130 78 112 90 110 Q100 100 112 108 Q124 98 136 106 Q148 96 160 104 Q172 96 184 106 Q196 98 208 108 Q220 100 230 110 C242 112 250 130 246 158 Q160 178 74 158Z" fill="url(#pd-mer)" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M96 128 q4 14 0 26 M128 124 q4 16 0 30 M160 124 q4 16 0 32 M192 124 q4 16 0 30 M224 128 q4 14 0 26" stroke="#e6d2b4" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M92 110 Q104 84 126 94 Q140 78 160 88 Q180 76 194 92 Q214 84 228 110 Q160 124 92 110Z" fill="#fffaf2" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
  <g stroke="${O}" stroke-width="2.6">
    <circle cx="124" cy="94" r="17" fill="#8fd14f"/><circle cx="124" cy="94" r="7" fill="#f4ffd8" stroke="none"/>
    <circle cx="196" cy="94" r="17" fill="#8fd14f"/><circle cx="196" cy="94" r="7" fill="#f4ffd8" stroke="none"/>
  </g>
  <g fill="${O}">
    <circle cx="124" cy="83" r="1.6"/><circle cx="133" cy="88" r="1.6"/><circle cx="133" cy="100" r="1.6"/><circle cx="124" cy="105" r="1.6"/><circle cx="115" cy="100" r="1.6"/><circle cx="115" cy="88" r="1.6"/>
    <circle cx="196" cy="83" r="1.6"/><circle cx="205" cy="88" r="1.6"/><circle cx="205" cy="100" r="1.6"/><circle cx="196" cy="105" r="1.6"/><circle cx="187" cy="100" r="1.6"/><circle cx="187" cy="88" r="1.6"/>
  </g>
  <path d="M160 64 C146 66 144 84 160 92 C176 84 174 66 160 64Z" fill="#ff4d5e" stroke="${O}" stroke-width="3"/>
  <path d="M152 66 q8 -8 16 0" stroke="#3fa34d" stroke-width="4" fill="none" stroke-linecap="round"/>
  <g fill="#fff3a8"><circle cx="156" cy="76" r="1.3"/><circle cx="164" cy="80" r="1.3"/><circle cx="158" cy="84" r="1.3"/></g>
  <circle cx="148" cy="98" r="7" fill="#4b5fd1" stroke="${O}" stroke-width="2.4"/>
  <circle cx="172" cy="100" r="7" fill="#4b5fd1" stroke="${O}" stroke-width="2.4"/>
  <path d="M100 104 C92 104 92 92 102 90 C110 94 108 104 100 104Z" fill="#ff4d5e" stroke="${O}" stroke-width="2.4"/>
  <path d="M220 104 C212 104 212 92 222 90 C230 94 228 104 220 104Z" fill="#ff4d5e" stroke="${O}" stroke-width="2.4"/>
  <circle cx="140" cy="86" r="6" fill="#ffc533" stroke="${O}" stroke-width="2.2"/><circle cx="140" cy="86" r="2.2" fill="#6b3a17"/>
  <circle cx="180" cy="86" r="6" fill="#ffc533" stroke="${O}" stroke-width="2.2"/><circle cx="180" cy="86" r="2.2" fill="#6b3a17"/>
</svg>`,

    'palace-builder': `
<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Palace Builder">
  <defs>
    <linearGradient id="pb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc8ff"/><stop offset="1" stop-color="#d9f1ff"/></linearGradient>
  </defs>
  <rect width="320" height="200" fill="url(#pb-sky)"/>
  <path d="M0 120 Q50 60 100 100 Q150 50 210 96 Q260 66 320 104 V200 H0Z" fill="#7fb69a"/>
  <path d="M0 136 Q70 104 140 128 Q220 100 320 130 V200 H0Z" fill="#5f9e7f"/>
  <ellipse cx="66" cy="40" rx="30" ry="10" fill="#fff" opacity=".85"/><ellipse cx="86" cy="34" rx="20" ry="10" fill="#fff" opacity=".85"/>
  <rect x="0" y="170" width="320" height="30" fill="#d9cdb8"/>
  <path d="M0 172H320" stroke="#b8a98f" stroke-width="3"/>
  <path d="M60 170h200l-12-12H72z" fill="#c8c0b2" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M72 158h176l-10-10H82z" fill="#ddd6ca" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="88" y="104" width="144" height="44" fill="#f6ead2" stroke="${O}" stroke-width="3"/>
  <g fill="#c8372d" stroke="${O}" stroke-width="2.5"><rect x="88" y="100" width="10" height="48"/><rect x="132" y="100" width="10" height="48"/><rect x="178" y="100" width="10" height="48"/><rect x="222" y="100" width="10" height="48"/></g>
  <g fill="#e9c27a" stroke="${O}" stroke-width="2"><rect x="102" y="114" width="26" height="30"/><rect x="146" y="114" width="28" height="34"/><rect x="192" y="114" width="26" height="30"/></g>
  <path d="M106 114v30M114 114v30M122 114v30M150 114v34M158 114v34M166 114v34M196 114v30M204 114v30M212 114v30M102 124h26M146 126h28M192 124h26M102 134h26M146 138h28M192 134h26" stroke="#b07e3c" stroke-width="1.6"/>
  <rect x="80" y="90" width="160" height="12" fill="#2f9a7a" stroke="${O}" stroke-width="2.5"/>
  <g fill="#ffd34d"><circle cx="96" cy="96" r="3"/><circle cx="120" cy="96" r="3"/><circle cx="144" cy="96" r="3"/><circle cx="168" cy="96" r="3"/><circle cx="192" cy="96" r="3"/><circle cx="216" cy="96" r="3"/></g>
  <g fill="#e4473a"><circle cx="108" cy="96" r="2.4"/><circle cx="132" cy="96" r="2.4"/><circle cx="156" cy="96" r="2.4"/><circle cx="180" cy="96" r="2.4"/><circle cx="204" cy="96" r="2.4"/><circle cx="228" cy="96" r="2.4"/></g>
  <path d="M40 76 Q76 92 100 90 L220 90 Q244 92 280 76 Q262 98 250 94 L70 94 Q58 98 40 76Z" fill="#3c4250" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M48 80 Q84 62 108 46 L212 46 Q236 62 272 80 Q240 90 220 90 L100 90 Q80 90 48 80Z" fill="#4b5263" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M120 50v38M136 48v42M152 46v44M168 46v44M184 48v42M200 50v38M104 56v32M216 56v32M88 66v22M232 66v22" stroke="#5f6779" stroke-width="3"/>
  <path d="M100 46 Q104 36 116 38 H204 Q216 36 220 46Z" fill="#2c313c" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
</svg>`,

    'kiwi-forest-rescue': `
<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kiwi Forest Rescue">
  <defs>
    <linearGradient id="kf-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a5c"/><stop offset="1" stop-color="#2f7a78"/></linearGradient>
  </defs>
  <rect width="320" height="200" fill="url(#kf-sky)"/>
  <circle cx="254" cy="44" r="22" fill="#fff7d6"/><circle cx="264" cy="38" r="20" fill="#24336a" opacity=".0"/>
  <g fill="#fff"><circle cx="40" cy="30" r="1.8"/><circle cx="96" cy="18" r="1.4"/><circle cx="150" cy="40" r="1.8"/><circle cx="190" cy="16" r="1.4"/><circle cx="300" cy="80" r="1.4"/><circle cx="20" cy="70" r="1.4"/></g>
  <path d="M0 110 Q20 60 40 108 Q60 54 84 106 Q110 70 130 110 Q160 50 186 108 Q214 66 236 110 Q266 60 290 108 Q306 80 320 104 V200 H0Z" fill="#1f5a4a"/>
  <rect x="0" y="160" width="320" height="40" fill="#2c6b3a"/>
  <path d="M0 162 Q80 152 160 160 T320 158" stroke="#3f8a48" stroke-width="5" fill="none"/>
  <g stroke="#7fd36b" stroke-width="3" fill="none" stroke-linecap="round">
    <path d="M30 164 Q24 120 50 96"/><path d="M32 150l-12 -6M34 140l-12 -8M38 128l-10 -10M42 116l-8 -10M36 144l12 -8M40 132l12 -10M44 120l10 -10"/>
    <path d="M286 166 Q296 124 270 100"/><path d="M286 152l12 -6M284 140l12 -8M280 128l10 -10M276 116l8 -10M282 146l-12 -8M278 134l-12 -10M274 122l-10 -10"/>
  </g>
  <path d="M240 168 q-6 -24 8 -30 q12 -2 10 10 q-2 8 -8 4" stroke="#a6e38f" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <g fill="#c9ff7a" opacity=".9"><circle cx="70" cy="80" r="2"/><circle cx="120" cy="64" r="2"/><circle cx="210" cy="72" r="2"/><circle cx="168" cy="96" r="1.6"/></g>
  <ellipse cx="160" cy="174" rx="58" ry="8" fill="rgba(0,0,0,.25)"/>
  <path d="M138 150l-4 22M134 172h-10M134 172l-4 5M168 152l2 20M170 172h10M170 172l4 5" stroke="#d29a4a" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <ellipse cx="150" cy="128" rx="46" ry="34" fill="#8a5a33" stroke="${O}" stroke-width="4"/>
  <path d="M118 120q9-7 17 0M132 136q9-7 17 0M150 114q9-7 17 0M164 132q8-6 15 0M124 146q7 -5 14 0" stroke="#6b4325" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="192" cy="112" r="18" fill="#8a5a33" stroke="${O}" stroke-width="4"/>
  <path d="M208 118 Q232 132 236 160" stroke="#ecd49c" stroke-width="6" stroke-linecap="round" fill="none"/>
  <circle cx="197" cy="108" r="4" fill="${O}"/><circle cx="198.5" cy="106.5" r="1.3" fill="#fff"/>
  <path d="M184 104 l-6 -6 M188 101 l-3 -8" stroke="#3a2416" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  };

  KK.art = { kiwiBird, kimchiJar, cards };
})(window.KK);
