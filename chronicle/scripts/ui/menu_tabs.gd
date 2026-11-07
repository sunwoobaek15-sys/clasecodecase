class_name MenuTabs
extends RefCounted
## Extra tabs of the character menu (Phase 3): pets, quests, codex.


static func _icon(tex: Texture2D, size: Vector2) -> TextureRect:
	var r := TextureRect.new()
	r.custom_minimum_size = size
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.texture = tex
	return r


## 펫 — owned pets, active pet, passive, EXP, treats.
class PetTab extends HBoxContainer:
	var _list: VBoxContainer
	var _art: TextureRect
	var _info: Label
	var _exp: ProgressBar
	var _select_btn: Button
	var _feed_btn: Button
	var _selected: StringName = &""

	func _ready() -> void:
		name = "펫"
		add_theme_constant_override("separation", 10)
		_list = VBoxContainer.new()
		_list.custom_minimum_size = Vector2(170, 0)
		_list.add_theme_constant_override("separation", 3)
		add_child(_list)
		var right := VBoxContainer.new()
		right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var top := HBoxContainer.new()
		_art = MenuTabs._icon(null, Vector2(100, 96))
		top.add_child(_art)
		_info = UiKit.label("", 11)
		_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_info.custom_minimum_size = Vector2(250, 96)
		_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		top.add_child(_info)
		right.add_child(top)
		_exp = ProgressBar.new()
		_exp.show_percentage = false
		_exp.custom_minimum_size = Vector2(300, 8)
		right.add_child(_exp)
		var btns := HBoxContainer.new()
		_select_btn = UiKit.button("함께하기", _on_select, 120)
		_feed_btn = UiKit.button("간식 주기", _on_feed, 150)
		btns.add_child(_select_btn)
		btns.add_child(_feed_btn)
		right.add_child(btns)
		add_child(right)

	func refresh() -> void:
		for c in _list.get_children():
			c.queue_free()
		if _selected == &"" or not Pets.owns(_selected):
			_selected = Pets.active if Pets.active != &"" else &""
		for pet in PetDB.all():
			var owned := Pets.owns(pet.id)
			var b := Button.new()
			b.focus_mode = Control.FOCUS_NONE
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.custom_minimum_size = Vector2(170, 30)
			b.icon = pet.icon if owned else null
			b.expand_icon = false
			b.text = ("%s Lv.%d%s" % [pet.display_name, Pets.level_of(pet.id), "  ♥" if Pets.active == pet.id else ""]) if owned else "???"
			b.pressed.connect(_pick.bind(pet.id))
			_list.add_child(b)
		_show_detail()

	func _pick(id: StringName) -> void:
		_selected = id
		_show_detail()

	func _show_detail() -> void:
		var pet := PetDB.get_pet(_selected)
		if pet == null:
			_art.texture = null
			_info.text = "아직 함께하는 펫이 없어요.\n마을 관리인 미아에게 말을 걸어 보세요."
			_exp.visible = false
			_select_btn.disabled = true
			_feed_btn.disabled = true
			return
		var owned := Pets.owns(pet.id)
		_art.texture = pet.art
		_art.modulate = Color(1, 1, 1) if owned else Color(0, 0, 0, 0.8)
		if not owned:
			_info.text = "???\n얻는 방법: %s" % pet.unlock_hint
			_exp.visible = false
			_select_btn.disabled = true
			_feed_btn.disabled = true
			return
		var lv := Pets.level_of(pet.id)
		_info.text = "%s  Lv.%d / %d\n%s\n\n패시브 '%s': %s" % [pet.display_name, lv, Pets.MAX_LEVEL, pet.description,
				pet.passive_name, pet.bonus_text(lv)]
		_exp.visible = true
		_exp.max_value = Pets.exp_to_next(lv)
		_exp.value = Pets.exp_of(pet.id)
		_select_btn.disabled = Pets.active == pet.id
		_select_btn.text = "함께하는 중" if Pets.active == pet.id else "함께하기"
		var treats := Profile.inventory.count(Pets.TREAT_ID)
		_feed_btn.text = "간식 주기 (%d)" % treats
		_feed_btn.disabled = treats <= 0 or lv >= Pets.MAX_LEVEL

	func _on_select() -> void:
		Pets.set_active(_selected)
		refresh()

	func _on_feed() -> void:
		if Pets.feed(_selected):
			Events.toast.emit("냠냠! 펫 EXP +%d" % Pets.TREAT_EXP)
		refresh()


## 퀘스트 — tracked, active, finished quests and achievements.
class QuestTab extends VBoxContainer:
	var _rows: VBoxContainer

	func _ready() -> void:
		name = "퀘스트"
		var scroll := ScrollContainer.new()
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		scroll.custom_minimum_size = Vector2(560, 220)
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		add_child(scroll)
		_rows = VBoxContainer.new()
		_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_rows.add_theme_constant_override("separation", 2)
		scroll.add_child(_rows)

	func refresh() -> void:
		for c in _rows.get_children():
			c.queue_free()
		var groups := [
			["진행 중", ["active", "ready"], [QuestData.Type.MAIN, QuestData.Type.SUB, QuestData.Type.DAILY]],
			["받을 수 있는 퀘스트", ["available"], [QuestData.Type.MAIN, QuestData.Type.SUB]],
			["업적", ["active", "ready", "done"], [QuestData.Type.ACHIEVEMENT]],
			["완료", ["done"], [QuestData.Type.MAIN, QuestData.Type.SUB, QuestData.Type.DAILY]],
		]
		for g in groups:
			var list: Array[QuestData] = []
			for t in g[2]:
				list.append_array(Quests.list(g[1], t))
			if list.is_empty():
				continue
			_rows.add_child(UiKit.label(str(g[0]), 11, UiKit.GOLD, true))
			for q in list:
				_add_quest(q)

	func _add_quest(q: QuestData) -> void:
		var st := Quests.status(q.id)
		var head := "[%s] %s" % [q.type_name(), q.title]
		if st == "ready":
			head += "  - 보고하러 가기"
		elif st == "done":
			head += "  ★"
		var color := UiKit.TEXT if st != "done" else UiKit.DIM
		_rows.add_child(UiKit.label(head, 11, color, true))
		if st in ["active", "ready"]:
			var parts: PackedStringArray = []
			for i in q.objectives.size():
				parts.append(("● " if Quests.objective_done(q, i) else "○ ") + Quests.objective_text(q, i))
			var who := ""
			if q.giver != &"" and q.type != QuestData.Type.ACHIEVEMENT:
				var giver := load("res://data/npcs/%s.tres" % q.giver) as NpcData
				if giver != null:
					who = "  (의뢰: %s)" % giver.display_name
			var l := UiKit.label("   " + "   ".join(parts) + who + "\n   보상: " + q.reward_text(), 11, UiKit.DIM)
			l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			_rows.add_child(l)
		elif st == "available":
			var l2 := UiKit.label("   " + q.description, 11, UiKit.DIM)
			l2.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			_rows.add_child(l2)


## 도감 — categories, entries, details.
class CodexTab extends HBoxContainer:
	var _cat: StringName = &"monster"
	var _cats: VBoxContainer
	var _grid: GridContainer
	var _art: TextureRect
	var _info: Label

	func _ready() -> void:
		name = "도감"
		add_theme_constant_override("separation", 8)
		_cats = VBoxContainer.new()
		add_child(_cats)
		var mid := ScrollContainer.new()
		mid.custom_minimum_size = Vector2(210, 210)
		add_child(mid)
		_grid = GridContainer.new()
		_grid.columns = 4
		mid.add_child(_grid)
		var right := VBoxContainer.new()
		right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_art = MenuTabs._icon(null, Vector2(150, 90))
		right.add_child(_art)
		_info = UiKit.label("", 11)
		_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_info.custom_minimum_size = Vector2(170, 0)
		right.add_child(_info)
		add_child(right)

	func refresh() -> void:
		for c in _cats.get_children():
			c.queue_free()
		_cats.add_child(UiKit.label("%d / %d" % [Codex.count_known(), Codex.count_total()], 11, UiKit.GOLD, true))
		for pair in Codex.CATEGORIES:
			var b := UiKit.button(str(pair[1]), _pick_cat.bind(pair[0]), 70)
			b.disabled = pair[0] == _cat
			_cats.add_child(b)
		for c in _grid.get_children():
			c.queue_free()
		var first := {}
		for e in Codex.entries_in(_cat):
			var known := Codex.is_known(e["id"])
			var b := Button.new()
			b.focus_mode = Control.FOCUS_NONE
			b.custom_minimum_size = Vector2(48, 44)
			b.expand_icon = true
			b.icon = Codex.texture_of(e) if known else null
			b.text = "" if known else ("준비" if e.get("future", false) else "?")
			b.pressed.connect(_show.bind(e))
			_grid.add_child(b)
			if first.is_empty():
				first = e
		_show(first)

	func _pick_cat(cat: StringName) -> void:
		_cat = cat
		refresh()

	func _show(e: Dictionary) -> void:
		if e.is_empty():
			_art.texture = null
			_info.text = ""
			return
		var known := Codex.is_known(e["id"])
		_art.texture = Codex.texture_of(e) if known else null
		if known:
			var kills := int(Codex.kills.get(e["id"], 0))
			var extra := "\n처치 %d회" % kills if e["cat"] in [&"monster", &"boss"] else ""
			var region := "\n출현: %s" % e["region"] if e.has("region") else ""
			_info.text = "%s%s%s\n\n%s" % [e["name"], region, extra, e["desc"]]
		elif e.get("future", false):
			_info.text = "%s\n\n%s" % [e["name"], e["desc"]]
		else:
			_info.text = "???\n\n아직 기록되지 않았다."
