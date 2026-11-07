extends Control
## Character screen (Phase 2), opened from the pause menu while the game is
## paused. Tabs: 상태 (level & stats), 장비·가방 (equipment slots + bag),
## 스킬 (skill tree upgrades with skill points). All changes go through
## Profile, which updates the live player immediately.

signal closed

const SLOT_NAMES := {&"weapon": "무기", &"armor": "방어구", &"accessory": "장신구"}
const BASE_STATS := preload("res://data/player/hero_stats.tres")

var _tabs: TabContainer
var _extra_tabs: Array[Control] = []
var _stats_label: Label
var _exp_bar: ProgressBar
var _level_label: Label
var _equip_buttons: Dictionary = {}
var _item_list: ItemList
var _list_ids: Array[StringName] = []
var _detail: Label
var _action: Button
var _selected_id: StringName = &""
var _selected_slot: StringName = &""
var _skill_rows: VBoxContainer
var _sp_label: Label


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	visible = false
	add_to_group(&"character_menu")
	add_to_group(&"modal_ui")
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0.04, 0.7)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(600, 320)
	center.add_child(panel)
	# Opaque panel so the pause menu / stage do not show through the text.
	var sb := panel.get_theme_stylebox(&"panel")
	if sb is StyleBoxFlat:
		var solid := (sb as StyleBoxFlat).duplicate() as StyleBoxFlat
		solid.bg_color.a = 0.98
		panel.add_theme_stylebox_override(&"panel", solid)
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 4)
	panel.add_child(root)
	var header := HBoxContainer.new()
	header.add_child(UiKit.label("청월의 검사", 22, UiKit.GOLD, true, 4))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(spacer)
	header.add_child(UiKit.button("닫기", close, 80))
	root.add_child(header)
	_tabs = TabContainer.new()
	_tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_tabs.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	root.add_child(_tabs)
	_build_stats_tab()
	_build_items_tab()
	_build_skills_tab()
	for tab in [MenuTabs.PetTab.new(), MenuTabs.QuestTab.new(), MenuTabs.CodexTab.new()]:
		_tabs.add_child(tab)
		_extra_tabs.append(tab)
	Profile.changed.connect(_refresh)
	Pets.changed.connect(_refresh)
	Quests.changed.connect(_refresh)
	Codex.changed.connect(_refresh)


func open() -> void:
	visible = true
	_selected_id = &""
	_selected_slot = &""
	ModalPanel.pause_game(self)
	_refresh()


func close() -> void:
	visible = false
	ModalPanel.resume_game(self)
	closed.emit()


## Selects a tab by its title ("상태", "장비·가방", "스킬", "펫", "퀘스트", "도감").
func show_tab(title: String) -> void:
	for i in _tabs.get_tab_count():
		if _tabs.get_tab_title(i) == title:
			_tabs.current_tab = i
			return


func _player() -> Player:
	return get_tree().get_first_node_in_group(&"player") as Player


# -------------------------------------------------------------------- tabs ---
func _build_stats_tab() -> void:
	var box := VBoxContainer.new()
	box.name = "상태"
	box.add_theme_constant_override("separation", 6)
	_level_label = UiKit.label("", 11, UiKit.TEXT, true)
	box.add_child(_level_label)
	_exp_bar = ProgressBar.new()
	_exp_bar.custom_minimum_size = Vector2(260, 10)
	_exp_bar.show_percentage = false
	box.add_child(_exp_bar)
	_stats_label = UiKit.label("", 11)
	box.add_child(_stats_label)
	_tabs.add_child(box)


func _build_items_tab() -> void:
	var row := HBoxContainer.new()
	row.name = "장비·가방"
	row.add_theme_constant_override("separation", 10)
	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 4)
	left.add_child(UiKit.label("장착 중", 11, UiKit.GOLD, true))
	for slot in Profile.SLOTS:
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(190, 28)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.pressed.connect(_on_slot_pressed.bind(slot))
		_equip_buttons[slot] = b
		left.add_child(b)
	left.add_child(UiKit.label("가방", 11, UiKit.GOLD, true))
	_item_list = ItemList.new()
	_item_list.custom_minimum_size = Vector2(190, 110)
	_item_list.fixed_icon_size = Vector2i(24, 24)
	_item_list.focus_mode = Control.FOCUS_NONE
	_item_list.item_selected.connect(_on_item_selected)
	left.add_child(_item_list)
	row.add_child(left)
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail = UiKit.label("아이템을 고르세요.", 11)
	_detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.custom_minimum_size = Vector2(300, 150)
	right.add_child(_detail)
	_action = UiKit.button("-", _on_action, 160)
	_action.disabled = true
	right.add_child(_action)
	row.add_child(right)
	_tabs.add_child(row)


func _build_skills_tab() -> void:
	var box := VBoxContainer.new()
	box.name = "스킬"
	_sp_label = UiKit.label("", 11, UiKit.GOLD, true)
	box.add_child(_sp_label)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(560, 210)
	box.add_child(scroll)
	_skill_rows = VBoxContainer.new()
	_skill_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_skill_rows.add_theme_constant_override("separation", 6)
	scroll.add_child(_skill_rows)
	_tabs.add_child(box)


# ----------------------------------------------------------------- refresh ---
func _refresh() -> void:
	if not visible:
		return
	_refresh_stats()
	_refresh_items()
	_refresh_skills()
	for tab in _extra_tabs:
		tab.call(&"refresh")


func _refresh_stats() -> void:
	var need := Profile.exp_to_next(Profile.level)
	_level_label.text = "Lv.%d   EXP %d / %d   골드 %d   스킬 포인트 %d" % [Profile.level, Profile.xp, need, Profile.gold, Profile.skill_points]
	_exp_bar.max_value = need
	_exp_bar.value = Profile.xp
	var p := _player()
	var s := p.stats if p != null else Profile.build_stats(BASE_STATS)
	_stats_label.text = "최대 HP  %d\n최대 MP  %d\n공격력  %d\n받는 피해 감소  %d%%\n치명타 확률  %d%%\n회피 재사용 대기  %.2f초" % [
		s.max_hp, roundi(s.max_mp), s.attack, roundi(Profile.defense() * 100.0),
		roundi(s.crit_chance * 100.0), s.dodge_cooldown]
	var pet := Pets.active_pet()
	if pet != null:
		_stats_label.text += "\n\n펫  %s Lv.%d  (%s)" % [pet.display_name, Pets.level_of(pet.id), pet.bonus_text(Pets.level_of(pet.id))]
	if Village.blessing:
		_stats_label.text += "\n축복  다음 스테이지 EXP +%d%%" % roundi(Village.BLESSING_EXP * 100.0)


func _refresh_items() -> void:
	for slot in Profile.SLOTS:
		var b: Button = _equip_buttons[slot]
		var item := ItemDB.get_item(Profile.equipment.get(slot, &""))
		b.text = "%s: %s" % [SLOT_NAMES[slot], Profile.item_label(item.id) if item != null else "(없음)"]
		b.icon = item.icon if item != null else null
	_item_list.clear()
	_list_ids.clear()
	for entry in Profile.inventory.slots:
		var item := ItemDB.get_item(entry["id"])
		if item == null:
			continue
		var n := int(entry["count"])
		_item_list.add_item(Profile.item_label(item.id) + ("" if n == 1 else "  x%d" % n), item.icon)
		_list_ids.append(item.id)
	_show_detail()


func _refresh_skills() -> void:
	_sp_label.text = "스킬 포인트: %d   (레벨이 오를 때마다 1점)" % Profile.skill_points
	for c in _skill_rows.get_children():
		c.queue_free()
	for node in Profile.skill_tree:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var icon := TextureRect.new()
		icon.texture = node.icon
		icon.custom_minimum_size = Vector2(32, 32)
		icon.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
		row.add_child(icon)
		var rank := Profile.skill_rank(node.id)
		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.add_child(UiKit.label("%s  %d/%d" % [node.display_name, rank, node.max_level], 11, UiKit.TEXT, true))
		var desc := node.description
		if rank > 0:
			desc += "\n현재: " + node.effect_text(rank)
		if rank < node.max_level:
			desc += "\n다음: " + node.effect_text(rank + 1)
			if Profile.level < node.required_level:
				desc += "  (Lv.%d 필요)" % node.required_level
		var dl := UiKit.label(desc, 11, UiKit.DIM)
		dl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		dl.custom_minimum_size = Vector2(380, 0)
		info.add_child(dl)
		row.add_child(info)
		var b := UiKit.button("강화" if rank < node.max_level else "MAX", _on_upgrade.bind(node.id), 70)
		b.disabled = not Profile.can_upgrade_skill(node.id)
		row.add_child(b)
		_skill_rows.add_child(row)


# ---------------------------------------------------------------- actions ---
func _on_slot_pressed(slot: StringName) -> void:
	_selected_slot = slot
	_selected_id = Profile.equipment.get(slot, &"")
	_item_list.deselect_all()
	_show_detail()


func _on_item_selected(index: int) -> void:
	if index < 0 or index >= _list_ids.size():
		return
	_selected_id = _list_ids[index]
	_selected_slot = &""
	_show_detail()


func _show_detail() -> void:
	var item := ItemDB.get_item(_selected_id)
	if item == null:
		_detail.text = "아이템을 고르세요."
		_action.text = "-"
		_action.disabled = true
		return
	var text := "%s  [%s]\n%s" % [Profile.item_label(item.id), item.type_name(), item.description]
	if item.is_equipment() and Profile.enhance_level(item.id) > 0:
		text += "\n강화: " + Profile.enhance_text(item.slot(), Profile.enhance_level(item.id))
	var bonus := item.bonus_text()
	if bonus != "":
		text += "\n\n효과: " + bonus
	_detail.text = text
	_action.disabled = false
	if _selected_slot != &"":
		_action.text = "해제"
		_action.disabled = _selected_slot == &"weapon"
		if _action.disabled:
			_detail.text += "\n(무기는 다른 무기로만 바꿀 수 있어요.)"
	elif item.is_equipment():
		_action.text = "장착"
	elif item.type == ItemData.Type.CONSUMABLE:
		_action.text = "사용"
	else:
		_action.text = "재료"
		_action.disabled = true


func _on_action() -> void:
	var item := ItemDB.get_item(_selected_id)
	if item == null:
		return
	if _selected_slot != &"":
		if Profile.unequip(_selected_slot):
			_selected_slot = &""
	elif item.is_equipment():
		if Profile.equip(item.id):
			_selected_slot = item.slot()
	elif item.type == ItemData.Type.CONSUMABLE:
		if not Profile.use_consumable(item.id, _player()):
			Events.toast.emit("지금은 사용할 필요가 없어요.")
		if Profile.inventory.count(item.id) <= 0:
			_selected_id = &""
	_refresh()


func _on_upgrade(id: StringName) -> void:
	if Profile.upgrade_skill(id):
		Events.toast.emit("%s 강화!" % Profile.skill_node(id).display_name)
	_refresh()
