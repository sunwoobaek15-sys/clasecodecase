class_name Hurtbox
extends Area2D
## Area that can be damaged. It only needs to be monitorable on the right
## physics layer (4 = player hurtbox, 5 = enemy hurtbox); Hitboxes find it.

## Node that receives the damage (needs take_hit(HitData) -> bool).
## Defaults to the scene owner, i.e. the character this hurtbox belongs to.
var entity: Node = null


func _ready() -> void:
	monitoring = false
	monitorable = true
	collision_mask = 0
	if entity == null:
		entity = owner if owner != null else get_parent()


func receive(hit: HitData) -> bool:
	if entity != null and is_instance_valid(entity) and entity.has_method("take_hit"):
		return entity.take_hit(hit)
	return false
