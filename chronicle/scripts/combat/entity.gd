class_name Entity
extends CharacterBody2D
## Shared base for the player, monsters and bosses:
## health, facing (mirrors the Visual node), invulnerability, hit flash.
##
## Expected children: Visual (Node2D) / Sprite (AnimatedSprite2D), Hurtbox.

signal died(entity: Entity)
signal health_changed(hp: int, max_hp: int)
signal hurt(hit: HitData)

const FLASH_SHADER := preload("res://assets/effects/shaders/hit_flash.gdshader")

@export var max_hp: int = 100
## Height above the feet where damage numbers appear.
@export var body_height: float = 40.0

var hp: int = 100
var facing: int = 1
var is_dead: bool = false
var invuln_time: float = 0.0
var is_player: bool = false

var _flash_tween: Tween

@onready var visual: Node2D = $Visual
@onready var sprite: AnimatedSprite2D = $Visual/Sprite
@onready var hurtbox: Hurtbox = $Hurtbox


func _ready() -> void:
	hp = max_hp
	_setup_sprite()


func _setup_sprite() -> void:
	if sprite == null:
		return
	apply_sprite_frames(sprite.sprite_frames)
	var mat := ShaderMaterial.new()
	mat.shader = FLASH_SHADER
	sprite.material = mat


## Uses the anchor stored by tools/build_sprite_frames.gd so the feet of
## every frame sit exactly on the node origin.
func apply_sprite_frames(frames: SpriteFrames) -> void:
	sprite.sprite_frames = frames
	if frames and frames.has_meta("anchor"):
		sprite.centered = false
		sprite.offset = -Vector2(frames.get_meta("anchor"))


func set_facing(dir: float) -> void:
	if dir == 0.0:
		return
	facing = 1 if dir > 0.0 else -1
	visual.scale.x = facing


func play_anim(anim: StringName, restart: bool = false) -> void:
	if sprite == null or sprite.sprite_frames == null:
		return
	if not sprite.sprite_frames.has_animation(anim):
		return
	if restart or sprite.animation != anim or not sprite.is_playing():
		sprite.play(anim)
		if restart:
			sprite.frame = 0
			sprite.frame_progress = 0.0


func is_invulnerable() -> bool:
	return invuln_time > 0.0


## Called by Hurtbox. Returns true when the hit was taken.
func take_hit(hit: HitData) -> bool:
	if is_dead or is_invulnerable():
		return false
	apply_damage(hit)
	return true


func apply_damage(hit: HitData) -> void:
	var amount := maxi(0, hit.damage)
	hp = maxi(hp - amount, 0)
	health_changed.emit(hp, max_hp)
	flash()
	FX.damage_number(global_position + Vector2(0, -body_height), amount, hit.critical, is_player)
	if hp <= 0:
		is_dead = true
		_on_death(hit)
		died.emit(self)
	else:
		_on_hurt(hit)
		hurt.emit(hit)


func heal(amount: int) -> void:
	if is_dead:
		return
	hp = mini(hp + amount, max_hp)
	health_changed.emit(hp, max_hp)
	FX.heal_number(global_position + Vector2(0, -body_height), amount)


## Virtual hooks for subclasses.
func _on_hurt(_hit: HitData) -> void:
	pass


func _on_death(_hit: HitData) -> void:
	pass


func flash(color: Color = Color.WHITE, duration: float = 0.12) -> void:
	if sprite == null or not (sprite.material is ShaderMaterial):
		return
	var mat := sprite.material as ShaderMaterial
	mat.set_shader_parameter("flash_color", color)
	mat.set_shader_parameter("flash_amount", 0.9)
	if _flash_tween:
		_flash_tween.kill()
	_flash_tween = create_tween()
	_flash_tween.tween_method(func(v: float): mat.set_shader_parameter("flash_amount", v), 0.9, 0.0, duration)


func tick_invulnerability(delta: float) -> void:
	if invuln_time > 0.0:
		invuln_time = maxf(0.0, invuln_time - delta)


func set_hurtbox_enabled(enabled: bool) -> void:
	if hurtbox:
		hurtbox.set_deferred("monitorable", enabled)
