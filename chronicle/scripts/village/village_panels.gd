class_name VillagePanels
extends RefCounted
## The four village windows. Each is a ModalPanel subclass built in code.


## 마을 재건 — list of facilities with cost and restore button.
class RestorePanel extends ModalPanel:
	func _init() -> void:
		super("마을 재건", Vector2(580, 300))

	func refresh() -> void:
		clear_content()
		header_info.text = "%dG · 젤 %d · 핵 조각 %d  " % [Profile.gold, Profile.inventory.count(&"item_slime_gel"),
				Profile.inventory.count(&"item_time_shard")]
		for f in Village.facilities:
			var done := Village.is_restored(f.id)
			var sub := f.unlock_text
			var btn := "복구됨"
			if not done:
				var miss := Village.missing_cost(f.id)
				sub = "%s\n비용: %s%s" % [f.unlock_text, Village.cost_text(f), "" if miss == "" else "  (부족: %s)" % miss]
				btn = "복구"
			add_row(f.restored_texture if done else f.ruined_texture, f.display_name, sub, btn,
					_restore.bind(f.id), not done and Village.can_restore(f.id))

	func _restore(id: StringName) -> void:
		if Village.restore(id):
			SaveSystem.save_game()
		refresh()


## 상점 — buy consumables, sell spare items.
class ShopPanel extends ModalPanel:
	const STOCK := [&"item_potion_small", &"item_ether", &"item_pet_treat"]

	func _init() -> void:
		super("카이로의 상점", Vector2(580, 300))

	func refresh() -> void:
		clear_content()
		header_info.text = "보유 %dG  " % Profile.gold
		content.add_child(UiKit.label("구매", 11, UiKit.GOLD, true))
		for id in STOCK:
			var item := ItemDB.get_item(id)
			add_row(item.icon, "%s  ·  %dG" % [item.display_name, item.price],
					"%s  (보유 %d)" % [item.description, Profile.inventory.count(id)], "구매",
					_buy.bind(id), Profile.gold >= item.price and Profile.inventory.space_for(id) > 0)
		content.add_child(UiKit.label("판매 (절반 가격)", 11, UiKit.GOLD, true))
		var any := false
		var seen := {}
		for s in Profile.inventory.slots:
			var id := StringName(str(s["id"]))
			var item := ItemDB.get_item(id)
			if item == null or item.unique or item.price <= 0 or seen.has(id):
				continue
			seen[id] = true
			any = true
			add_row(item.icon, "%s  x%d" % [item.display_name, Profile.inventory.count(id)],
					"판매 가격 %dG" % sell_price(item), "판매", _sell.bind(id))
		if not any:
			content.add_child(UiKit.label("팔 수 있는 물건이 없어요. (고유 장비는 팔 수 없어요)", 11, UiKit.DIM))

	static func sell_price(item: ItemData) -> int:
		return maxi(1, item.price / 2)

	func _buy(id: StringName) -> void:
		var item := ItemDB.get_item(id)
		if Profile.gold >= item.price and Profile.inventory.add(id, 1) == 1:
			Profile.add_gold(-item.price)
			Events.toast.emit("%s 구매" % item.display_name)
		refresh()

	func _sell(id: StringName) -> void:
		var item := ItemDB.get_item(id)
		if item != null and not item.unique and Profile.inventory.remove(id, 1):
			Profile.add_gold(sell_price(item))
		refresh()


## 대장간 — enhance owned equipment.
class SmithPanel extends ModalPanel:
	func _init() -> void:
		super("브론의 대장간 — 강화 · 제작", Vector2(580, 300))

	func refresh() -> void:
		clear_content()
		header_info.text = "%dG · 슬라임 젤 %d  " % [Profile.gold, Profile.inventory.count(Profile.ENHANCE_MATERIAL)]
		var ids: Array[StringName] = []
		for slot in Profile.SLOTS:
			var eq: StringName = Profile.equipment.get(slot, &"")
			if eq != &"":
				ids.append(eq)
		for s in Profile.inventory.slots:
			var id := StringName(str(s["id"]))
			var item := ItemDB.get_item(id)
			if item != null and item.is_equipment() and not ids.has(id):
				ids.append(id)
		for id in ids:
			var item := ItemDB.get_item(id)
			var lv := Profile.enhance_level(id)
			var sub := "현재: %s" % (Profile.enhance_text(item.slot(), lv) if lv > 0 else "강화 없음")
			var btn := "최대"
			if lv < Profile.MAX_ENHANCE:
				var c := Profile.enhance_cost(id)
				sub += "\n+%d: %s  ·  비용 %dG + 젤 x%d" % [lv + 1, Profile.enhance_text(item.slot(), lv + 1), c["gold"], c["gel"]]
				btn = "강화"
			var equipped := Profile.equipment.values().has(id)
			add_row(item.icon, "%s%s" % [Profile.item_label(id), "  (장착 중)" if equipped else ""], sub, btn,
					_enhance.bind(id), Profile.can_enhance(id))
		_add_craft_section()

	func _add_craft_section() -> void:
		content.add_child(UiKit.label("무기 제작", 11, UiKit.GOLD, true))
		var any := false
		for id in ItemDB.all():
			var item := ItemDB.get_item(id)
			if item.recipe.is_empty():
				continue
			any = true
			var owned := Profile.owns(item.id)
			var sub := "%s\n재료: %s" % [item.description, Profile.recipe_text(item)]
			var miss := Profile.craft_missing(item.id)
			if not owned and miss != "":
				sub += "  (부족: %s)" % miss
			add_row(item.icon, item.display_name + ("  (보유)" if owned else ""), sub, "보유" if owned else "제작",
					_craft.bind(item.id), Profile.can_craft(item.id))
		if not any:
			content.add_child(UiKit.label("제작할 수 있는 무기가 없어요.", 11, UiKit.DIM))

	func _craft(id: StringName) -> void:
		if Profile.craft(id):
			Events.toast.emit("제작 완료! %s (가방에서 장착하세요)" % ItemDB.get_item(id).display_name)
			FX.shake(2.5, 0.2)
			SaveSystem.save_game()
		refresh()

	func _enhance(id: StringName) -> void:
		if Profile.enhance_item(id):
			Events.toast.emit("강화 성공! %s" % Profile.item_label(id))
			FX.shake(2.0, 0.15)
		refresh()


## 월드맵 — pick a region / stage.
class WorldMapPanel extends ModalPanel:
	const REGIONS := [
		{"name": "잊혀진 숲", "sub": "숲의 정령과 고대 나무 베르단", "stage": "forest_1", "stage_name": "1-1 숲의 수호자"},
		{"name": "무너진 시계 도시", "sub": "시간이 멈춘 도시와 크로노스", "stage": "clock_1", "stage_name": "2-1 시간의 지배자",
		 "unlock": "q_main_05", "locked": "메인 퀘스트 '다음 여정'을 마치면 열려요", "level": 6},
		{"name": "하늘의 폐허", "sub": "구름 위에 떠 있는 옛 신전", "stage": "sky_1", "stage_name": "3-1 폭풍의 수호룡",
		 "unlock": "q_main_06", "locked": "메인 퀘스트 '멈춰버린 시계탑'을 마치면 열려요", "level": 10},
	]
	const COLORS := [Color(0.16, 0.36, 0.24), Color(0.2, 0.24, 0.4), Color(0.34, 0.36, 0.5)]

	func _init() -> void:
		super("월드맵", Vector2(580, 290))

	func refresh() -> void:
		clear_content()
		header_info.text = "Lv.%d  " % Profile.level
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		content.add_child(row)
		for i in REGIONS.size():
			var r: Dictionary = REGIONS[i]
			var open_stage := WorldMapPanel.region_open(r)
			var card := PanelContainer.new()
			card.custom_minimum_size = Vector2(176, 210)
			var sb := StyleBoxFlat.new()
			sb.bg_color = COLORS[i] if open_stage else COLORS[i].darkened(0.55)
			sb.border_color = UiKit.GOLD if open_stage else Color(0.4, 0.4, 0.45)
			sb.set_border_width_all(2)
			sb.set_corner_radius_all(4)
			sb.set_content_margin_all(8)
			card.add_theme_stylebox_override(&"panel", sb)
			var col := VBoxContainer.new()
			col.add_theme_constant_override("separation", 6)
			card.add_child(col)
			col.add_child(UiKit.label("지역 %d" % (i + 1), 11, UiKit.DIM))
			col.add_child(UiKit.label(str(r["name"]), 13, UiKit.GOLD if open_stage else UiKit.DIM, true, 4))
			var sub := UiKit.label(str(r["sub"]), 11, UiKit.TEXT if open_stage else UiKit.DIM)
			sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			sub.custom_minimum_size = Vector2(156, 0)
			col.add_child(sub)
			var spacer := Control.new()
			spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
			col.add_child(spacer)
			var cleared := open_stage and Profile.cleared_stages.has(str(r["stage"]))
			var status := str(r["stage_name"]) + ("  ★클리어" if cleared else "")
			if not open_stage and r.has("locked"):
				status = str(r["locked"])
			elif open_stage and r.has("level"):
				status += "\n권장 Lv.%d" % int(r["level"])
			var st := UiKit.label(status, 11, Color(0.8, 1.0, 0.8) if cleared else UiKit.TEXT)
			st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			st.custom_minimum_size = Vector2(156, 0)
			col.add_child(st)
			var b := UiKit.button("출발" if open_stage else "잠김", _go.bind(str(r["stage"])), 156)
			b.disabled = not open_stage
			col.add_child(b)
			row.add_child(card)

	## A region with a stage is open when its unlock quest is done (or the
	## stage was already cleared).
	static func region_open(r: Dictionary) -> bool:
		var stage := str(r.get("stage", ""))
		if stage == "":
			return false
		if not r.has("unlock") or Profile.cleared_stages.has(stage):
			return true
		return Quests.status(StringName(str(r["unlock"]))) == "done"

	func _go(stage_id: String) -> void:
		close()
		Game.start_stage(stage_id)
