class_name HitData
extends RefCounted
## One damage event, created by the attacker and handed to the target.

var damage: int = 0
var knockback: Vector2 = Vector2.ZERO  ## already oriented (x sign = push direction)
var hit_stop: float = 0.0              ## freeze-frame length in seconds
var stagger: float = 0.0               ## poise damage (bosses)
var shake: float = 0.0                 ## camera shake strength on impact
var critical: bool = false
var source: Node = null
var tag: StringName = &""              ## attack id, e.g. &"combo3", &"root_wave"
var position: Vector2 = Vector2.ZERO   ## contact point for effects
var unblockable: bool = false


func copy() -> HitData:
	var h := HitData.new()
	h.damage = damage
	h.knockback = knockback
	h.hit_stop = hit_stop
	h.stagger = stagger
	h.shake = shake
	h.critical = critical
	# The attacker may already be gone (a slime killed while its shot flies).
	h.source = source if is_instance_valid(source) else null
	h.tag = tag
	h.position = position
	h.unblockable = unblockable
	return h


static func make(amount: int, push: Vector2, src: Node = null, attack_tag: StringName = &"") -> HitData:
	var h := HitData.new()
	h.damage = amount
	h.knockback = push
	h.source = src
	h.tag = attack_tag
	return h
