class_name Pet
extends Node2D
## The active pet in the world: follows the hero, idles, falls asleep,
## shows emotes and runs its pet ability.
##
##   follow -> idle (hero stands still) -> sleep (after SLEEP_AFTER s)
## Abilities (PetData.active):
##   regen    its hp_regen passive heals the hero every 5 s (the tick itself
##            runs in Player, so relics and jobs with hp_regen work too)
##   fireball shoots a small fireball at the nearest monster every 6 s
##   magnet   pulls dropped items and heal orbs towards the hero

const FOLLOW_DIST := 26.0
const FLY_HEIGHT := 36.0
const SLEEP_AFTER := 8.0
const TELEPORT_DIST := 260.0
const FIREBALL_EVERY := 6.0
const FIREBALL_RANGE := 210.0
const FIREBALL_TEX := preload("res://assets/effects/pets/pet_fireball.png")
const EMOTE_TEX := {
	&"love": preload("res://assets/ui/pets/heart.png"),
	&"star": preload("res://assets/ui/pets/star.png"),
	&"surprise": preload("res://assets/ui/village/bubble_exclaim.png"),
}

var data: PetData
var player: Player
var sprite: AnimatedSprite2D
var state: StringName = &"follow"
var _emote: Sprite2D
var _zz: Label
var _emote_t := 0.0
var _idle_t := 0.0
var _ability_t := 0.0
var _ground_y := 0.0
var _t := 0.0


## Spawns the active pet next to the player (null if no pet is active).
static func spawn(parent: Node, hero: Player) -> Pet:
	var pd := Pets.active_pet()
	if pd == null or hero == null:
		return null
	var p := Pet.new()
	p.data = pd
	p.player = hero
	p.name = "Pet"
	p.position = hero.global_position + Vector2(-FOLLOW_DIST * hero.facing, -FLY_HEIGHT if pd.flying else 0.0)
	parent.add_child(p)
	return p


func _ready() -> void:
	add_to_group(&"pet")
	z_index = 11
	sprite = AnimatedSprite2D.new()
	sprite.sprite_frames = data.frames
	if data.frames.has_meta("anchor"):
		sprite.centered = false
		sprite.offset = -Vector2(data.frames.get_meta("anchor"))
	add_child(sprite)
	sprite.play(&"idle")
	_emote = Sprite2D.new()
	_emote.visible = false
	_emote.z_index = 5
	add_child(_emote)
	_zz = Label.new()
	_zz.text = "z"
	_zz.label_settings = LabelSettings.new()
	_zz.label_settings.font = UiKit.FONT_BOLD
	_zz.label_settings.font_size = 11
	_zz.label_settings.outline_size = 3
	_zz.label_settings.outline_color = UiKit.OUTLINE
	_zz.label_settings.font_color = Color(0.8, 0.9, 1.0)
	_zz.visible = false
	add_child(_zz)
	_ground_y = player.global_position.y if is_instance_valid(player) else global_position.y
	Profile.leveled_up.connect(func(_l: int) -> void: emote(&"love"))
	Pets.pet_leveled.connect(func(_id: StringName, _l: int) -> void: emote(&"star"))
	Events.boss_intro_started.connect(func(_b: Node) -> void: emote(&"surprise"))
	Pets.changed.connect(_on_pets_changed)


func _on_pets_changed() -> void:
	if Pets.active != data.id:
		var pd := Pets.active_pet()
		if pd == null:
			queue_free()
			return
		data = pd
		sprite.sprite_frames = pd.frames
		if pd.frames.has_meta("anchor"):
			sprite.offset = -Vector2(pd.frames.get_meta("anchor"))
		sprite.play(&"idle")
		emote(&"love")


func emote(kind: StringName, duration: float = 1.6) -> void:
	if not EMOTE_TEX.has(kind):
		return
	_emote.texture = EMOTE_TEX[kind]
	_emote.visible = true
	_emote_t = duration
	if sprite.sprite_frames.has_animation(kind):
		sprite.play(kind)


func _physics_process(delta: float) -> void:
	_t += delta
	if not is_instance_valid(player):
		return
	if player.is_on_floor():
		_ground_y = player.global_position.y
	var side := -float(player.facing)
	var target := Vector2(player.global_position.x + side * FOLLOW_DIST, _ground_y)
	if data.flying:
		target.y = player.global_position.y - FLY_HEIGHT + sin(_t * 3.0) * 3.0
	var d := target - global_position
	if d.length() > TELEPORT_DIST:
		global_position = target
		FX.spark(global_position + Vector2(0, -10), Color(0.8, 0.9, 1.0))
		d = Vector2.ZERO
	var moving := absf(d.x) > 7.0 or (data.flying and absf(d.y) > 10.0)
	var k := 1.0 - exp(-(5.5 if data.flying else 7.0) * delta)
	global_position.x += d.x * k
	global_position.y += d.y * (k if data.flying else minf(1.0, k * 2.0))
	if absf(d.x) > 2.0:
		sprite.flip_h = d.x < 0.0
	_update_state(moving, delta)
	_update_emote(delta)
	_run_ability(delta)


func _update_state(moving: bool, delta: float) -> void:
	var player_still := absf(player.velocity.x) < 5.0 and player.is_on_floor()
	if moving or not player_still:
		_idle_t = 0.0
		state = &"follow"
	else:
		_idle_t += delta
		state = &"sleep" if _idle_t > SLEEP_AFTER else &"idle"
	if _emote_t > 0.0 and sprite.sprite_frames.has_animation(sprite.animation) and sprite.animation in [&"love", &"surprise"]:
		return
	var anim: StringName = &"move" if moving else (&"sleep" if state == &"sleep" else &"idle")
	if sprite.animation != anim:
		sprite.play(anim)
	_zz.visible = state == &"sleep"
	if _zz.visible:
		_zz.position = Vector2(6 + sin(_t * 2.0) * 2.0, -26 - fmod(_t * 6.0, 8.0))


func _update_emote(delta: float) -> void:
	if _emote_t <= 0.0:
		return
	_emote_t -= delta
	_emote.position = Vector2(0, -34 - sin(_t * 6.0) * 2.0)
	if _emote_t <= 0.0:
		_emote.visible = false


func _run_ability(delta: float) -> void:
	if player.is_dead:
		return
	match data.active:
		&"fireball":
			_ability_t += delta
			if _ability_t >= FIREBALL_EVERY:
				var target := _nearest_enemy()
				if target != null:
					_ability_t = 0.0
					_shoot(target)
		&"magnet":
			var radius := Profile.mod(&"magnet")
			for n in get_tree().get_nodes_in_group(&"pickups"):
				var pk := n as Pickup
				if pk == null or pk.kind == Pickup.Kind.TIME_CORE or pk.is_queued_for_deletion():
					continue
				var to := player.global_position + Vector2(0, -10) - pk.global_position
				if to.length() < radius:
					pk.global_position += to.normalized() * minf(to.length(), 150.0 * delta)


func _nearest_enemy() -> Node2D:
	var best: Node2D = null
	var best_d := FIREBALL_RANGE
	for e in get_tree().get_nodes_in_group(&"enemies"):
		var en := e as Enemy
		if en == null or en.is_dead or not en.is_inside_tree():
			continue
		if en.has_method(&"is_active") and not bool(en.call(&"is_active")):
			continue
		var dist := en.global_position.distance_to(global_position)
		if dist < best_d:
			best_d = dist
			best = en
	return best


func _shoot(target: Node2D) -> void:
	var from := global_position + Vector2(0, -12)
	var aim := target.global_position + Vector2(0, -14) - from
	var pr := Projectile.new()
	pr.texture = FIREBALL_TEX
	pr.lifetime = 1.6
	pr.additive = true
	pr.face_velocity = true
	pr.hit_rect = Rect2(-7, -6, 14, 12)
	var dmg := 8 + 2 * Pets.level_of(data.id)
	pr.setup(from, aim.normalized() * 230.0, HitData.make(dmg, Vector2(60, -40), player, &"pet"),
			Hitbox.LAYER_ENEMY_HURTBOX, player)
	get_parent().add_child(pr)
	emote(&"star", 0.6)
