extends Node
## Global signal bus (autoload "Events").
##
## Gameplay systems never hold references to the HUD or to each other; they
## emit here and whoever cares listens. This keeps the player, enemies, boss,
## stage and UI independent and easy to test in isolation.

# --- player ---------------------------------------------------------------
signal player_spawned(player: Node)
signal player_health_changed(hp: int, max_hp: int)
signal player_mana_changed(mp: float, max_mp: float)
signal player_ult_changed(value: float, max_value: float)
signal player_cooldown_changed(action: StringName, remaining: float, total: float)
signal player_combo_changed(hits: int)
signal player_died

# --- enemies / boss -------------------------------------------------------
signal enemy_killed(enemy: Node)
signal boss_intro_started(boss: Node)
signal boss_started(boss: Node)
signal boss_health_changed(hp: int, max_hp: int)
signal boss_phase_changed(phase: int)
signal boss_defeated(boss: Node)

# --- stage / presentation -------------------------------------------------
signal checkpoint_reached(checkpoint_id: int)
signal stage_cleared(stats: Dictionary)
signal ultimate_cutin_requested
signal ultimate_cutin_finished
signal toast(text: String)
signal camera_shake(strength: float, duration: float)
signal settings_changed
signal pause_requested

# --- village / quests (Phase 3) ---------------------------------------------
signal npc_talked(npc_id: StringName)
signal item_enhanced(item_id: StringName, level: int)
signal item_crafted(item_id: StringName)
signal farm_harvested(count: int)
signal interact_target_changed(target: Node)
signal chest_opened(chest_id: String, stage_id: String)
signal relic_obtained(relic_id: StringName)
signal job_changed(job_id: StringName)
