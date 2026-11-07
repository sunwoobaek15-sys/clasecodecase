class_name QuestData
extends Resource
## One quest (res://data/quests/*.tres).
##
## objectives: [{"type": "kill", "target": "any", "count": 10, "text": "..."}]
##   event objectives (counted when they happen):
##     kill (target = enemy id, "slime" or "any"), boss (enemy id),
##     clear_stage (stage id), talk (npc id), enhance, harvest
##   state objectives (read from the current game state):
##     level, restore (facility id), restore_count, pet_count, codex_count,
##     collect (item id; taken from the bag when the quest is handed in)

enum Type { MAIN, SUB, DAILY, ACHIEVEMENT }

@export var id: StringName = &""
@export var title: String = ""
@export var type: Type = Type.SUB
@export_multiline var description: String = ""
## NPC who gives and receives the quest (&"" = starts and ends by itself).
@export var giver: StringName = &""
@export var objectives: Array = []
@export var requires: Array[StringName] = []
@export var requires_facility: StringName = &""
@export var reward_exp: int = 0
@export var reward_gold: int = 0
@export var reward_items: Dictionary = {}
@export var reward_pet: StringName = &""
## Accepted automatically when the requirements are met (no NPC needed).
@export var auto_accept: bool = false
## Must be handed in to the giver (otherwise completes by itself).
@export var turn_in: bool = true
@export var order: int = 0


func type_name() -> String:
	return ["메인", "서브", "일일", "업적"][type]


func reward_text() -> String:
	var parts: PackedStringArray = []
	if reward_exp > 0:
		parts.append("EXP %d" % reward_exp)
	if reward_gold > 0:
		parts.append("%dG" % reward_gold)
	for id in reward_items:
		var item := ItemDB.get_item(StringName(str(id)))
		if item != null:
			parts.append("%s x%d" % [item.display_name, int(reward_items[id])])
	if reward_pet != &"":
		var pet := PetDB.get_pet(reward_pet)
		if pet != null:
			parts.append("펫: %s" % pet.display_name)
	return ", ".join(parts) if not parts.is_empty() else "-"
