var osfs = '/'
var selected = [];
var prev_side = 'north';
var uv_clipboard;
var outliner, texturelist;
var pe_list_data = []
var open_dialog = false;
var open_interface = false;
var tex_version = 1;
var pe_list;
const Pressing = {
	shift: false,
	ctrl: false,
	alt: false,
}
var main_uv;
var Prop = {
	active_panel	: 'preview',
	wireframe	  	: false,
	file_path	  	: '',
	file_name	  	: '',
	added_models 	: 0,
	recording		: null,
	project_saved 	: true,
	fps				: 0,
	zoom			: 100,
	progress		: 0,
	session 		: false,
	connections 	: 0,
	facing		 	: 'north'
}

const mouse_pos = {x:0,y:0}
const sort_collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

$.ajaxSetup({ cache: false });

function onVueSetup(func) {
	if (!onVueSetup.funcs) {
		onVueSetup.funcs = []
	}
	onVueSetup.funcs.push(func)
}
function canvasGridSize(shift, ctrl) {
	if (!shift && !ctrl) {
		return 16 / limitNumber(settings.edit_size.value, 1, 512)
	} else if (ctrl && shift) {
		var basic = 16 / limitNumber(settings.edit_size.value, 1, 512)
		var control = 16 / limitNumber(settings.ctrl_size.value, 1, 4096)
		var shift = 16 / limitNumber(settings.shift_size.value, 1, 4096)
		control = basic / control
		return shift / control
	} else if (ctrl) {
		return 16 / limitNumber(settings.ctrl_size.value, 1, 4096)
	} else {
		return 16 / limitNumber(settings.shift_size.value, 1, 4096)
	}
}
function updateNslideValues() {

	if (selected.length) {
		BarItems.slider_pos_x.update()
		BarItems.slider_pos_y.update()
		BarItems.slider_pos_z.update()

		BarItems.slider_size_x.update()
		BarItems.slider_size_y.update()
		BarItems.slider_size_z.update()

		BarItems.slider_inflate.update()

		if (!Project.box_uv) {
			BarItems.slider_face_tint.update()
		}
	}
	if (selected.length || (Format.bone_rig && Group.selected)) {
		BarItems.slider_origin_x.update()
		BarItems.slider_origin_y.update()
		BarItems.slider_origin_z.update()

		BarItems.slider_rotation_x.update()
		BarItems.slider_rotation_y.update()
		BarItems.slider_rotation_z.update()
		if (Format.bone_rig) {
			BarItems.bone_reset_toggle.setIcon(Group.selected && Group.selected.reset ? 'check_box' : 'check_box_outline_blank')
		} else {
			BarItems.rescale_toggle.setIcon(selected[0].rescale ? 'check_box' : 'check_box_outline_blank')
		}
	}
	if (Modes.animate && Group.selected) {
		//BarItems.slider_ik_chain_length.update();
		//BarItems.ik_enabled.setIcon(Group.selected.ik_enabled ? 'check_box' : 'check_box_outline_blank')
	}
}
function setProjectResolution(width, height, modify_uv) {
	if (Project.texture_width / width != Project.texture_width / height) {
		modify_uv = false;
	}

	Undo.initEdit({uv_mode: true, elements: Cube.all, uv_only: true})

	let old_res = {
		x: Project.texture_width,
		y: Project.texture_height
	}
	Project.texture_width = width;
	Project.texture_height = height;


	if (modify_uv) {
		var multiplier = [
			Project.texture_width/old_res.x,
			Project.texture_height/old_res.y
		]
		function shiftCube(cube, axis) {
			if (Project.box_uv) {
				cube.uv_offset[axis] *= multiplier[axis];
			} else {
				for (var face in cube.faces) {
					var uv = cube.faces[face];
					uv[axis] *= multiplier[axis];
					uv[axis+2] *= multiplier[axis];
				}
			}
		}
		if (old_res.x != Project.texture_width && Math.areMultiples(old_res.x, Project.texture_width)) {
			Cube.all.forEach(cube => shiftCube(cube, 0));
		}
		if (old_res.y != Project.texture_height &&  Math.areMultiples(old_res.x, Project.texture_width)) {
			Cube.all.forEach(cube => shiftCube(cube, 1));
		}
	}
	Undo.finishEdit('Changed project resolution')
	Canvas.updateAllUVs()
	if (selected.length) {
		main_uv.loadData()
	}
}
function updateProjectResolution() {
	$('#project_resolution_status').text(`${Project.texture_width} ⨉ ${Project.texture_height}`);
}

//Selections
function updateSelection() {
	elements.forEach(obj => {
		if (selected.includes(obj) && !obj.selected && !obj.locked) {
			obj.selectLow()
		} else if ((!selected.includes(obj) || obj.locked) && obj.selected) {
			obj.unselect()
		}
	})
	if (Group.selected && Group.selected.locked) Group.selected.unselect()

	Cube.all.forEach(cube => {
		if (cube.visibility) {
			var mesh = cube.mesh
			if (mesh && mesh.outline) {
				mesh.outline.visible = cube.selected
			}
		}
	})
	for (var i = Cube.selected.length-1; i >= 0; i--) {
		if (!selected.includes(Cube.selected[i])) {
			Cube.selected.splice(i, 1)
		}
	}
	if (Cube.selected.length) {
		$('.selection_only').css('visibility', 'visible')
	} else {
		if (Format.bone_rig && Group.selected) {
			$('.selection_only').css('visibility', 'hidden')
			$('.selection_only#element').css('visibility', 'visible')
		} else {
			$('.selection_only').css('visibility', 'hidden')
			if (Locator.selected.length) {
				$('.selection_only#element').css('visibility', 'visible')
			}
		}
		if (Format.single_texture && Modes.paint) {
			$('.selection_only#uv').css('visibility', 'visible')
		}
	}
	if (Cube.selected.length || (Format.single_texture && Modes.paint)) {
		main_uv.jquery.size.find('.uv_mapping_overlay').remove()
		main_uv.loadData()
	}
	if (Modes.animate) {
		updateKeyframeSelection();
	}

	BarItems.cube_counter.update();
	updateNslideValues();
	updateCubeHighlights();
	Canvas.updateOrigin();
	Transformer.updateSelection();
	Transformer.update();
	Preview.all.forEach(preview => {
		preview.updateAnnotations();
	})

	BARS.updateConditions();
	delete TickUpdates.selection;
	Blockbench.dispatchEvent('update_selection');
}
function selectAll() {
	if (Modes.animate) {
		selectAllKeyframes()
	} else if (Modes.edit || Modes.paint) {
		if (selected.length < elements.length) {
			if (Outliner.root.length == 1) {
				Outliner.root[0].select();
			} else {
				elements.forEach(obj => {
					obj.selectLow()
				})
				TickUpdates.selection = true;
			}
		} else {
			unselectAll()
		}
	}
	Blockbench.dispatchEvent('select_all')
}
function unselectAll() {
	selected.forEachReverse(obj => obj.unselect())
	if (Group.selected) Group.selected.unselect()
	Group.all.forEach(function(s) {
		s.selected = false
	})
	TickUpdates.selection = true;
}
function createSelection() {
	if ($('#selgen_new').is(':checked')) {
		selected.length = 0
	}
	if (Group.selected) {
		Group.selected.unselect()
	}
	var name_seg = $('#selgen_name').val().toUpperCase()
	var tex_seg = $('#selgen_texture').val().toLowerCase()
	var rdm = $('#selgen_random').val()/100

	var array = elements
	if ($('#selgen_group').is(':checked') && Group.selected) {
		array = Group.selected.children
	}

	array.forEach(function(obj) {
		if (obj.name.toUpperCase().includes(name_seg) === false) return;
		if (obj instanceof Cube && tex_seg && !Format.single_texture) {
			var has_tex = false;
			for (var key in obj.faces) {
				var tex = obj.faces[key].getTexture();
				if (tex && tex.name.includes(tex_seg)) {
					has_tex = true
				}
			}
			if (!has_tex) return;
		}
		if (Math.random() > rdm) return;
		selected.push(obj)
	})
	updateSelection()
	if (selected.length) {
		selected[0].showInOutliner()
	}
	hideDialog()
}
//Backup
setInterval(function() {
	if (Outliner.root.length || textures.length) {
		try {
			var model = Codecs.project.compile({compressed: false});
			localStorage.setItem('backup_model', model)
		} catch (err) {
			console.log('Unable to create backup. ', err)
		}
	}
}, 1e3*30)
//Misc
const TickUpdates = {
	Run() {
		try {
			if (TickUpdates.outliner) {
				delete TickUpdates.outliner;
				loadOutlinerDraggable()
			}
			if (TickUpdates.selection) {
				delete TickUpdates.selection;
				updateSelection()
			}
			if (TickUpdates.main_uv) {
				delete TickUpdates.main_uv;
				main_uv.loadData()
			}
			if (TickUpdates.texture_list) {
				delete TickUpdates.texture_list;
				loadTextureDraggable();
			}
			if (TickUpdates.keyframes) {
				delete TickUpdates.keyframes;
				Vue.nextTick(Timeline.update)
			}
			if (TickUpdates.keyframe_selection) {
				delete TickUpdates.keyframe_selection;
				Vue.nextTick(updateKeyframeSelection)
			}
			if (TickUpdates.keybind_conflicts) {
				delete TickUpdates.keybind_conflicts;
				updateKeybindConflicts();
			}
		} catch (err) {
			console.error(err);
		}
	}
}

const documentReady = new Promise((resolve, reject) => {
	$(document).ready(function() {
		resolve()
	})
});

const entityMode = {
	hardcodes: JSON.parse('{"geometry.chicken":{"body":{"rotation":[90,0,0]}},"geometry.llama":{"chest1":{"rotation":[0,90,0]},"chest2":{"rotation":[0,90,0]},"body":{"rotation":[90,0,0]}},"geometry.cow":{"body":{"rotation":[90,0,0]}},"geometry.sheep.sheared":{"body":{"rotation":[90,0,0]}},"geometry.sheep":{"body":{"rotation":[90,0,0]}},"geometry.phantom":{"body":{"rotation":[0,0,0]},"wing0":{"rotation":[0,0,5.7]},"wingtip0":{"rotation":[0,0,5.7]},"wing1":{"rotation":[0,0,-5.7]},"wingtip1":{"rotation":[0,0,-5.7]},"head":{"rotation":[11.5,0,0]},"tail":{"rotation":[0,0,0]},"tailtip":{"rotation":[0,0,0]}},"geometry.pig":{"body":{"rotation":[90,0,0]}},"geometry.ocelot":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.cat":{"body":{"rotation":[90,0,0]},"tail1":{"rotation":[90,0,0]},"tail2":{"rotation":[90,0,0]}},"geometry.turtle":{"eggbelly":{"rotation":[90,0,0]},"body":{"rotation":[90,0,0]}},"geometry.villager.witch":{"hat2":{"rotation":[-3,0,1.5]},"hat3":{"rotation":[-6,0,3]},"hat4":{"rotation":[-12,0,6]}},"geometry.pufferfish.mid":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.pufferfish.large":{"spines_top_front":{"rotation":[45,0,0]},"spines_top_back":{"rotation":[-45,0,0]},"spines_bottom_front":{"rotation":[-45,0,0]},"spines_bottom_back":{"rotation":[45,0,0]},"spines_left_front":{"rotation":[0,45,0]},"spines_left_back":{"rotation":[0,-45,0]},"spines_right_front":{"rotation":[0,-45,0]},"spines_right_back":{"rotation":[0,45,0]}},"geometry.tropicalfish_a":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}},"geometry.tropicalfish_b":{"leftFin":{"rotation":[0,-35,0]},"rightFin":{"rotation":[0,35,0]}}}')
}
