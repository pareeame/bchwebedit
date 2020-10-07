class UVEditor {
	constructor(id, headline, toolbar) {
		this.face = 'north';
		this.id = id
		this.size = 320;
		this.zoom = 1;
		this.grid = 1;
		this.max_zoom = 16;
		this.auto_grid = true;
		this.texture = false;
		this.headline = headline
		this.jquery = {}
		this.uuid = guid()

		uv_dialog.all_editors.push(this)

		this.buildDom(toolbar)

		if (id !== 'main_uv') {
			this.setGrid(BarItems.uv_grid.get().replace(/x/, ''));
		}
	}
	get width() {
		return this.size;
	}
	set width(v) {
		this.size = v;
	}
	buildDom(toolbar) {
		var scope = this
		if (this.jquery.main) {
			this.jquery.main.detach()
		}
		this.jquery.main = $('<div class="UVEditor" id="UVEditor_' + scope.id + '"></div>')
		if (this.headline) {
			this.jquery.main.append('<div class="uv_headline"><div class="uv_title">'+capitalizeFirstLetter(scope.id)+'</div><div class="tool"><i class="material-icons">fullscreen</i><div class="tooltip">Fullscreen</div></div></div>')
			this.jquery.main.find('div.uv_headline > .tool').click(function() {
				uv_dialog.openTab(scope.id)
			})
			this.jquery.main.find('div.uv_headline').click(function(event) {
				event.stopPropagation()
				uv_dialog.select(scope.id, event)
			})
		}
		this.jquery.viewport = $('<div id="uv_viewport" class="checkerboard_target"></div>')
		this.jquery.transform_info = $('<div class="uv_transform_info"></div>')
		this.jquery.main.append(this.jquery.transform_info)
		this.jquery.main.append(this.jquery.viewport)

		this.jquery.frame = $(`<div id="uv_frame">
				<div id="uv_size">
					<div class="uv_size_handle"></div>
				</div>
			</div>`);
		this.img = new Image();
		this.img.style.objectFit = Format.animated_textures ? 'cover' : 'fill';
		this.jquery.frame.append(this.img)
		this.jquery.size  = this.jquery.frame.find('div#uv_size')
		this.jquery.viewport.append(this.jquery.frame)
		if (Blockbench.browser === 'firefox') {
			this.jquery.frame.css('image-rendering', '-moz-crisp-edges')
		}
		if (Toolbox.selected.paintTool) {
			this.jquery.size.hide()
		}
		this.jquery.main.toggleClass('checkerboard_trigger', settings.uv_checkerboard.value);

		this.jquery.sliders = $('<div class="bar" style="margin-left: 2px;"></div>')

		this.jquery.main.append(this.jquery.sliders)
		var onBefore = function() {
			Undo.initEdit({elements: Cube.selected})
		}
		var onAfter = function() {
			Undo.finishEdit('edit UV')
			if (Project.box_uv) {
				scope.displayAllMappingOverlays()
			}
		}
		var getInterval = function(event) {
			return 1/scope.grid
		}
		this.sliders = {
			pos_x: new NumSlider({
				id: 'uv_slider_pos_x',
				private: true,
				condition: function() {return true},
				get: function() {
					if (Project.box_uv && Cube.selected[0]) {
						return trimFloatNumber(Cube.selected[0].uv_offset[0])
					} else if (Cube.selected[0]) {
						var face_uv = Cube.selected[0].faces[scope.face].uv
						if (face_uv) {
							return trimFloatNumber(face_uv[0])
						}
					}
					return 0
				},
				change: function(modify) {
					scope.slidePos(modify, 0)
				},
				getInterval,
				onBefore,
				onAfter
			}).toElement(this.jquery.sliders),

			pos_y: new NumSlider({
				id: 'uv_slider_pos_y',
				private: true,
				condition: function() {return true},
				get: function() {
					if (Project.box_uv && Cube.selected[0]) {
						return trimFloatNumber(Cube.selected[0].uv_offset[1])
					} else if (Cube.selected[0]) {
						var face_uv = Cube.selected[0].faces[scope.face].uv
						if (face_uv) {
							return trimFloatNumber(face_uv[1])
						}
					}
					return 0
				},
				change: function(modify) {
					scope.slidePos(modify, 1)
				},
				getInterval,
				onBefore,
				onAfter
			}).toElement(this.jquery.sliders),

			size_x: new NumSlider({
				id: 'uv_slider_size_x',
				private: true,
				condition: function() {return !Project.box_uv},
				get: function() {
					if (!Project.box_uv && Cube.selected[0]) {
						var face_uv = Cube.selected[0].faces[scope.face].uv
						if (face_uv) {
							return trimFloatNumber(face_uv[2] - face_uv[0])
						}
					}
					return 0
				},
				change: function(modify) {
					scope.slideSize(modify, 0)
				},
				getInterval,
				onBefore,
				onAfter
			}).toElement(this.jquery.sliders),

			size_y: new NumSlider({
				id: 'uv_slider_size_y',
				private: true,
				condition: function() {return !Project.box_uv},
				get: function() {
					if (!Project.box_uv && Cube.selected[0]) {
						var face_uv = Cube.selected[0].faces[scope.face].uv
						if (face_uv) {
							return trimFloatNumber(face_uv[3] - face_uv[1])
						}
					}
					return 0
				},
				change: function(modify) {
					scope.slideSize(modify, 1)
				},
				getInterval,
				onBefore,
				onAfter

			}).toElement(this.jquery.sliders)
		}
			


		if (toolbar) {
			this.jquery.bar = $(Toolbars.main_uv.node)
			this.jquery.main.append(this.jquery.bar)
		} else {
			this.jquery.bar = $('')
		}

		var dragging_not_clicking = false;
		this.jquery.size.resizable({
			handles: "all",
			maxHeight: 320,
			maxWidth: 320,
			minWidth: 0,
			minHeight: 0,
			containment: 'parent',
			start: function(event, ui) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
			},
			resize: function(event, ui) {
				scope.save()
				scope.displaySliders()
			},
			stop: function(event, ui) {
				dragging_not_clicking = true;
				Undo.finishEdit('uv_change')
				scope.disableAutoUV()
				scope.updateDragHandle(ui.position)
			}
		})

		this.jquery.size.draggable({
			start: function(event, ui) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
			},
			drag: function( event, ui ) {
				var p = ui.position;
				var o = ui.originalPosition;

				p.left = o.left + (p.left - o.left);
				p.top = o.top + (p.top - o.top);

				p.left = limitNumber(p.left, 0, scope.inner_width-scope.jquery.size.width()+1);
				p.top = limitNumber(p.top, 0, scope.inner_height-scope.jquery.size.height()+1);
				
				p.left = p.left - p.left % (scope.inner_width / scope.getResolution(0) / scope.grid);
				p.top  = p.top  - p.top  % (scope.inner_height / scope.getResolution(1) / scope.grid);

				scope.save();
				scope.displaySliders();
				return true;
			},
			stop: function(event, ui) {
				scope.save()
				Undo.finishEdit('uv_change')
				scope.disableAutoUV()
				scope.updateDragHandle(ui.position)
				if (Project.box_uv) {
					scope.displayAllMappingOverlays()
					if (scope.jquery.size.is(':hover')) {
						scope.displayMappingOverlay()
					}
				}
			}
		})

		this.jquery.frame.droppable({
			accept: 'li.texture',
			tolerance: 'pointer',
			drop: function(event, ui) {
				if (Cube.selected.length == 0) {
					return
				}
				var id = $(ui.helper).attr('texid')
				scope.applyTexture(id)
			}
		})

		this.jquery.size.mouseenter(function() {
			scope.displayMappingOverlay()
		})
		this.jquery.size.mouseleave(function() {
			$(this).find('.uv_mapping_overlay').remove()
		})

		this.jquery.frame.click(function(event) {
			var offset = scope.jquery.frame.offset();
			event.offsetX = event.clientX - offset.left;
			event.offsetY = event.clientY - offset.top;
			if (!dragging_not_clicking && event.ctrlOrCmd) {
				scope.reverseSelect(event)
			}
			dragging_not_clicking = false;
		})

		this.jquery.viewport.contextmenu(function(event) {
			scope.contextMenu()
		})

		this.jquery.viewport.on('mousedown touchstart', function(event) {
			if (Toolbox.selected.paintTool && (event.which === 1 || (event.touches && event.touches.length == 1))) {
				scope.startPaintTool(event)
			}
		})
		this.jquery.viewport.on('mousewheel', function(e) {
			let event = e.originalEvent;

			if (event.ctrlOrCmd) {

				event.stopPropagation()

				var n = (event.deltaY < 0) ? 0.1 : -0.1;
				n *= scope.zoom
				var number = limitNumber(scope.zoom + n, 1, scope.max_zoom)
				let old_zoom = scope.zoom;

				scope.setZoom(number)
				event.preventDefault()

				let offset = scope.jquery.viewport.offset()
				let offsetX = event.clientX - offset.left;
				let offsetY = event.clientY - offset.top;

				let zoom_diff = scope.zoom - old_zoom;
				this.scrollLeft += ((this.scrollLeft + offsetX) * zoom_diff) / old_zoom
				this.scrollTop  += ((this.scrollTop  + offsetY) * zoom_diff) / old_zoom

				scope.updateBrushOutline(e)

				return false;
			}
		})
		.on('scroll', e => {
			scope.updateDragHandle()
		})

		var dMWCoords = {x: 0, y: 0}
		function dragMouseWheel(e) {
			e.currentTarget.scrollLeft -= (e.pageX - dMWCoords.x)
			e.currentTarget.scrollTop -= (e.pageY - dMWCoords.y)
			dMWCoords = {x: e.pageX, y: e.pageY}
		}
		function dragMouseWheelStop(e) {
			scope.jquery.viewport.off('mousemove', dragMouseWheel)
			$(document).off('mouseup', dragMouseWheelStop)
		}
		scope.jquery.viewport.on('mousedown touchstart', function(e) {
			if (e.which === 2) {
				scope.jquery.viewport.on('mousemove touchmove', dragMouseWheel)
				$(document).on('mouseup touchend', dragMouseWheelStop)
				dMWCoords = {x: e.pageX, y: e.pageY}
				e.preventDefault();
				return false;
			}
		})
		//Paint brush outline
		this.brush_outline = $('<div id="uv_brush_outline"></div>');
		scope.jquery.frame.on('mouseenter mousemove', e => {
			this.updateBrushOutline(e)
		})
		scope.jquery.frame.on('mouseleave', e => {
		})
		this.setSize(this.size)
		return this;
	}
	updateBrushOutline(e) {
		if (Modes.paint && Toolbox.selected.brushTool) {
			this.jquery.frame.append(this.brush_outline);
			var pixel_size = this.inner_width / (this.texture ? this.texture.width : Project.texture_width);
			//pos
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
			let left = (0.5 - offset + Math.floor(e.offsetX / pixel_size + offset)) * pixel_size;
			let top =  (0.5 - offset + Math.floor(e.offsetY / pixel_size + offset)) * pixel_size;
			this.brush_outline.css('left', left+'px').css('top', top+'px');
			//size
			var radius = (BarItems.slider_brush_size.get()/2) * pixel_size;
			this.brush_outline.css('padding', radius+'px').css('margin', (-radius)+'px');
		} else {
			this.brush_outline.detach();
		}
	}
	message(msg, vars) {
		msg = tl(msg, vars)
		var box = $('<div class="uv_message_box">' + msg + '</div>')
		this.jquery.main.append(box)
		setTimeout(function() {
			box.remove()
		}, 1200)
	}
	//Brush
	getBrushCoordinates(event, tex) {
		var scope = this;
		convertTouchEvent(event);
		var multiplier = (Project.box_uv && tex) ? tex.width/Project.texture_width : 1
		var pixel_size = scope.inner_width / tex.width
		var result = {};

		if (Toolbox.selected.id === 'copy_paste_tool') {
			result.x = Math.round(event.offsetX/pixel_size*1);
			result.y = Math.round(event.offsetY/pixel_size*1);
		} else {
			let offset = BarItems.slider_brush_size.get()%2 == 0 && Toolbox.selected.brushTool ? 0.5 : 0;
			result.x = Math.floor(event.offsetX/pixel_size*1 + offset);
			result.y = Math.floor(event.offsetY/pixel_size*1 + offset);
		}
		if (tex.frameCount) result.y += (tex.height / tex.frameCount) * tex.currentFrame;
		return result;
	}
	startPaintTool(event) {
		var scope = this;
		Painter.active_uv_editor = scope;

		var texture = scope.getTexture()
		if (texture) {
			var coords = scope.getBrushCoordinates(event, texture)

			if (Toolbox.selected.id !== 'copy_paste_tool') {
				Painter.startPaintTool(texture, coords.x, coords.y, undefined, event)
			} else {
				this.startSelection(texture, coords.x, coords.y, event)
			}
		}
		if (Toolbox.selected.id !== 'color_picker' && texture) {
			addEventListeners(scope.jquery.frame.get(0), 'mousemove touchmove', scope.movePaintTool, false );
			addEventListeners(document, 'mouseup touchend', scope.stopBrush, false );
		}
	}
	movePaintTool(event) {
		var scope = Painter.active_uv_editor;
		var texture = scope.getTexture()
		if (!texture) {
			Blockbench.showQuickMessage('message.untextured')
		} else {
			var new_face;
			var {x, y} = scope.getBrushCoordinates(event, texture);
			if (texture.img.naturalWidth + texture.img.naturalHeight == 0) return;

			if (x === Painter.current.x && y === Painter.current.y) {
				return
			}
			if (Painter.current.face !== scope.face) {
				Painter.current.x = x
				Painter.current.y = y
				Painter.current.face = scope.face
				new_face = true;
				if (texture !== Painter.current.texture && Undo.current_save) {
					Undo.current_save.addTexture(texture)
				}
			}
			if (Toolbox.selected.id !== 'copy_paste_tool') {
				Painter.movePaintTool(texture, x, y, event, new_face)
			} else {
				scope.dragSelection(texture, x, y, event)
			}
		}
	}
	stopBrush(event) {
		var scope = Painter.active_uv_editor;
		removeEventListeners( scope.jquery.frame.get(0), 'mousemove touchmove', scope.movePaintTool, false );
		removeEventListeners( document, 'mouseup touchend', scope.stopBrush, false );
		if (Toolbox.selected.id !== 'copy_paste_tool') {
			Painter.stopPaintTool()
		} else {
			scope.stopSelection()
		}
	}
	// Copy Paste Tool
	startSelection(texture, x, y, event) {
		if (Painter.selection.overlay && event.target && event.target.id === 'uv_frame') {
			if (open_interface) {
				open_interface.confirm()
			} else {
				this.removePastingOverlay()
			}
		}
		delete Painter.selection.calcrect;
		if (!Painter.selection.overlay) {
			this.jquery.frame.find('#texture_selection_rect').detach();
			let rect = $(`<div id="texture_selection_rect"></div>`);
			this.jquery.frame.append(rect)
			Painter.selection.rect = rect;
			Painter.selection.start_x = x;
			Painter.selection.start_y = y;
		} else {
			Painter.selection.start_x = Painter.selection.x;
			Painter.selection.start_y = Painter.selection.y;
			Painter.selection.start_event = event;
		}
	}
	dragSelection(texture, x, y, event) {
		let m = this.inner_width / this.texture.width;

		if (!Painter.selection.overlay) {
			let calcrect = getRectangle(Painter.selection.start_x, Painter.selection.start_y, x, y)
			Painter.selection.calcrect = calcrect;
			Painter.selection.x = calcrect.ax;
			Painter.selection.y = calcrect.ay;
			Painter.selection.rect
				.css('left', 	calcrect.ax*m + 'px')
				.css('top', 	calcrect.ay*m + 'px')
				.css('width', 	calcrect.x *m + 'px')
				.css('height', 	calcrect.y *m + 'px')
		} else if (this.texture && Painter.selection.canvas) {
			Painter.selection.x = Painter.selection.start_x + Math.round((event.clientX - Painter.selection.start_event.clientX) / m);
			Painter.selection.y = Painter.selection.start_y + Math.round((event.clientY - Painter.selection.start_event.clientY) / m);
			Painter.selection.x = Math.clamp(Painter.selection.x, 0, this.texture.width-Painter.selection.canvas.width)
			Painter.selection.y = Math.clamp(Painter.selection.y, 0, this.texture.height-Painter.selection.canvas.height)
			this.updatePastingOverlay()
		}
	}
	stopSelection() {
		if (Painter.selection.rect) {
			Painter.selection.rect.detach()
		}
		if (Painter.selection.overlay || !Painter.selection.calcrect) return;
		if (Painter.selection.calcrect.x == 0 || Painter.selection.calcrect.y == 0) return;

		let calcrect = Painter.selection.calcrect;
		var canvas = document.createElement('canvas')
		var ctx = canvas.getContext('2d');
		canvas.width = calcrect.x;
		canvas.height = calcrect.y;
		ctx.drawImage(this.texture.img, -calcrect.ax, -calcrect.ay)

		if (isApp) {
			let image = nativeImage.createFromDataURL(canvas.toDataURL())
			clipboard.writeImage(image)
		}
		Painter.selection.canvas = canvas;

		this.addPastingOverlay();
	}
	addPastingOverlay() {
		if (Painter.selection.overlay) return;
		let scope = this;
		let overlay = $(`<div id="texture_pasting_overlay">
			<div class="control">
				<div class="button_place" title="${tl('uv_editor.copy_paste_tool.place')}"><i class="material-icons">check_circle</i></div>
				<div class="button_cancel" title="${tl('dialog.cancel')}"><i class="material-icons">cancel</i></div>
				<div class="button_cut" title="${tl('uv_editor.copy_paste_tool.cut')}"><i class="fas fa-cut"></i></div>
				<div class="button_mirror_x" title="${tl('uv_editor.copy_paste_tool.mirror_x')}"><i class="icon-mirror_x icon"></i></div>
				<div class="button_mirror_y" title="${tl('uv_editor.copy_paste_tool.mirror_y')}"><i class="icon-mirror_y icon"></i></div>
				<div class="button_rotate" title="${tl('uv_editor.copy_paste_tool.rotate')}"><i class="material-icons">rotate_right</i></div>
			</div>
		</div>`)

		open_interface = {
			confirm() {
				scope.removePastingOverlay()
				if (scope.texture) {
					scope.texture.edit((canvas) => {
						var ctx = canvas.getContext('2d');
						ctx.drawImage(Painter.selection.canvas, Painter.selection.x, Painter.selection.y)
					})
				}
			},
			hide() {
				scope.removePastingOverlay()
			}
		}
		overlay.find('.button_place').click(open_interface.confirm);
		overlay.find('.button_cancel').click(open_interface.hide);

		function getCanvasCopy() {
			var temp_canvas = document.createElement('canvas')
			var temp_ctx = temp_canvas.getContext('2d');
			temp_canvas.width = Painter.selection.canvas.width;
			temp_canvas.height = Painter.selection.canvas.height;
			temp_ctx.drawImage(Painter.selection.canvas, 0, 0)
			return temp_canvas
		}
		overlay.find('.button_cut').click(e => {

				scope.removePastingOverlay()
				scope.texture.edit((canvas) => {
					var ctx = canvas.getContext('2d');
					ctx.clearRect(Painter.selection.x, Painter.selection.y, Painter.selection.canvas.width, Painter.selection.canvas.height);
				})

		})
		overlay.find('.button_mirror_x').click(e => {
			let temp_canvas = getCanvasCopy()

			let ctx = Painter.selection.canvas.getContext('2d');
			ctx.save();
			ctx.translate(ctx.canvas.width, 0);
			ctx.scale(-1, 1);

			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(temp_canvas, ctx.canvas.width, 0, -ctx.canvas.width, ctx.canvas.height);
			ctx.restore();
		})
		overlay.find('.button_mirror_y').click(e => {
			let temp_canvas = getCanvasCopy()

			let ctx = Painter.selection.canvas.getContext('2d');
			ctx.save();
			ctx.translate(0, ctx.canvas.height);
			ctx.scale(1, -1);

			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(temp_canvas, 0, ctx.canvas.height, ctx.canvas.width, -ctx.canvas.height);
			ctx.restore();
		})
		overlay.find('.button_rotate').click(e => {
			let temp_canvas = getCanvasCopy()

			let ctx = Painter.selection.canvas.getContext('2d');
			[ctx.canvas.width, ctx.canvas.height] = [ctx.canvas.height, ctx.canvas.width]
			ctx.save();
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

			ctx.translate(ctx.canvas.width/2,ctx.canvas.height/2);
			ctx.rotate(Math.PI/2);

			ctx.drawImage(temp_canvas,-temp_canvas.width/2,-temp_canvas.height/2);

			//ctx.rotate(-Math.PI/2);

			ctx.restore();
			scope.updateSize()
		})
		overlay.append(Painter.selection.canvas)
		Painter.selection.overlay = overlay;
		this.jquery.frame.append(overlay)
		Painter.selection.x = Math.clamp(Painter.selection.x, 0, this.texture.width-Painter.selection.canvas.width)
		Painter.selection.y = Math.clamp(Painter.selection.y, 0, this.texture.height-Painter.selection.canvas.height)
		this.updateSize()


		function clickElsewhere(event) {
			if (!Painter.selection.overlay) {
				removeEventListeners(document, 'mousedown touchstart', clickElsewhere)
			} else if (Painter.selection.overlay.has(event.target).length == 0) {
				open_interface.confirm()
			}
			/*
			if (!Painter.selection.overlay) {
				removeEventListeners(document, 'mousedown touchstart', clickElsewhere)
			} else if (Painter.selection.overlay.has(event.target).length == 0) {
				open_interface.confirm()
			}
			*/
		}
		addEventListeners(document, 'mousedown touchstart', clickElsewhere)
	}
	removePastingOverlay() {
		Painter.selection.overlay.detach();
		delete Painter.selection.overlay;
		open_interface = false;
	}
	updatePastingOverlay() {
		let m = this.inner_width/this.texture.width
		$(Painter.selection.canvas)
			.css('width', Painter.selection.canvas.width * m)
			.css('height', Painter.selection.canvas.height * m)
		Painter.selection.overlay
			.css('left', Painter.selection.x * m)
			.css('top', Painter.selection.y * m);
		return this;
	}
	//Get
	get inner_width() {
		return this.size*this.zoom;
	}
	get inner_height() {
		return this.height*this.zoom;
	}
	getPixelSize() {
		if (Project.box_uv) {
			return this.inner_width/Project.texture_width
		} else {
			return this.inner_width/ (
				(typeof this.texture === 'object' && this.texture.width)
					? this.texture.width
					: Project.texture_width
			);
		}
	}
	getFaces(event) {
		if (event && event.shiftKey) {
			return ['north', 'east', 'south', 'west', 'up', 'down']
		} else {
			return [this.face]
		}
	}
	getUVTag(obj) {
		if (!obj) obj = Cube.selected[0]
		if (Project.box_uv) {
			return [obj.uv_offset[0], obj.uv_offset[1], 0, 0];
		} else {
			return obj.faces[this.face].uv;
		}
	}
	getTexture() {
		if (Format.single_texture) return Texture.getDefault();
		return Cube.selected[0].faces[this.face].getTexture();
	}
	//Set
	setSize(input_size, cancel_load) {
		var old_size = this.size;
		var size = input_size - (input_size % 16);
		this.size = size;
		this.jquery.frame.width(this.inner_width);
		this.jquery.viewport.width(size+8);
		this.jquery.main.width(size+8);

		for (var id in this.sliders) {
			this.sliders[id].setWidth(size/(Project.box_uv?2:4)-1)
		}
		if (!cancel_load && old_size !== size) {
			this.loadData();
		} else {
			this.updateSize();
		}
		return this;
	}
	setZoom(zoom) {
		var zoomed_size = this.size * zoom;
		var size = zoomed_size - (zoomed_size % 16);
		this.zoom = size/this.size
		this.updateSize();
		this.displayFrame();

		return this;
	}
	setGrid(value) {
		var update = this.id == 'main_uv' || open_dialog == 'uv_dialog';
		if (value == 'auto') {
			this.auto_grid = true;
			if (update) this.displayTexture();
		} else {
			value = parseInt(value);
			if (typeof value !== 'number') value = 1;
			this.grid = Math.clamp(value, 1, 1024);
			this.auto_grid = false;
		}
		if (update) this.updateSize();
		return this;
	}
	updateSize() {
		var size = this.size * this.zoom;
		this.jquery.frame.width(this.inner_width);

		this.height = this.size / (Project.texture_width/Project.texture_height)
		this.jquery.frame.height(this.inner_height)
		this.jquery.viewport.height(this.height+8)
		this.jquery.size.resizable('option', 'maxHeight', this.inner_height)
		this.jquery.size.resizable('option', 'maxWidth', this.inner_width)
		this.jquery.size.resizable('option', 'grid', [
			this.inner_width/Project.texture_width/this.grid,
			this.inner_height/Project.texture_height/this.grid
		])
		this.displayMappingOverlay();
		this.updateAllMappingOverlays();
		if (this.texture && this.texture.currentFrame) {
			this.img.style.objectPosition = `0 -${this.texture.currentFrame * this.inner_height}px`;
		} else {
			this.img.style.objectPosition = `0 0`;
		}
		if (Painter.selection.overlay && this.texture) {
			this.updatePastingOverlay()
		}

		if (this.zoom > 1) {
			this.jquery.viewport.addClass('zoomed').css('overflow', 'scroll scroll')
		} else {
			this.jquery.viewport.removeClass('zoomed').css('overflow', 'hidden')
		}
	}
	setFace(face, update = true) {
		this.face = face
		if (this.id === 'main_uv') {
			$('input#'+face+'_radio').prop("checked", true)
		}
		if (update) {
			this.loadData()
		}
		return this;
	}
	setToMainSlot() {
		var scope = this;
		$('.panel#uv').append(this.jquery.main)
		$('.panel#uv').on('mousewheel', function(e) {

			if (!Project.box_uv && !e.ctrlOrCmd && $('#uv_panel_sides:hover, #uv_viewport:not(.zoomed):hover').length) {
				var faceIDs = {'north': 0, 'south': 1, 'west': 2, 'east': 3, 'up': 4, 'down': 5}
				var id = faceIDs[scope.face]
				event.deltaY > 0 ? id++ : id--;
				if (id === 6) id = 0
				if (id === -1) id = 5
				$('input#'+getKeyByValue(faceIDs, id)+'_radio').prop("checked", true)
				scope.loadSelectedFace()
				e.preventDefault()
			}
		})
		this.jquery.frame.on('dblclick', function() {
			uv_dialog.openFull()
		})
		return this;
	}
	appendTo(selector) {
		$(selector).append(this.jquery.main)
		return this;
	}
	//Selection
	reverseSelect(event) {
		var scope = this;
		if (!this.texture && !Format.single_texture) return this;
		if (!event.target.classList.contains('uv_size_handle') && !event.target.id === 'uv_frame') {
			return this;
		}
		var matches = [];
		var face_match;
		var u = event.offsetX / this.inner_width * this.getResolution(0);
		var v = event.offsetY / this.inner_height * this.getResolution(1);
		Cube.all.forEach(cube => {
			for (var face in cube.faces) {
				var uv = cube.faces[face].uv
				if (uv && Math.isBetween(u, uv[0], uv[2]) && Math.isBetween(v, uv[1], uv[3]) && (cube.faces[face].getTexture() === scope.texture || Format.single_texture)) {
					matches.safePush(cube)
					if (!face_match) {
						face_match = face
					}
					break;
				}
			}
		})
		if (matches.length) {
			if (!Project.box_uv) {
				main_uv.setFace(face_match);
			}
			selected.empty();
			matches.forEach(s => {
				selected.safePush(s)
			});
			updateSelection();
			scope.displayMappingOverlay();
		}
		return this;
	}
	forCubes(cb) {
		var i = 0;
		while (i < Cube.selected.length) {
			cb(Cube.selected[i]);
			i++;
		}
	}
	//Load
	loadSelectedFace() {
		this.face = $('#uv_panel_sides input:checked').attr('id').replace('_radio', '')
		this.loadData()
		return false;
	}
	loadData() {
		if (Cube.selected.length === 0 && !Modes.paint) return;
		var face = Cube.selected[0] && Cube.selected[0].faces[this.face];
		
		//Set Rotation
		BarItems.uv_rotation.set((face && face.rotation)||0)

		this.displayTexture(face)
		this.displayFrame()//and transform info
		this.displayTools()
		this.displaySliders()
		this.updateDragHandle()
		if (Project.box_uv) {
			this.displayAllMappingOverlays()
		}
		if (this !== main_uv && this.face === main_uv.face) {
			main_uv.loadData()
		}
	}
	save() {
		if (!Modes.edit) return;
		var scope = this;
		//Save UV from Frame to object

		if (Project.box_uv) {

			Cube.selected.forEach(function(obj) {
				obj.uv_offset = [
					Math.round(scope.jquery.size.position().left / (scope.inner_width/Project.texture_width) * 8) / 8,
					Math.round(scope.jquery.size.position().top  / (scope.inner_width/Project.texture_width) * 8) / 8
				]
				Canvas.updateUV(obj)
			})

		} else {
			var trim = v => Math.round(v*1000+0.3)/1000;
			var pixelSize = this.inner_width/this.getResolution(0);

			var position = this.jquery.size.position()
			var left = trim( position.left / pixelSize);
			var top  = trim( position.top / pixelSize);
			var left2= Math.clamp(trim( (this.jquery.size.width() + position.left) / pixelSize), 0, this.getResolution(0));
			var top2 = Math.clamp(trim( (this.jquery.size.height() + position.top) / pixelSize), 0, this.getResolution(1));

			var uvTag = this.getUVTag()

			if (uvTag[0] > uvTag[2]) {
				left2 = [left, left = left2][0];
			}
			if (uvTag[1] > uvTag[3]) {
				top2 = [top, top = top2][0];
			}
			var uvArr = [left, top, left2, top2]

			Cube.selected.forEach(function(obj) {
				obj.faces[scope.face].uv = uvArr.slice()
				Canvas.updateUV(obj)
			})
		}

		if (this !== main_uv && this.face === main_uv.face) {
			main_uv.loadData()
		}
	}
	applyTexture(uuid) {
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		this.forCubes(obj => {
			obj.faces[scope.face].texture = uuid
		})
		this.loadData()
		Canvas.updateSelectedFaces()
		Undo.finishEdit('apply_texture')
	}
	displayTexture(face) {
		if (!face && Cube.selected.length) {
			var face = Cube.selected[0].faces[this.face];
		}
		var tex = face ? face.getTexture() : Texture.getDefault();
		if (!tex || typeof tex !== 'object' || (tex.error && tex.error != 2)) {
			this.img.src = '';
			this.img.style.display = 'none';
			this.texture = false;
		} else {
			this.img.src = tex.source;
			this.img.style.display = 'block';
			this.texture = tex;
			if (!Project.box_uv && this.auto_grid) {
				this.grid = tex.width / Project.texture_width;
			}
		}
		if (!tex || typeof tex !== 'object') {
			if (!Format.single_texture) {
				unselectTextures()
			}
		} else {
			tex.select()
		}
		this.setSize(this.size, true)
	}
	displayTransformInfo() {
		var ref = Cube.selected[0].faces[this.face]
		this.jquery.transform_info.text('')
		if (Project.box_uv) return;

		if (ref.uv[0] > ref.uv[2]) {
			this.jquery.transform_info.append('<b>X</b>')
		}
		if (ref.uv[1] > ref.uv[3]) {
			this.jquery.transform_info.append('<b>Y</b>')
		}
		if (ref.rotation) {
			this.jquery.transform_info.append('<b>'+ref.rotation+'</b>')
		}
	}
	displayFrame() {
		var scope = this;
		if (!Modes.edit) return;
		if (Project.box_uv) {
			var uvTag = this.getUVTag(Cube.selected[0])

			var size_tag = Cube.selected[0].size(undefined, true)

			var width = (size_tag[0] + size_tag[2])*2
				width = limitNumber(width, 0, Project.texture_width)
				width = width/Project.texture_width*scope.inner_width

			var x = limitNumber(uvTag[0], 0, Project.texture_width)
				x *= scope.inner_width/Project.texture_width

			this.jquery.size.width(width)
			this.jquery.size.css('left', x+'px')


			var height = size_tag[2] + size_tag[1]
				height = limitNumber(height, 0, Project.texture_height)
				height = height/Project.texture_height*scope.inner_width
				height *= Project.texture_height/Project.texture_width

			var y = limitNumber(uvTag[1], 0, Project.texture_height)
				y *= scope.inner_width/Project.texture_height
				y *= Project.texture_height/Project.texture_width

			this.jquery.size.height(height)
			this.jquery.size.css('top', y+'px')
		} else {

			var uvTag = this.getUVTag(Cube.selected[0])

			//X
			var tex_width = this.getResolution(0);
			var width = limitNumber(uvTag[2]-uvTag[0], -tex_width, tex_width)
			var x = limitNumber(uvTag[0], 0, tex_width)
			if (width < 0) {
				width *= -1
				x = x - width
			}
			var pixels = this.inner_width/tex_width;
			this.jquery.size.width(width * pixels);
			this.jquery.size.css('left', x*pixels+'px');

			//Y
			var tex_height = this.getResolution(1);
			var height = limitNumber(uvTag[3]-uvTag[1], -tex_height, tex_height);
			var y = limitNumber(uvTag[1], 0, tex_height);
			if (height < 0) {
				height *= -1;
				y = y - height;
			}
			this.jquery.size.height(height * pixels);
			this.jquery.size.css('top', y*pixels+'px');
		}
		this.updateDragHandle();
		this.displayTransformInfo();
	}
	//Overlay
	displayMappingOverlay() {
		if (!Project.box_uv || Cube.selected.length == 0) return this;
		var scope = this;
		var sides = this.getMappingOverlay();

		$(scope.jquery.size).find('.mapping_overlay_cube').remove();
		scope.jquery.size.append(sides);

		return this;
	}
	getMappingOverlay(cube, absolute) {
		var scope = this;
		var sides = $('<div class="mapping_overlay_cube"></div>');
		var pixels = scope.getPixelSize();
		if (!cube) cube = Cube.selected[0];
		function addElement(x, y, width, height, n, color) {
			if (absolute) {
				x += cube.uv_offset[0];
				y += cube.uv_offset[1];
			}
			x *= pixels;
			y *= pixels;
			width  = limitNumber(width *pixels + x, 0, scope.inner_width)  - x;
			height = limitNumber(height*pixels + y, 0, scope.inner_height)- y;

			var size_data = [x/pixels, y/pixels, width/pixels, height/pixels].join(',');

			sides.append($(`<div class="uv_mapping_overlay"
				style="left: ${x}px; top: ${y}px;
				height: ${height}px; width: ${width}px;
				background: ${color};" data-sizes="${size_data}"></div>`))
		}
		var size = cube.size(undefined, true);

		sides.attr('size_hash', `${cube.uv_offset[0]}_${cube.uv_offset[1]}_${size[0]}_${size[1]}_${size[2]}`)

		addElement(size[2], 0, size[0], size[2],				'#b4d4e1', '#ecf8fd')
		addElement(size[2]+size[0], 0, size[0], size[2],		'#536174', '#6e788c')
		addElement(0, size[2], size[2], size[1],				'#43e88d', '#7BFFA3')
		addElement(size[2], size[2], size[0], size[1],		  '#5bbcf4', '#7BD4FF')
		addElement(size[2]+size[0], size[2], size[2], size[1],  '#f48686', '#FFA7A4')
		addElement(2*size[2]+size[0], size[2], size[0], size[1],'#f8dd72', '#FFF899')

		return sides;
	}
	displayAllMappingOverlays(force_reload) {
		var scope = this;
		var cycle = bbuid(4)
		if (this.showing_overlays && Project.box_uv) {
			Cube.all.forEach(cube => {
				var size = cube.size(undefined, true)
				var hash = `${cube.uv_offset[0]}_${cube.uv_offset[1]}_${size[0]}_${size[1]}_${size[2]}`
				if (scope.jquery.frame.find(`> .mapping_overlay_cube.${cycle}[size_hash="${hash}"]`).length) return;

				var c = scope.jquery.frame.find(`> .mapping_overlay_cube:not(.${cycle})[size_hash="${hash}"]`).first()
				if (force_reload || !c.length) {
					var sides = scope.getMappingOverlay(cube, true)
					sides.addClass(cycle)
					scope.jquery.frame.append(sides)
				} else {
					c.addClass(cycle)
				}
			})
			$(`.mapping_overlay_cube:not(.${cycle})`).remove()
			$('.mapping_overlay_cube').removeClass(cycle)
		} else {
			$(scope.jquery.frame).find('.mapping_overlay_cube').remove()
		}
	}
	updateAllMappingOverlays() {
		var scope = this;
		var pixels = scope.getPixelSize();
		if (this.showing_overlays) {
			Cube.all.forEach(cube => {
				var size = cube.size(undefined, true)
				var hash = `${cube.uv_offset[0]}_${cube.uv_offset[1]}_${size[0]}_${size[1]}_${size[2]}`
				var c = scope.jquery.frame.find(`> .mapping_overlay_cube[size_hash="${hash}"]`).first()
				
				c.children().each((i, side) => {
					side = $(side)
					var data = side.attr('data-sizes');
					data = data.split(',');
					data.forEach((s, i) => {
						data[i] = parseInt(s);
					})
					side.css('left',	(data[0] * pixels)+'px')
						.css('top',		(data[1] * pixels)+'px')
						.css('width',	(data[2] * pixels)+'px')
						.css('height',	(data[3] * pixels)+'px')
				})
			})
		}
	}
	//UI
	displaySliders() {
		if (!Cube.selected.length) return;
		this.sliders.pos_x.update()
		this.sliders.pos_y.update()
		this.sliders.size_x.update()
		this.sliders.size_y.update()
	}
	displayTools() {
		//Cullface
		if (!Cube.selected.length) return;
		var face = Cube.selected[0].faces[this.face]
		BarItems.cullface.set(face.cullface||'off')
		BarItems.face_tint.setIcon(face.tint !== -1 ? 'check_box' : 'check_box_outline_blank')
		BarItems.slider_face_tint.update()
	}
	updateDragHandle() {
		var pos = this.jquery.size.position()
		var handle = this.jquery.size.find('div.uv_size_handle')

		var left = limitNumber(this.jquery.viewport.get(0).scrollLeft, 0, this.size*(this.zoom-1)) - pos.left;
		var top = limitNumber(this.jquery.viewport.get(0).scrollTop, 0, (this.height||this.size)*(this.zoom-1)) - pos.top;
		handle.css('left', left +'px')
		handle.css('top',  top  +'px')

		handle.width(this.size)
		handle.height(this.height||this.size)
		return this;
	}
	updateInterface() {
		for (var key in this.sliders) {
			var slider = this.sliders[key]
			$(slider.node).css('display', BARS.condition(slider.condition)?'block':'none')
		}
		this.jquery.size.resizable('option', 'disabled', Project.box_uv)
	}
	contextMenu() {
		var scope = this;
		this.reference_face = Cube.selected[0] && Cube.selected[0].faces[scope.face];
		this.menu.open(event, this)
		return this;
	}
	slidePos(modify, axis) {
		var scope = this
		var limit = scope.getResolution(axis);

		Cube.selected.forEach(function(obj) {
			if (Project.box_uv === false) {
				var uvTag = scope.getUVTag(obj)
				var size = uvTag[axis + 2] - uvTag[axis]

				var value = modify(uvTag[axis])

				value = limitNumber(value, 0, limit)
				value = limitNumber(value + size, 0, limit) - size

				uvTag[axis] = value
				uvTag[axis+2] = value + size
			} else {
				let minimum = 0;
				if (axis === 0) {
					var size = (obj.size(0) + (obj.size(1) ? obj.size(2) : 0))*2
					if (obj.size(1) == 0) minimum = -obj.size(2);
				} else {
					var size = obj.size(2) + obj.size(1)
					if (obj.size(0) == 0) minimum = -obj.size(2);
				}
				var value = modify(obj.uv_offset[axis])

				value = limitNumber(value, minimum, limit)
				value = limitNumber(value + size, minimum, limit) - size
				obj.uv_offset[axis] = value
			}
			Canvas.updateUV(obj)
		})
		this.displaySliders()
		this.displayFrame()
		this.disableAutoUV()
	}
	slideSize(modify, axis) {
		var scope = this
		var limit = scope.getResolution(axis);

		Cube.selected.forEach(function(obj) {
			if (Project.box_uv === false) {

				var uvTag = scope.getUVTag(obj)
				var difference = modify(uvTag[axis+2]-uvTag[axis]) + uvTag[axis]
				uvTag[axis+2] = limitNumber(difference, 0, limit);
				Canvas.updateUV(obj)
			}
		})
		this.displaySliders()
		this.displayFrame()
		this.disableAutoUV()
	}
	getResolution(axis, texture) {
		return axis ? Project.texture_height : Project.texture_width;
	}

	//Events
	disableAutoUV() {
		this.forCubes(obj => {
			obj.autouv = 0
		})
	}
	toggleUV() {
		var scope = this
		var state = Cube.selected[0].faces[this.face].enabled === false
		this.forCubes(obj => {
			obj.faces[scope.face].enabled = state
		})
	}
	maximize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				obj.faces[side].uv = [0, 0, scope.getResolution(0, obj.faces[side]), scope.getResolution(1, obj.faces[side])]
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.maximized')
		this.loadData()
	}
	turnMapping(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				var uv = obj.faces[side].uv_size;
				obj.faces[side].uv_size = [uv[1], uv[0]];
			})
			obj.autouv = 0;
			Canvas.updateUV(obj);
		})
		this.message('uv_editor.turned');
		this.loadData();
	}
	setAutoSize(event) {
		var scope = this;
		var top2, left2;

		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				let face = obj.faces[side];
				let mirror_x = face.uv[0] > face.uv[2];
				let mirror_y = face.uv[1] > face.uv[3];
				face.uv[0] = Math.min(face.uv[0], face.uv[2]);
				face.uv[1] = Math.min(face.uv[1], face.uv[3]);
				if (side == 'north' || side == 'south') {
					left2 = limitNumber(obj.size('0'), 0, Project.texture_width)
					top2 = limitNumber(obj.size('1'), 0, Project.texture_height)
				} else if (side == 'east' || side == 'west') {
					left2 = limitNumber(obj.size('2'), 0, Project.texture_width)
					top2 = limitNumber(obj.size('1'), 0, Project.texture_height)
				} else if (side == 'up' || side == 'down') {
					left2 = limitNumber(obj.size('0'), 0, Project.texture_width)
					top2 = limitNumber(obj.size('2'), 0, Project.texture_height)
				}
				if (face.rotation % 180) {
					[left2, top2] = [top2, left2];
				}
				left2 *= scope.getResolution(0, face) / Project.texture_width;
				top2 *= scope.getResolution(1, face) / Project.texture_height;
				face.uv_size = [left2, top2];
				if (mirror_x) [face.uv[0], face.uv[2]] = [face.uv[2], face.uv[0]];
				if (mirror_y) [face.uv[1], face.uv[3]] = [face.uv[3], face.uv[1]];
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.autouv')
		this.loadData()
	}
	setRelativeAutoSize(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				var uv = obj.faces[side].uv,
					ru = scope.getResolution(0, obj.faces[side]),
					rv = scope.getResolution(1, obj.faces[side]);
				switch (side) {
					case 'north':
					uv = [
						ru - obj.to[0],
						rv - obj.to[1],
						ru - obj.from[0],
						rv - obj.from[1],
					];
					break;
					case 'south':
					uv = [
						obj.from[0],
						rv - obj.to[1],
						obj.to[0],
						rv - obj.from[1],
					];
					break;
					case 'west':
					uv = [
						obj.from[2],
						rv - obj.to[1],
						obj.to[2],
						rv - obj.from[1],
					];
					break;
					case 'east':
					uv = [
						ru - obj.to[2],
						rv - obj.to[1],
						ru - obj.from[2],
						rv - obj.from[1],
					];
					break;
					case 'up':
					uv = [
						obj.from[0],
						obj.from[2],
						obj.to[0],
						obj.to[2],
					];
					break;
					case 'down':
					uv = [
						obj.from[0],
						rv - obj.to[2],
						obj.to[0],
						rv - obj.from[2],
					];
					break;
				}
				uv.forEach(function(s, uvi) {
					uv[uvi] = limitNumber(s, 0, uvi%2 ? rv : ru);
				})
				obj.faces[side].uv = uv
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.autouv')
		this.loadData()
	}
	mirrorX(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				var proxy = obj.faces[side].uv[0]
				obj.faces[side].uv[0] = obj.faces[side].uv[2]
				obj.faces[side].uv[2] = proxy
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	}
	mirrorY(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				var proxy = obj.faces[side].uv[1]
				obj.faces[side].uv[1] = obj.faces[side].uv[3]
				obj.faces[side].uv[3] = proxy
			})
			obj.autouv = 0
			Canvas.updateUV(obj)
		})
		this.message('uv_editor.mirrored')
		this.loadData()
	}
	applyAll(event) {
		var scope = this;
		this.forCubes(obj => {
			uv_dialog.allFaces.forEach(function(side) {
				$.extend(true, obj.faces[side], obj.faces[scope.face]) 
			})
			obj.autouv = 0
		})
		Canvas.updateSelectedFaces()
		this.message('uv_editor.to_all')
		this.loadData()
	}
	clear(event) {
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				obj.faces[side].uv = [0, 0, 0, 0]
				obj.faces[side].texture = null;
			})
			Canvas.adaptObjectFaces(obj)
		})
		this.loadData()
		this.message('uv_editor.transparent')
		Undo.finishEdit('uv_clear')
		Canvas.updateSelectedFaces()
	}
	switchCullface(event) {
		var scope = this;
		Undo.initEdit({elements: Cube.selected, uv_only: true})
		var val = BarItems.cullface.get()
		if (val === 'off') val = false
		this.forCubes(obj => {
			obj.faces[scope.face].cullface = val || '';
		})
		if (val) {
			this.message('uv_editor.cullface_on')
		} else {
			this.message('uv_editor.cullface_off')
		}
		Undo.finishEdit('set_cullface')
	}
	switchTint(event) {
		var scope = this;
		var val = Cube.selected[0].faces[scope.face].tint === -1 ? 0 : -1;

		if (event === 0 || event === false) val = event
		this.forCubes(obj => {
			obj.faces[scope.face].tint = val
		})
		if (val !== -1) {
			this.message('uv_editor.tint_on')
		} else {
			this.message('uv_editor.tint_off')
		}
		this.displayTools()
	}
	setTint(event, val) {
		var scope = this;

		this.forCubes(obj => {
			obj.faces[scope.face].tint = val
		})
		this.displayTools()
	}
	rotate() {
		var scope = this;
		var value = parseInt(BarItems.uv_rotation.get())
		this.forCubes(obj => {
			obj.faces[scope.face].rotation = value
			Canvas.updateUV(obj)
		})
		this.displayTransformInfo()
		this.message('uv_editor.rotated')
	}
	setRotation(value) {
		var scope = this;
		value = parseInt(value)
		this.forCubes(obj => {
			obj.faces[scope.face].rotation = value
			Canvas.updateUV(obj)
		})
		this.loadData()
		this.message('uv_editor.rotated')
	}
	selectGridSize(event) {
	}
	autoCullface(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				obj.faces[side].cullface = side
			})
		})
		this.loadData()
		this.message('uv_editor.auto_cull')
	}
	copy(event) {
		this.select()
		if (Cube.selected.length === 0) return;

		var scope = this;
		uv_dialog.clipboard = []

		if (Project.box_uv) {
			var new_tag = {
				uv: Cube.selected[0].uv_offset
			}
			uv_dialog.clipboard.push(new_tag)
			this.message('uv_editor.copied')
			return;
		}

		function addToClipboard(face) {
			if (Project.box_uv) {
				var new_tag = {
					uv: Cube.selected[0].uv_offset
				}
				uv_dialog.clipboard.push(new_tag)
				return;
			}
			var tag = Cube.selected[0].faces[face]
			var new_tag = new Face(face, tag)
			uv_dialog.clipboard.push(new_tag)
		}
		if (event.shiftKey) {
			uv_dialog.allFaces.forEach(function(s) {
				addToClipboard(s)
			})
		} else {
			addToClipboard(this.face)
		}
		this.message('uv_editor.copied_x', [uv_dialog.clipboard.length])
	}
	paste(event) {
		this.select()
		if (uv_dialog.clipboard === null || Cube.selected.length === 0) return;

		Undo.initEdit({elements: Cube.selected, uv_only: true})
		if (Project.box_uv) {
			Cube.selected.forEach(function(obj) {
				obj.uv_offset = uv_dialog.clipboard[0].uv.slice()
				Canvas.updateUV(obj)
			})
			this.loadData()
			this.message('uv_editor.pasted')
			Undo.finishEdit('uv paste')
			return;
		}

		function applyFace(tag, face) {
			if (!face) face = tag.face
			Cube.selected.forEach(function(obj) {
				obj.faces[face].extend(tag)
				Canvas.updateUV(obj)
			})
		}

		if (this.id === 'main_uv' && event) {
			if (event.shiftKey) {
				uv_dialog.allFaces.forEach(function(s) {
					applyFace(uv_dialog.clipboard[0], s)
				})
			} else {
				if (uv_dialog.clipboard.length === 1) {
					applyFace(uv_dialog.clipboard[0], main_uv.face)
				} else {
					uv_dialog.clipboard.forEach(function(s) {
						applyFace(s, s.direction)
					})
				}
			}
		} else {
			if (uv_dialog.selection.length === 1) {
				applyFace(uv_dialog.clipboard[0], uv_dialog.selection[0])
			} else {
				if (uv_dialog.clipboard.length === 1) {
					uv_dialog.selection.forEach(function(s) {
						applyFace(uv_dialog.clipboard[0], s)
					})
				} else {
					uv_dialog.clipboard.forEach(function(s) {
						if (uv_dialog.selection.includes(s.face)) {
							applyFace(s)
						}
					})
				}
			}
		}
		this.loadData()
		Canvas.updateSelectedFaces()
		this.message('uv_editor.pasted')
		Undo.finishEdit('uv paste')
	}
	reset(event) {
		var scope = this;
		this.forCubes(obj => {
			scope.getFaces(event).forEach(function(side) {
				obj.faces[side].reset()
			})
			Canvas.adaptObjectFaces(obj)
			Canvas.updateUV(obj)
		})
		this.loadData()
		this.message('uv_editor.reset')
	}
	select() {
		if (uv_dialog.allFaces.includes(this.id) === false) return;
		uv_dialog.selection = [this.id]
		uv_dialog.updateSelection()
	}
}
	UVEditor.prototype.menu = new Menu([
		{name: 'menu.view.zoom', id: 'zoom', condition: isApp, icon: 'search', children: [
			'zoom_in',
			'zoom_out',
			'zoom_reset'
		]},
		'uv_checkerboard',
		'_',
		'copy',
		'paste',
		{icon: 'photo_size_select_large', name: 'menu.uv.mapping', condition: () => !Project.box_uv, children: function(editor) { return [
			{icon: editor.reference_face.enabled!==false ? 'check_box' : 'check_box_outline_blank', name: 'generic.export', click: function(editor) {
				Undo.initEdit({elements: Cube.selected, uv_only: true})
				editor.toggleUV(event)
				Undo.finishEdit('uv_toggle')
			}},
			'uv_maximize',
			'uv_auto',
			'uv_rel_auto',
			{icon: 'rotate_90_degrees_ccw', condition: () => Format.uv_rotation, name: 'menu.uv.mapping.rotation', children: function() {
				var off = 'radio_button_unchecked'
				var on = 'radio_button_checked'
				return [
					{icon: (!editor.reference_face.rotation ? on : off), name: '0&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(0)
						Undo.finishEdit('uv_rotate')
					}},
					{icon: (editor.reference_face.rotation === 90 ? on : off), name: '90&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(90)
						Undo.finishEdit('uv_rotate')
					}},
					{icon: (editor.reference_face.rotation === 180 ? on : off), name: '180&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(180)
						Undo.finishEdit('uv_rotate')
					}},
					{icon: (editor.reference_face.rotation === 270 ? on : off), name: '270&deg;', click: function(editor) {
						Undo.initEdit({elements: Cube.selected, uv_only: true})
						editor.setRotation(270)
						Undo.finishEdit('uv_rotate')
					}}
				]
			}},
			'uv_turn_mapping',
			{
				icon: (editor.reference_face.uv[0] > editor.reference_face.uv[2] ? 'check_box' : 'check_box_outline_blank'),
				name: 'menu.uv.mapping.mirror_x',
				click: function(editor) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.mirrorX(event)
					Undo.finishEdit('uv_mirror')
				}
			},
			{
				icon: (editor.reference_face.uv[1] > editor.reference_face.uv[3] ? 'check_box' : 'check_box_outline_blank'),
				name: 'menu.uv.mapping.mirror_y',
				click: function(editor) {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.mirrorY(event)
					Undo.finishEdit('uv_mirror')
				}
			},
		]}},
		'face_tint',
		{icon: 'flip_to_back', condition: () => Format.id == 'java_block', name: 'action.cullface', children: function(editor) {
			var off = 'radio_button_unchecked';
			var on = 'radio_button_checked';
			return [
				{icon: (!editor.reference_face.cullface ? on : off), name: 'uv_editor.no_faces', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.forCubes(obj => {
						obj.faces[editor.face].cullface = '';
					})
					Undo.finishEdit('set cullface');
				}},
				{icon: (editor.reference_face.cullface == 'north' ? on : off), name: 'face.north', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.forCubes(obj => {
						obj.faces[editor.face].cullface = 'north';
					})
					Undo.finishEdit('set cullface');
				}},
				{icon: (editor.reference_face.cullface == 'south' ? on : off), name: 'face.south', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.forCubes(obj => {
						obj.faces[editor.face].cullface = 'south';
					})
					Undo.finishEdit('set cullface');
				}},
				{icon: (editor.reference_face.cullface == 'west' ? on : off), name: 'face.west', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.forCubes(obj => {
						obj.faces[editor.face].cullface = 'west';
					})
					Undo.finishEdit('set cullface');
				}},
				{icon: (editor.reference_face.cullface == 'east' ? on : off), name: 'face.east', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.forCubes(obj => {
						obj.faces[editor.face].cullface = 'east';
					})
					Undo.finishEdit('set cullface');
				}},
				{icon: (editor.reference_face.cullface == 'up' ? on : off), name: 'face.up', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.forCubes(obj => {
						obj.faces[editor.face].cullface = 'up';
					})
					Undo.finishEdit('set cullface');
				}},
				{icon: (editor.reference_face.cullface == 'down' ? on : off), name: 'face.down', click: function() {
					Undo.initEdit({elements: Cube.selected, uv_only: true})
					editor.forCubes(obj => {
						obj.faces[editor.face].cullface = 'down';
					})
					Undo.finishEdit('set cullface');
				}},
				'auto_cullface'
			]
		}},
		{icon: 'collections', name: 'menu.uv.texture', condition: () => !Project.box_uv, children: function() {
			var arr = [
				{icon: 'crop_square', name: 'menu.cube.texture.blank', click: function(editor, event) {
					Undo.initEdit({elements: Cube.selected})
					Cube.selected.forEach((obj) => {
						editor.getFaces(event).forEach(function(side) {
							obj.faces[side].texture = false;
						})
						Canvas.adaptObjectFaces(obj)
					})
					editor.loadData()
					editor.message('uv_editor.reset')
					Undo.initEdit('texture blank')
				}},
				{icon: 'clear', name: 'menu.cube.texture.transparent', click: function(editor) {editor.clear(event)}},
			]
			textures.forEach(function(t) {
				arr.push({
					name: t.name,
					icon: (t.mode === 'link' ? t.img : t.source),
					click: function(editor) {editor.applyTexture(t.uuid)}
				})
			})
			return arr;
		}}
	])


function switchBoxUV(state) {
	BARS.updateConditions()
	if (state) {
		Cube.all.forEach(cube => {
			if (cube.faces.west.uv[2] < cube.faces.east.uv[0]) {
				cube.mirror_uv = true;
				cube.uv_offset[0] = cube.faces.west.uv[2];
			} else {
				cube.mirror_uv = false;
				cube.uv_offset[0] = cube.faces.east.uv[0];
			}
			cube.uv_offset[1] = cube.faces.up.uv[3];
		})
	}
	$('#uv_panel_sides').toggle(!state)
	main_uv.setGrid(1).setSize(main_uv.size).displayAllMappingOverlays();
	Canvas.updateAllUVs()
}

const uv_dialog = {
	isSetup: false,
	single: false,
	clipboard: null,
	allFaces: ['north', 'south', 'west', 'east', 'up', 'down'],
	selection: [],
	selection_all: [],
	all_editors: [],
	hoveredSide: false,
	single_size: {},
	all_size: {},
	setup: function() {
		uv_dialog.editors = {
			single:new UVEditor('single').appendTo('#uv_dialog_single'),
			north: new UVEditor('north', true).appendTo('#uv_dialog_all'),
			south: new UVEditor('south', true).appendTo('#uv_dialog_all'),
			west:  new UVEditor('west', true).appendTo('#uv_dialog_all'),
			east:  new UVEditor('east', true).appendTo('#uv_dialog_all'),
			up:	new UVEditor('up', true).appendTo('#uv_dialog_all'),
			down:  new UVEditor('down', true).appendTo('#uv_dialog_all')
		}
		var size = $(window).height() - 200
		uv_dialog.editors.single.setSize(size)
		uv_dialog.editors.single.jquery.main.css('margin-left', 'auto').css('margin-right', 'auto')//.css('width', (size+10)+'px')
		uv_dialog.editors.up.jquery.main.css('margin-left', '276px').css('clear', 'both')
		uv_dialog.isSetup = true

		var single_size = limitNumber(size / 2 - 72, 80, 256)
		for (var key in uv_dialog.editors) {
			if (uv_dialog.editors[key] && key !== 'single') {
				uv_dialog.editors[key].setFace(key, false)
				uv_dialog.editors[key].setSize(single_size)
				uv_dialog.editors[key].jquery.main.mouseenter(function(event) {
					uv_dialog.hoveredSide = $(this).attr('id').replace('UVEditor_', '')
				})
				uv_dialog.editors[key].jquery.main.mouseleave(function() {
					uv_dialog.hoveredSide = false
				})
			}
		}
		$('.dialog#uv_dialog').resizable({
			minWidth: 202,
			minHeight: 464,
			resize: function() {
				uv_dialog.updateSize()
			},
			containment: 'document',
			handles: 'all'
		})
		BARS.updateConditions()
	},
	select: function(id, event) {
		if (event.shiftKey) {
			uv_dialog.selection.push(id)
		} else {
			if (uv_dialog.selection.includes(id) && uv_dialog.selection.length === 1) {
				uv_dialog.selection = []
			} else {
				uv_dialog.selection = [id]
			}
		}
		uv_dialog.updateSelection()
	},
	selectAll: function() {
		if (uv_dialog.selection.length === 6) {
			uv_dialog.selection.empty()
		} else {
			uv_dialog.selection = uv_dialog.allFaces.slice()
		}
		uv_dialog.updateSelection()
	},
	selectNone: function() {
		uv_dialog.selection = []
		uv_dialog.updateSelection()
	},
	forSelection: function(cb, event, ...args) {
		if (open_dialog === false) {
			main_uv[cb](event, ...args)
		} else if (uv_dialog.single) {
			uv_dialog.editors.single[cb](...args)
		} else {
			if (uv_dialog.selection.length > 0) {
				uv_dialog.selection.forEach(function(s) {
					uv_dialog.editors[s][cb](...args)
				})
			} else {
				uv_dialog.allFaces.forEach(function(s) {
					uv_dialog.editors[s][cb](...args)
				})
			}
		}
	},
	updateSelection: function() {
		$('#uv_dialog_all .UVEditor').removeClass('selected')
		uv_dialog.selection.forEach(function(id) {
			$('#uv_dialog_all #UVEditor_'+id).addClass('selected')
		})
	},
	openDialog: function() {
		showDialog('uv_dialog')
		if (!uv_dialog.isSetup) uv_dialog.setup()
		if (Project.box_uv) {
			$('#uv_tab_bar').hide();
		} else {
			$('#uv_tab_bar').show();
		}
	},
	centerDialog: function() {
		var obj = $('.dialog#uv_dialog')
		obj.css('left', (($(window).width()-obj.width())/2) +'px')
		obj.css('top', (($(window).height() - obj.height()) / 2) + 'px')
	},
	openAll: function() {
		uv_dialog.openDialog()
		uv_dialog.openTab('all')
		uv_dialog.centerDialog()
	},
	openFull: function() {
		uv_dialog.openDialog()
		uv_dialog.openTab(main_uv.face)
		uv_dialog.centerDialog()
	},
	openTab: function(tab) {
		uv_dialog.saveSize()
		$('#uv_tab_bar .tab').removeClass('open')
		$('#uv_tab_bar .tab#'+tab).addClass('open')
		if (tab === 'all') {
			uv_dialog.single = false
			$('#uv_dialog_single').hide()
			$('.uv_dialog_all_only').show()
			for (var key in uv_dialog.editors) {
				if (uv_dialog.editors[key] && key !== 'single') {
					uv_dialog.editors[key].loadData()
				}
			}
			uv_dialog.selection = uv_dialog.selection_all.splice(0, 10)
			uv_dialog.updateSelection()

			//BarItems.uv_grid.set(uv_dialog.editors.north.gridSelectOption)

			$('.dialog#uv_dialog').width(uv_dialog.all_size.x)
			$('.dialog#uv_dialog').height(uv_dialog.all_size.y)
		} else {
			uv_dialog.single = true
			$('#uv_dialog_single').show()
			$('.uv_dialog_all_only').hide()
			uv_dialog.editors.single.setFace(tab)
			uv_dialog.selection_all = uv_dialog.selection.splice(0, 10)
			uv_dialog.selection = [tab]
			//BarItems.uv_grid.set(uv_dialog.editors.single.gridSelectOption)

			var max_size = $(window).height() - 200
			if (max_size < uv_dialog.editors.single.size ) {
				uv_dialog.editors.single.setSize(max_size)
				uv_dialog.editors.single.jquery.main.css('margin-left', 'auto').css('margin-right', 'auto').css('width', max_size+'px')
			}
			$('.dialog#uv_dialog').width(uv_dialog.single_size.x)
			$('.dialog#uv_dialog').height(uv_dialog.single_size.y)
		}
		uv_dialog.hoveredSide = false;
		uv_dialog.updateSize()
	},
	saveSize: function() {
		if (uv_dialog.single) {
			uv_dialog.single_size.x = $('.dialog#uv_dialog').width()
			uv_dialog.single_size.y = $('.dialog#uv_dialog').height()
		} else {
			uv_dialog.all_size.x = $('.dialog#uv_dialog').width()
			uv_dialog.all_size.y = $('.dialog#uv_dialog').height()
		}
	},
	updateSize: function() {
		var obj = $('.dialog#uv_dialog')
		var size = {
			x: obj.width(),
			y: obj.height()
		}
		var menu_gap = 98 + ($('#uv_tab_bar').is(':visible') ? 30 : 0) + ($('.toolbar_wrapper.uv_dialog').height()||0);
		if (uv_dialog.single) {
			var editor_size = size.x-16
			size.y = (size.y - menu_gap) * (Project.texture_width/Project.texture_height)
			if (size.x > size.y) {
				editor_size =  size.y
			}
			uv_dialog.editors.single.setSize(editor_size)

		} else {
			var centerUp = false
			size.y -= menu_gap;
			if (size.x < size.y/1.2) {
				var editor_size = limitNumber(size.x / 2 - 35, 80, $(window).height()/3-120)
				editor_size = limitNumber(editor_size, 80, (size.y-64)/3 - 50)
			} else {
				//4 x 2
				var editor_size = limitNumber(size.x/4-25,  16,  size.y/2 - 60)
				centerUp = true
			}
			uv_dialog.setEditorSize(editor_size)
			if (centerUp) {
				uv_dialog.editors.up.jquery.main.css('margin-left', (editor_size+20)+'px').css('clear', 'both')
			}
		}
	},
	setEditorSize: function(size) {
		for (var key in uv_dialog.editors) {
			if (uv_dialog.editors[key] && key !== 'single') {
				uv_dialog.editors[key].jquery.main.css('margin-left', '0')
				uv_dialog.editors[key].setSize(size)
			}
		}
	},
	copy: function(event) {
		if (Cube.selected.length === 0) return;
		uv_dialog.clipboard = []

		function addToClipboard(face) {
			var tag = Cube.selected[0].faces[face]
			uv_dialog.clipboard.push(new Face(null, tag))
		}
		if (uv_dialog.hoveredSide) {
			addToClipboard(uv_dialog.hoveredSide)
			uv_dialog.editors[uv_dialog.hoveredSide].message('uv_editor.copied')

		} else if (uv_dialog.single) {
			addToClipboard(uv_dialog.editors.single.face)
			uv_dialog.editors.single.message('uv_editor.copied')

		} else if (uv_dialog.selection.length > 0) {
			uv_dialog.selection.forEach(function(s) {
				addToClipboard(s)
				uv_dialog.editors[s].message('uv_editor.copied')
			})
		} else {
			uv_dialog.allFaces.forEach(function(s) {
				addToClipboard(s)
				uv_dialog.editors[s].message('uv_editor.copied')
			})
		}
	},
	paste: function(event) {
		if (uv_dialog.clipboard === null || Cube.selected.length === 0) return;

		function applyFace(tag, face) {
			if (!face) face = tag.face
			Cube.selected.forEach(function(obj) {
				obj.faces[face].extend(tag)
				Canvas.updateUV(obj)
			})
		}

		if (uv_dialog.hoveredSide) {
			uv_dialog.editors[uv_dialog.hoveredSide].paste({shiftKey: false})

		} else if (uv_dialog.selection.length === 1) {
			applyFace(uv_dialog.clipboard[0], uv_dialog.selection[0])
			if (uv_dialog.single) {
				uv_dialog.editors.single.message('uv_editor.pasted')
			} else {
				uv_dialog.editors[uv_dialog.selection[0]].message('uv_editor.pasted')
			}
		} else {
			if (uv_dialog.clipboard.length === 1) {
				uv_dialog.selection.forEach(function(s) {
					applyFace(uv_dialog.clipboard[0], s)
					uv_dialog.editors[s].message('uv_editor.pasted')
				})
			} else {
				uv_dialog.clipboard.forEach(function(s) {
					if (uv_dialog.selection.includes(s.face)) {
						applyFace(s)
						uv_dialog.editors[s].message('uv_editor.pasted')
					}
				})
			}
		}

		for (var key in uv_dialog.editors) {
			if (uv_dialog.editors[key]) {
				uv_dialog.editors[key].loadData()
			}
		}
	}
}

BARS.defineActions(function() {
	new Action('uv_dialog', {
		icon: 'view_module',
		category: 'blockbench',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function () {uv_dialog.openAll()}
	})
	new Action('uv_dialog_full', {
		icon: 'web_asset',
		category: 'blockbench',
		click: function () {uv_dialog.openFull()}
	})

	new BarSlider('uv_rotation', {
		category: 'uv',
		condition: () => !Project.box_uv && Format.uv_rotation && Cube.selected.length,
		min: 0, max: 270, step: 90, width: 80,
		onBefore: () => {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		onChange: function(slider) {
			uv_dialog.forSelection('rotate')
		},
		onAfter: () => {
			Undo.finishEdit('uv rotate')
		}
	})
	new BarSelect('uv_grid', { 
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		min_width: 68,
		value: 'auto',
		options: {
			'auto': 'Pixel',
			'1x': '1x',
			'2x': '2x',
			'3x': '3x',
			'4x': '4x',
			'6x': '6x',
			'8x': '8x',
		},
		onChange: function(slider) {
			var value = slider.get().replace(/x/, '');
			uv_dialog.all_editors.forEach(editor => {
				editor.setGrid(value);
			});
		}
	})

	new Action('uv_select_all', {
		icon: 'view_module',
		category: 'uv',
		condition: () => open_dialog === 'uv_dialog',
		click: uv_dialog.selectAll
	})

	new Action('uv_maximize', {
		icon: 'zoom_out_map',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('maximize', event)
			Undo.finishEdit('uv maximize')
		}
	})
	new Action('uv_turn_mapping', {
		icon: 'screen_rotation',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) { 
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('turnMapping', event)
			Undo.finishEdit('turn uv mapping')
		}
	})
	new Action('uv_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('setAutoSize', event)
			Undo.finishEdit('auto uv')
		}
	})
	new Action('uv_rel_auto', {
		icon: 'brightness_auto',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('setRelativeAutoSize', event)
			Undo.finishEdit('auto uv')
		}
	})
	new Action('uv_mirror_x', {
		icon: 'icon-mirror_x',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('mirrorX', event)
			Undo.finishEdit('mirror uv')
		}
	})
	new Action('uv_mirror_y', {
		icon: 'icon-mirror_y',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('mirrorY', event)
			Undo.finishEdit('mirror uv')
		}
	})
	new Action('uv_transparent', {
		icon: 'clear',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			uv_dialog.forSelection('clear', event)
		}
	})
	new Action('uv_reset', {
		icon: 'replay',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('reset', event)
			Undo.finishEdit('reset uv')
		}
	})
	new Action('uv_apply_all', {
		icon: 'format_color_fill',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (e) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			main_uv.applyAll(e)
			Undo.finishEdit('uv apply all')
		}
	})
	new BarSelect('cullface', { 
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		label: true,
		options: {
			off: tl('uv_editor.no_faces'),
			north: tl('face.north'),
			south: tl('face.south'),
			west: tl('face.west'),
			east: tl('face.east'),
			up: tl('face.up'),
			down: tl('face.down'),
		},
		onChange: function(sel, event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true});
			uv_dialog.forSelection('switchCullface');
			Undo.finishEdit('cullface');
		}
	})
	new Action('auto_cullface', {
		icon: 'block',
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('autoCullface', event)
			Undo.finishEdit('auto cullface')
		}
	})
	new Action('face_tint', {
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		click: function (event) {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
			uv_dialog.forSelection('switchTint', event)
			Undo.finishEdit('tint')
		}
	})
	new NumSlider('slider_face_tint', {
		category: 'uv',
		condition: () => !Project.box_uv && Cube.selected.length,
		getInterval(event) {
			return 1;
		},
		get: function() {
			return Cube.selected[0] && Cube.selected[0].faces[main_uv.face].tint
		},
		change: function(modify) {
			let number = Math.clamp(Math.round(modify(this.get())), -1)

			uv_dialog.forSelection('setTint', event, number)
		},
		onBefore: function() {
			Undo.initEdit({elements: Cube.selected, uv_only: true})
		},
		onAfter: function() {
			Undo.finishEdit('set face tint')
		}
	})


	new Action('toggle_uv_overlay', {
		condition: () => Project.box_uv,
		icon: 'crop_landscape',//'crop_landscape'
		category: 'uv',
		click: function () {
			main_uv.showing_overlays = !main_uv.showing_overlays
			BarItems.toggle_uv_overlay.setIcon(main_uv.showing_overlays ? 'view_quilt' : 'crop_landscape')
			main_uv.displayAllMappingOverlays()
		}
	})
})
