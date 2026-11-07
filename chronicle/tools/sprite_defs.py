"""Frame definitions for the asset pipeline (step 2, used by build_sprites.py).

Every box is in pixel coordinates of the cleaned 1536x1024 sheets in
art_source/cleaned/ (identical to the originals). Boxes were measured with a
connected-component pass and checked by eye on ruler overlays; see
docs/ASSET_ANALYSIS.md for the full frame map of all six sheets.

Frame selection modes
  box=(x0, y0, x1, y1)  take every sprite component that lies >= 60% inside
                        the box (neighbouring frames are left out even when
                        bounding boxes overlap)
  hard=True             take exactly the pixels inside the box (used where two
                        frames touch and form one component)
  pick=[(x, y), ...]    take only the components under these points
  erase=[(x0,y0,x1,y1)] remove pixels after selection
  ax/ay                 manual anchor (ground point) in sheet coordinates

All sprites of one character use the same scale, so every frame lands on the
same game-pixel grid. Scales were chosen for the in-game size:
  hero ~64 px tall, slime ~34 px, small slime ~24 px, Verdan ~130 px
(base viewport 640x360). The boss keeps more detail than the hero instead of
being drawn with 2x2 "fat" pixels: nothing is scaled at runtime, so the
pixel size on screen is identical for every sprite.
"""


def F(x0, y0, x1, y1, **kw):
    d = {"box": (x0, y0, x1, y1)}
    d.update(kw)
    return d


def B(x, y, w, h, pad=6, up=0, **kw):
    """Box from a component bbox (x, y, w, h) with padding."""
    return F(x - pad, y - pad - up, x + w + pad, y + h + pad, **kw)


# --------------------------------------------------------------------------
# A. Hero - 청월의 검사 (sheet 01). Faces right.
# --------------------------------------------------------------------------
HERO_FRAMES = {
    # row 1: idle x5, run x4, jump, fall
    "idle0": B(339, 36, 95, 148), "idle1": B(438, 37, 95, 149), "idle2": B(543, 36, 88, 150),
    "idle3": B(639, 35, 88, 151), "idle4": B(733, 33, 90, 153),
    "run0": B(833, 40, 122, 147), "run1": B(965, 42, 98, 138), "run2": B(1069, 47, 110, 139),
    "run3": B(1178, 38, 115, 147),
    "jump": B(1303, 23, 111, 140), "fall": B(1424, 22, 98, 166),
    # row 2: sword attacks (wind-up, thrust, arc slash, crescent, lunge, finisher)
    "atk_windup": B(340, 210, 138, 130), "atk_thrust": B(496, 219, 184, 122),
    "atk_slash": B(655, 217, 199, 140), "atk_crescent": B(841, 198, 210, 155),
    "atk_lunge": B(1068, 218, 166, 131),
    "atk_finisher": F(1240, 198, 1530, 372, pick=[(1330, 300), (1505, 280)], body=(1330, 300)),
    # row 3/4: guard, hurt, knock-back, down, crouch, skill, dodge, ultimate
    "guard": B(352, 365, 149, 153), "hurt": B(513, 369, 112, 149),
    "knockback": B(637, 384, 140, 132), "down_face": B(781, 450, 137, 80),
    "crouch": B(931, 408, 125, 126),
    "skill_stance": B(334, 527, 165, 155), "skill_charge": B(498, 529, 129, 154),
    "down_back": B(642, 556, 182, 122), "dodge": B(834, 578, 162, 107),
    "skill_spin": B(1012, 550, 186, 154), "ult_charge": B(1219, 558, 121, 144),
    "ult_pillar": F(1345, 345, 1532, 714),
}

HERO_ANIMS = {
    "idle": (["idle0", "idle1", "idle2", "idle3", "idle4", "idle3", "idle2", "idle1"], 7, True),
    # The sheet has no walk cycle: walk reuses the run frames at a lower rate
    # (documented in ASSET_ANALYSIS.md as a supplemented motion).
    "walk": (["run0", "run1", "run2", "run3"], 7, True),
    "run": (["run0", "run1", "run2", "run3"], 11, True),
    "jump": (["jump"], 1, False),
    "fall": (["fall"], 1, False),
    "land": (["crouch"], 12, False),
    "attack1": (["atk_windup", "atk_thrust"], 14, False),
    "attack2": (["atk_slash"], 10, False),
    "attack3": (["atk_lunge", "atk_finisher"], 12, False),
    "air_attack": (["atk_slash"], 10, False),
    "heavy_charge": (["skill_stance"], 1, False),
    "heavy": (["atk_crescent"], 8, False),
    "dodge": (["crouch", "dodge", "dodge"], 16, False),
    "hurt": (["hurt"], 1, False),
    "death": (["hurt", "knockback", "down_face"], 7, False),
    "skill": (["skill_charge", "skill_spin"], 10, False),
    "ultimate": (["ult_charge", "ult_pillar"], 4, False),
    "guard": (["guard"], 1, False),
}

HERO_FX = {
    "crescent": F(1250, 195, 1532, 345, pick=[(1505, 280)]),
    "spike_burst": B(1099, 378, 120, 157),
    "magic_circle": F(1220, 405, 1368, 545),
    "vortex": B(1262, 720, 150, 139),
    "swirl": B(1235, 867, 136, 132),
    "light_pillar": B(1396, 863, 139, 139),
    "sparkle": B(1446, 789, 55, 63),
    "ring": B(1342, 888, 54, 44),
}

HERO_ART = {
    "full_art": F(0, 0, 352, 564),
    "chibi": F(8, 572, 280, 1024),
    "portrait_neutral": B(291, 713, 109, 121, pad=1),
    "portrait_angry": B(403, 713, 109, 121, pad=1),
    "portrait_hurt": B(516, 713, 109, 121, pad=1),
    "portrait_alert": B(629, 713, 107, 121, pad=1),
    "portrait_spark": B(291, 840, 108, 123, pad=1),
    "portrait_rage": B(403, 840, 109, 123, pad=1),
    "portrait_shy": B(516, 840, 109, 123, pad=1),
    "portrait_question": B(629, 840, 107, 123, pad=1),
    "ult_cutin": F(733, 703, 1253, 1004, pick=[(980, 850)]),
}

# --------------------------------------------------------------------------
# B. Forest spirit slime (sheet 02). Faces right.
# --------------------------------------------------------------------------
SLIME_FRAMES = {
    "idle0": B(386, 95, 91, 83), "idle1": B(481, 91, 85, 87), "idle2": B(569, 85, 80, 92),
    "idle3": B(650, 91, 82, 86), "idle4": B(733, 91, 84, 87), "idle5": B(817, 95, 84, 83),
    "idle6": B(904, 91, 84, 87),
    "move0": B(1012, 113, 75, 67, up=20), "move1": B(1092, 111, 79, 69, up=20),
    "move2": B(1176, 109, 80, 72, up=20), "move3": B(1262, 112, 81, 68, up=20),
    "move4": B(1350, 120, 81, 61, up=20), "move5": B(1436, 118, 80, 63, up=20),
    "run0": B(40, 310, 130, 95), "run1": B(176, 304, 120, 102), "run2": B(306, 306, 133, 94),
    "run3": B(449, 301, 115, 104), "run4": B(564, 299, 105, 107),
    "jump0": B(762, 290, 85, 96, pad=14), "jump1": B(864, 257, 86, 98, pad=8),
    "jump2": B(970, 293, 83, 93, pad=14),
    "hurt0": B(1120, 303, 111, 96, up=22), "hurt1": B(1245, 325, 85, 74, up=40),
    "hurt2": B(1360, 320, 99, 79, up=36),
    "shot0": B(23, 463, 112, 103), "shot1": B(149, 470, 99, 101),
    # the slime ball leaves the body here; it is spawned as a projectile
    "shot2": B(262, 486, 157, 85, erase=[(362, 470, 430, 580)]),
    "shot3": B(420, 480, 98, 86),
    "splash0": B(584, 470, 99, 103), "splash1": B(695, 465, 103, 108),
    "splash2": B(805, 479, 110, 94, up=10), "splash3": B(919, 489, 172, 89, up=40),
    "death0": B(1109, 482, 101, 96), "death1": B(1213, 487, 103, 91),
    "death2": B(1322, 536, 96, 41, up=20), "death3": B(1426, 534, 92, 43, up=12),
}

SLIME_ANIMS = {
    "idle": (["idle0", "idle1", "idle2", "idle3", "idle4", "idle5", "idle6"], 8, True),
    "move": (["move0", "move1", "move2", "move3", "move4", "move5"], 9, True),
    "run": (["run0", "run1", "run2", "run3", "run4"], 12, True),
    "jump": (["jump0", "jump1", "jump2"], 6, False),
    "hurt": (["hurt0", "hurt1", "hurt2"], 12, False),
    "shot": (["shot0", "shot1", "shot2", "shot3"], 8, False),
    "splash": (["splash0", "splash1", "splash2", "splash3"], 8, False),
    "death": (["death0", "death1", "death2", "death3"], 8, False),
}

SLIME_FX = {
    "ball": F(364, 490, 426, 566, hard=True),
    "droplet": B(799, 652, 71, 67),
    "crescent": B(1003, 639, 193, 215),
    "burst": B(1352, 680, 173, 173),
    "puddle": B(11, 895, 218, 84),
    "puddle_small": B(246, 907, 187, 71),
    "splash": B(448, 898, 161, 89),
    "splash_tall": B(623, 896, 139, 94),
    "pillar": B(863, 865, 176, 140),
}

SLIME_VARIANT_ART = {
    "elite": B(318, 672, 184, 151),
    "boss_slime": B(515, 590, 268, 236),
    "icon_paw": B(1155, 885, 80, 94, pad=2),
    "icon_skull": B(1245, 894, 80, 88, pad=2),
    "icon_heart": B(1332, 906, 73, 66, pad=2),
    "icon_curse": B(1411, 875, 105, 111, pad=2),
}

# --------------------------------------------------------------------------
# C. Mid boss Verdan (sheet 04). Faces right.
# --------------------------------------------------------------------------
VERDAN_FRAMES = {
    "idle0": B(520, 44, 171, 144), "idle1": B(701, 40, 166, 153), "idle2": B(875, 36, 171, 156),
    "idle3": B(1057, 47, 152, 143), "idle4": B(1211, 45, 157, 147), "idle5": B(1375, 48, 155, 143),
    "move0": B(528, 229, 164, 146), "move1": B(701, 228, 146, 149), "move2": B(855, 225, 152, 151),
    "move3": B(1020, 226, 171, 152), "move4": B(1196, 225, 168, 153), "move5": B(1358, 232, 157, 149),
    # Attack 1 - 나무 던지기 (tree throw); the log in frame 2 is released
    "throw0": B(11, 441, 174, 152), "throw1": B(170, 450, 184, 141), "throw2": B(340, 447, 196, 144),
    # Attack 2 - 뿌리 돌진 (root charge); frames touch, so hard crops
    "roots0": F(683, 452, 852, 594, hard=True), "roots1": F(852, 452, 1003, 594, hard=True),
    "roots2": F(1003, 428, 1152, 594, hard=True), "roots3": B(1356, 447, 173, 144),
    # Attack 3 - 숲의 분노 (forest wrath)
    "wrath0": B(9, 645, 161, 141), "wrath1": B(174, 623, 189, 164),
    "hit0": B(719, 640, 138, 147), "hit1": B(865, 638, 157, 149), "hit2": B(1014, 650, 142, 147),
    "die0": F(1166, 640, 1345, 790, hard=True), "die1": F(1345, 640, 1532, 790, hard=True),
}

VERDAN_ANIMS = {
    "idle": (["idle0", "idle1", "idle2", "idle3", "idle4", "idle5"], 6, True),
    "move": (["move0", "move1", "move2", "move3", "move4", "move5"], 7, True),
    "throw": (["throw0", "throw1", "throw2"], 5, False),
    "roots": (["roots0", "roots1", "roots2"], 6, False),
    "root_burst": (["roots3"], 1, False),
    "wrath": (["wrath0", "wrath1"], 4, False),
    "hit": (["hit0", "hit1", "hit2"], 10, False),
    "die": (["hit1", "die0", "die1"], 3, False),
}

VERDAN_FX = {
    "log": F(542, 420, 700, 530, hard=True),
    "root_wave": F(1152, 428, 1365, 594, hard=True),
    "magic_circle": F(373, 600, 556, 792, hard=True),
    "ground_burst": F(556, 600, 726, 792, hard=True),
    "leaf_swirl": B(8, 838, 200, 154),
    "leaf_spiral": B(533, 845, 95, 107),
    "nature_circle": B(893, 826, 145, 151),
    "green_burst": B(1057, 819, 110, 172),
}

VERDAN_SPIKE = {
    "root_spike": F(1185, 436, 1300, 594, hard=True),
}

VERDAN_ART = {
    "full_art": F(4, 4, 508, 410),
    "part_tree": B(1340, 817, 190, 185),
    "part_crystal": B(1332, 830, 43, 84, pad=3),
    "part_branch": B(1177, 838, 110, 163),
    "part_bush": B(1267, 896, 77, 106, pad=3),
    "part_rock": B(1435, 904, 49, 96, pad=3),
    "part_rock2": B(1487, 926, 43, 71, pad=3),
}

# --------------------------------------------------------------------------
# Build groups. kind: "character" (hard alpha, shared palette, outline) or
# "fx" (soft alpha in 4 steps, no outline) or "art" (hard alpha, outline,
# each image exported as its own PNG as well).
# --------------------------------------------------------------------------
GROUPS = [
    dict(name="hero", sheet="01_hero_cheongwol", kind="character", scale=0.44, colors=56,
         out="assets/characters/hero", frames=HERO_FRAMES, anims=HERO_ANIMS, anchor="dark_head",
         outline=(14, 12, 26)),
    dict(name="hero_fx", sheet="01_hero_cheongwol", kind="fx", scale=0.44, colors=40,
         out="assets/effects/hero", frames=HERO_FX, anchor="center", thr=40, dil=3),
    dict(name="hero_art", sheet="01_hero_cheongwol", kind="art", scale=0.44, colors=64,
         out="assets/characters/hero/art", frames=HERO_ART, anchor="bottom",
         outline=(14, 12, 26)),
    dict(name="slime", sheet="02_forest_slime", kind="character", scale=0.40, colors=32,
         out="assets/enemies/forest_slime", frames=SLIME_FRAMES, anims=SLIME_ANIMS, anchor="mass",
         outline=(8, 26, 14)),
    dict(name="slime_small", sheet="02_forest_slime", kind="character", scale=0.28, colors=28,
         out="assets/enemies/forest_slime_small", frames=SLIME_FRAMES, anims=SLIME_ANIMS,
         anchor="mass", outline=(8, 26, 14)),
    dict(name="slime_fx", sheet="02_forest_slime", kind="fx", scale=0.40, colors=28,
         out="assets/effects/slime", frames=SLIME_FX, anchor="center", thr=40, dil=3),
    dict(name="slime_art", sheet="02_forest_slime", kind="art", scale=0.31, colors=40,
         out="assets/enemies/forest_slime/art", frames=SLIME_VARIANT_ART, anchor="bottom",
         outline=(14, 10, 24)),
    dict(name="verdan", sheet="04_boss_verdan", kind="character", scale=0.90, colors=64,
         out="assets/bosses/verdan", frames=VERDAN_FRAMES, anims=VERDAN_ANIMS, anchor="mass_top",
         outline=(16, 12, 8)),
    dict(name="verdan_fx", sheet="04_boss_verdan", kind="fx", scale=0.45, colors=40,
         out="assets/effects/verdan", frames=VERDAN_FX, anchor="bottom", thr=40, dil=3),
    dict(name="verdan_spike", sheet="04_boss_verdan", kind="fx", scale=0.34, colors=32,
         out="assets/effects/verdan", frames=VERDAN_SPIKE, anchor="bottom", thr=40, dil=3),
    dict(name="verdan_art", sheet="04_boss_verdan", kind="art", scale=0.44, colors=64,
         out="assets/bosses/verdan/art", frames=VERDAN_ART, anchor="bottom",
         outline=(16, 12, 8)),
]


# --------------------------------------------------------------------------
# Phase 3: village NPCs (sheet 03) and pets (sheet 05).
# --------------------------------------------------------------------------
# Full-body illustrations are used as the standing NPC sprites (about the
# hero's height); the first (neutral) portrait card of each NPC is used in
# the dialogue box. Column 1 of the NPC sheet repeats the hero; it is the base
# of the guard (palette swap, see tools/build_npc_variants.py) because the
# sheet has no guard design.
NPC_FULL = {
    "hero_npc": B(32, 4, 152, 299), "maid": B(216, 12, 157, 293), "scholar": B(389, 5, 205, 299),
    "smith": B(603, 2, 156, 302), "witch": B(776, 10, 182, 295), "priest": B(973, 3, 144, 300),
    "merchant": B(1130, 5, 183, 298), "traveler": B(1303, 7, 207, 296),
}
_PY0, _PY1 = 571, 690
NPC_PORTRAIT = {
    "hero_npc": F(8, _PY0, 92, _PY1, hard=True), "maid": F(193, _PY0, 281, _PY1, hard=True),
    "scholar": F(404, _PY0, 489, _PY1, hard=True), "smith": F(591, _PY0, 672, _PY1, hard=True),
    "witch": F(778, _PY0, 870, _PY1, hard=True), "priest": F(974, _PY0, 1060, _PY1, hard=True),
    "merchant": F(1157, _PY0, 1244, _PY1, hard=True), "traveler": F(1348, _PY0, 1430, _PY1, hard=True),
}
VILLAGE_ICONS = {
    "bubble_talk": B(18, 696, 71, 60, pad=3), "bubble_question": B(98, 695, 63, 72, pad=3),
    "bubble_exclaim": B(171, 695, 60, 71, pad=3), "scroll": B(257, 699, 63, 73, pad=3),
    "quest_turnin": B(339, 698, 55, 71, pad=3), "alert": B(416, 702, 49, 54, pad=3),
    "coin": B(483, 701, 64, 72, pad=3), "chest": B(557, 696, 82, 86, pad=3),
    "gold_bag": B(644, 700, 68, 88, pad=3), "gift": B(732, 698, 68, 90, pad=3),
}
VILLAGE_PROPS = {
    "stall": B(0, 778, 335, 232, pad=2), "potion_sign": F(279, 786, 421, 911, hard=True),
    "banner": F(438, 797, 532, 938, hard=True), "notice_board": F(563, 797, 725, 929, hard=True),
    "lamp": F(740, 794, 790, 1002, hard=True), "barrel": F(278, 918, 336, 1005, hard=True),
    "bush": F(338, 904, 405, 1007, hard=True),
}

# Pets: move / idle / sleep / emote frames. Floating marks (Z, !, hearts)
# drawn next to the poses are erased; the game draws its own emote icons.
CAT_FRAMES = {
    "move0": B(249, 51, 116, 95), "move1": B(375, 38, 101, 106), "move2": B(478, 46, 88, 97),
    "move3": B(567, 46, 97, 96), "move4": B(666, 48, 82, 94), "move5": B(745, 47, 91, 90),
    "dash": B(845, 29, 94, 92), "sit": B(255, 156, 100, 106),
    "sleep": B(375, 153, 114, 110, erase=[(452, 148, 495, 196)]),
    "surprise": B(516, 154, 117, 108, erase=[(634, 145, 665, 196)]),
    "love": B(675, 153, 112, 109, erase=[(670, 150, 712, 188)]),
}
FOX_FRAMES = {
    "move0": B(252, 309, 120, 96), "move1": B(375, 288, 105, 106), "move2": B(484, 287, 94, 104),
    "move3": B(591, 295, 84, 99), "sleep": B(692, 303, 98, 91, erase=[(686, 297, 745, 334)]),
    "sit": B(809, 288, 106, 105, erase=[(803, 318, 836, 350)]),
    "love": B(931, 288, 99, 108, erase=[(924, 292, 960, 326)]),
}
DRAGON_FRAMES = {
    "idle0": B(264, 451, 104, 121), "idle1": B(370, 437, 107, 135), "idle2": B(477, 436, 108, 136),
    "sleep": B(593, 528, 73, 47), "fly": B(791, 434, 132, 71), "wings": B(934, 425, 153, 146),
}
DRAGON_FX = {"pet_fireball": F(800, 512, 948, 590, hard=True)}
PSLIME_FRAMES = {
    "idle0": B(262, 614, 91, 76), "bounce1": B(369, 601, 84, 89, erase=[(436, 605, 470, 650)]),
    "bounce2": B(471, 613, 75, 77), "bounce3": B(547, 593, 99, 94), "squish": B(663, 619, 84, 75),
    "surprise": B(787, 615, 110, 81, erase=[(878, 608, 922, 652), (758, 630, 798, 690)]),
    "happy": B(913, 593, 114, 97),
}
BIRD_FRAMES = {
    "flap0": B(248, 731, 104, 88), "flap1": B(366, 712, 93, 103), "flap2": B(472, 714, 91, 105),
    "flap3": B(574, 714, 100, 94), "glide": B(753, 711, 134, 108), "happy": B(983, 709, 160, 109),
}
PET_ART = {
    "cat_full": B(9, 11, 220, 250, pad=3), "fox_full": B(9, 265, 211, 170, pad=3),
    "dragon_full": F(6, 430, 258, 573, hard=True, erase=[(6, 430, 258, 441)]),
    "slime_full": F(6, 574, 232, 712, hard=True, erase=[(6, 574, 232, 584)]),
    "bird_full": B(67, 711, 139, 110, pad=3),
}
_IY0, _IY1 = 856, 940
PET_ICONS = {
    "icon_cat": F(15, _IY0, 100, _IY1, hard=True), "icon_fox": F(102, _IY0, 186, _IY1, hard=True),
    "icon_dragon": F(186, _IY0, 271, _IY1, hard=True), "icon_slime": F(271, _IY0, 356, _IY1, hard=True),
    "icon_bird": F(356, _IY0, 439, _IY1, hard=True), "icon_paw": F(440, _IY0, 522, _IY1, hard=True),
    "heart": B(20, 946, 65, 58, pad=3), "heart_plus": B(93, 946, 80, 59, pad=3),
    "star": B(183, 946, 51, 51, pad=3), "paw": B(244, 945, 57, 59, pad=3), "crown": B(312, 946, 65, 53, pad=3),
}

PET_ANIMS = {
    "cat": {"idle": (["sit"], 1, True), "move": (["move0", "move1", "move2", "move3", "move4", "move5"], 10, True),
            "sleep": (["sleep"], 1, True), "love": (["love"], 1, True), "surprise": (["surprise"], 1, True),
            "dash": (["dash"], 1, True)},
    "fox": {"idle": (["sit"], 1, True), "move": (["move0", "move1", "move2", "move3"], 8, True),
            "sleep": (["sleep"], 1, True), "love": (["love"], 1, True)},
    "dragon": {"idle": (["idle0", "idle1", "idle2", "idle1"], 5, True), "move": (["fly"], 1, True),
               "sleep": (["sleep"], 1, True), "love": (["wings"], 1, True)},
    "spirit_slime": {"idle": (["idle0", "bounce2"], 3, True),
                     "move": (["idle0", "bounce1", "bounce3", "bounce2"], 8, True),
                     "sleep": (["squish"], 1, True), "love": (["happy"], 1, True), "surprise": (["surprise"], 1, True)},
    "bird": {"idle": (["flap0", "flap3"], 3, True), "move": (["flap0", "flap1", "flap2", "flap3"], 10, True),
             "sleep": (["flap0"], 1, True), "love": (["happy"], 1, True), "glide": (["glide"], 1, True)},
}

_NPC_OUT = (20, 14, 30)
for _n, _fd in NPC_FULL.items():
    GROUPS.append(dict(name=f"npc_{_n}", sheet="03_village_npcs", kind="art", scale=0.22, colors=40,
                       out=f"assets/npcs/{_n}", frames={"full": _fd}, anchor="bottom", outline=_NPC_OUT))
    GROUPS.append(dict(name=f"npc_{_n}_portrait", sheet="03_village_npcs", kind="art", scale=0.62,
                       colors=56, out=f"assets/npcs/{_n}", frames={"portrait": NPC_PORTRAIT[_n]},
                       anchor="bottom"))
GROUPS += [
    dict(name="village_icons", sheet="03_village_npcs", kind="art", scale=0.34, colors=48,
         out="assets/ui/village", frames=VILLAGE_ICONS, anchor="bottom", outline=_NPC_OUT),
    dict(name="village_props", sheet="03_village_npcs", kind="art", scale=0.42, colors=56,
         out="assets/environments/village/props", frames=VILLAGE_PROPS, anchor="bottom", outline=_NPC_OUT),
    dict(name="pet_cat", sheet="05_pets", kind="character", scale=0.30, colors=28, out="assets/pets/cat",
         frames=CAT_FRAMES, anims=PET_ANIMS["cat"], anchor="bottom", outline=(12, 10, 26)),
    dict(name="pet_fox", sheet="05_pets", kind="character", scale=0.28, colors=28, out="assets/pets/fox",
         frames=FOX_FRAMES, anims=PET_ANIMS["fox"], anchor="bottom", outline=(16, 22, 48)),
    dict(name="pet_dragon", sheet="05_pets", kind="character", scale=0.27, colors=32, out="assets/pets/dragon",
         frames=DRAGON_FRAMES, anims=PET_ANIMS["dragon"], anchor="bottom", outline=(22, 8, 8)),
    dict(name="pet_spirit_slime", sheet="05_pets", kind="character", scale=0.30, colors=40,
         out="assets/pets/spirit_slime", frames=PSLIME_FRAMES, anims=PET_ANIMS["spirit_slime"],
         anchor="bottom", outline=(14, 22, 52)),
    dict(name="pet_bird", sheet="05_pets", kind="character", scale=0.28, colors=28, out="assets/pets/bird",
         frames=BIRD_FRAMES, anims=PET_ANIMS["bird"], anchor="bottom", outline=(14, 22, 52)),
    dict(name="pet_fx", sheet="05_pets", kind="fx", scale=0.24, colors=24, out="assets/effects/pets",
         frames=DRAGON_FX, anchor="center", thr=40, dil=3),
    dict(name="pet_art", sheet="05_pets", kind="art", scale=0.40, colors=64, out="assets/pets/art",
         frames=PET_ART, anchor="bottom", outline=(14, 12, 28)),
    dict(name="pet_icons", sheet="05_pets", kind="art", scale=0.36, colors=56, out="assets/ui/pets",
         frames=PET_ICONS, anchor="bottom"),
]
