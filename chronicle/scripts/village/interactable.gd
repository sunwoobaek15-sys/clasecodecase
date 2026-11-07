class_name Interactable
extends Node2D
## Something in the village the hero can use (NPC, notice board, gate,
## farm plot, ruined building). The village picks the closest one in range
## and shows the 대화/이용 button; interact() runs `action`.

@export var label: String = "이용"
@export var radius: float = 34.0
var action: Callable = Callable()


func _ready() -> void:
	add_to_group(&"interactables")


func can_interact() -> bool:
	return is_visible_in_tree()


func interact() -> void:
	if action.is_valid():
		action.call()


## Small floating marker drawn above (quest icons). Override in subclasses.
func set_highlight(_on: bool) -> void:
	pass
