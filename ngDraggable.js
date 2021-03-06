(function(){
	var mod = angular.module('ngDraggable', [])

	.service('$drag', function($document){
		/*****************************************************************************
		 *
		 *
		 *
		 *	REASON FOR USING SERVICE INSTEAD OF DIRECT CONTROLLER-CONTROLLER LISTENER
		 *	Listener will be over attached if there are a lot of DropTarget and
		 * 	DraggableObject e.g.
		 *		DraggableObject		10 ea
		 *		DropTarget			10 ea
		 *	would mean All DraggableObjects would have to listen to all DropTarget.
		 *	If the DropTarget has 3 events then DraggableObjects would have to attache
		 *	Total of 30 (10 * 3) listeners.
		 *	Using 1 services as a terminal to send signals between DraggableObjects which
		 *	is being dragged and DropTarget which is being hovered. Minimalize the number
		 *	down to 3
		 *
		 *
		 *
		 *****************************************************************************/
		var _self = this;
		var _draggable = null;
		var _dropTarget = { element:null, model:null, put:null };
		var _draggy = this;
		var _on = {
			draggable: { get: [], lost: [] },
			droptarget: { get: [], lost: [], over: [] }
		};

		/**
		 * Register event listener to the specified callback
		 * --
		 * @params	String		eventName	Name of the event to perform registration
		 *			Function	callback	Callback function to be registered
		 * @return	Void
		 */
		this.on = function(eventNameSpace, callback){
			var t			= eventNameSpace.split('.');
			var objectName	= t[0];
			var eventName	= t[1];
			_on[objectName][eventName].push(callback);
		}

		/**
		 * Unregistering event listener on the specified callback
		 * --
		 * @params	String		eventName	Name of the event to perform unregistration
		 *			Function	callback	Callback function to be unregistered
		 * @return	Void
		 */
		this.un = function(eventNameSpace, callback){
			var t			= eventNameSpace.split('.');
			var objectName	= t[0];
			var eventName	= t[1];
			var i			= _on[objectName][eventName].indexOf(callback);

			if (i > -1) {
				_on[objectName][eventName].splice(i, 1);
			}
		}
		this.$getDraggedObject = function(){
			return _draggable;
		}
		
		this.$getDropTarget = function(){
			return _dropTarget;
		}
		this.isDraggingObject = function(){
			if (_draggable) {
				return _draggable.isBeingDragged();
			} else {
				return false;
			}
		}

		this.$watchDraggable = function(draggable){
			draggable.on('dragstart', function(object){
				_draggable = draggable;

				for (var i = _on.draggable.get.length - 1; i >= 0; i--) {
					_on.draggable.get[i](_draggable);
				};
			});
			draggable.on('dragend', function(object){
				if (_dropTarget) {
					if (_draggable.dataTransfer.hasData()) {
						_draggable.dataTransfer.transfer(_dropTarget);
					} else {
						// Transfer its element instead
						_draggable.getElement().appendTo(_dropTarget.getElement());

						console.log(
							'myste1tainn/ngDraggable', 
							'WARNING', 
							'This drag-and-drop has no data to transfer, if this is intentional then you can ignore this message'
						);
					}

					for (var i = _on.draggable.lost.length - 1; i >= 0; i--) {
						_on.draggable.lost[i](_draggable);
					};

					if (Modernizr.draganddrop) {
						_dropTarget.trigger('dragleave', _dropTarget);
					}

					// Ensure that after valid drop
					// The draggable and drop target is lost
					_draggable	= null;
					_dropTarget	= null;
				} else {

					console.log('myste1tainn/ngDraggable :', 'Invalid Area Drop');

				}
			});
			draggable.on('drag', function(object){
				
			});
		}

		this.$watchDropTarget = function(dropTarget){
			// Bubble up event from DropTarget's event listenres to draggy's event listeners
			for (var i = _on.droptarget.get.length - 1; i >= 0; i--) {
				dropTarget.on('dragenter', _on.droptarget.get[i]);
			};

			for (var i = _on.droptarget.over.length - 1; i >= 0; i--) {
				dropTarget.on('dragover', _on.droptarget.over[i]);
			};

			// for (var i = _on.droptarget.lost.length - 1; i >= 0; i--) {
			// 	dropTarget.on('dragleave', _on.droptarget.lost[i]);
			// };

			for (var i = _on.droptarget.lost.length - 1; i >= 0; i--) {
				
			};

			// Draggy direct listen to DropTarget's event
			dropTarget.on('dragenter', function(object){
				_dropTarget = object;
			});

			dropTarget.on('dragleave', function(object){
				for (var i = _on.droptarget.lost.length - 1; i >= 0; i--) {
					_on.droptarget.lost[i](object);
				};
			});
		}
	})

	/**
	 * Represents draggable objects
	 */
	.directive('draggableObject', function(){
		return {
			restrict: 'A',
			controller: function($scope, $element, $attrs, $document, $drag) {
				var _self 			= this;

				// Represents the data it carries
				var _data, _model;

				if ($attrs.dragData === 'undefined' || $attrs.dragData === '') {

					_data = null;
					_model = null;

				} else {

					_data = $scope.$eval($attrs.dragData);

					if ($attrs.dragData === 'undefined' || $attrs.dragData === '') {
						_model = null;
					} else {
						_model = $scope.$eval($attrs.dragModel);
					}
				}

				// Represents data transferring
				this.dataTransfer 	= new DataTransfer(_data, _model);

				// Represents its element
				var _element 		= $element;

				// Represents the element silhouette when it is being dragged (NON-HTML5 mode)
				var _dragSilhouette	= null;

				// Represents the location where the draggable was dragged to
				var _pos 			= { x: null, y: null };

				// Signifies whether the object is being dragged or not
				var _isBeingDragged = false;

				// Events
				var _on = {
					dragstart: [],
					dragend: [],
					drag: []
				};

				// ############### CONSTRUCTOR

				// Make the element not selectable
				_element.css({
					'-webkit-touch-callout'	: 'none',
				    '-webkit-user-select'	: 'none',
				    '-khtml-user-select'	: 'none',
				    '-moz-user-select'		: 'none',
				    '-ms-user-select'		: 'none',
				    'user-select'			: 'none',
				});

				/**
				 * HTML5 Mode uses HTML5 drag's events
				 */
				if (Modernizr.draganddrop)
				{
					_element.attr('draggable', 'true');
					_element.on('dragstart', function(event){

						_isBeingDragged = true;
						_self.trigger('dragstart', _self);

					});
					_element.on('drag', function(event){

						_self.trigger('drag', _self);

					});
					_element.on('dragend', function(event){

						_isBeingDragged = false;
						_self.trigger('dragend', _self);

						// Apply scope to reflect any model changes
						$scope.$apply();

					});
				}
				/**
				 * NON-HTML5 Mode uses the old mouseup/down/enter/over/leave events
				 */
				else
				{
					_element.on('mousedown', function(event){

						_isBeingDragged = true;
						_self.createDragSilhouette(event.pageX, event.pageY);
						_self.trigger('dragstart', _self);

					});
					angular.element($document[0].body).on('mousemove', function(event){

						if (_dragSilhouette) {
							_self.moveDragSilhouette(event.pageX, event.pageY);
							_self.trigger('drag', _self);
						}

					});
					angular.element($document[0].body).on('mouseup', function(event){

						if (_dragSilhouette) {
							_isBeingDragged = false;
							_self.dropDragSilhouette();
							_self.trigger('dragend', _self);

							// Apply scope to reflect any model changes
							$scope.$apply();
						}

					});
				}

				// ############### END CONSTRUCTOR

				this.trigger = function(eventName, arguments){
					for (var i = _on[eventName].length - 1; i >= 0; i--) {
						_on[eventName][i](arguments);
					};
				}

				// ############### NON-HTML5 Mode supoprt methods

				this.createDragSilhouette = function(x, y){
					_dragSilhouette	= _element.clone();
					_dragSilhouette.prependTo('body');

					var halfWidth 	= _dragSilhouette.width() / 2;
					var halfHeight 	= _dragSilhouette.height() / 2;

					_dragSilhouette.css({
						// The silhouette takes not point events and pass it all to 
						// elements under it.
						'pointer-events' : 'none', 						
						'position'	: 'absolute',
						'cursor'	: 'move',
						'z-index'	: 9999,
						'opacity'	: 0.7,
						'top'		: (y - halfHeight) + 'px',
						'left'		: (x - halfWidth) + 'px',
					});
				}
				this.moveDragSilhouette = function(x, y){
					if (_dragSilhouette) {
						var halfWidth 	= _dragSilhouette.width() / 2;
						var halfHeight 	= _dragSilhouette.height() / 2;

						_dragSilhouette.css({
							'top'		: (y - halfHeight) + 'px',
							'left'		: (x - halfWidth) + 'px',
						});
					}
				}
				this.dropDragSilhouette = function(){
					if (_dragSilhouette) {
						_dragSilhouette.remove();
						_dragSilhouette = null;
					}
				}

				// ############### END NON-HTML5 Mode supoprt methods

				this.getData = function(){
					return _data;
				}
				this.getModel = function() {
					return _model;
				}
				this.getElement = function(){
					return _element;
				}
				this.getPosition = function(){
					return _pos;
				}
				this.isBeingDragged = function(){
					return _isBeingDragged;
				}

				this.on = function (eventName, callback) {
					if (eventName.toLowerCase() === 'dragstart') {
						_on.dragstart.push(callback);
					}
					if (eventName.toLowerCase() === 'dragend') {
						_on.dragend.push(callback);
					}
					if (eventName.toLowerCase() === 'drag') {
						_on.drag.push(callback);
					}
				}
				this.un = function (eventName, callback) {
					if (eventName.toLowerCase() === 'dragstart') {
						var i = _on.dragstart.indexOf(callback);
						if (i > -1) _on.dragstart.splice(i, 1);
					}
					if (eventName.toLowerCase() === 'dragend') {
						var i = _on.dragend.indexOf(callback);
						if (i > -1) _on.dragend.splice(i, 1);
					}
					if (eventName.toLowerCase() === 'drag') {
						var i = _on.drag.indexOf(callback);
						if (i > -1) _on.drag.splice(i, 1);
					}
				}

				// Let draggy service watch this(DraggableObject)'s events
				$drag.$watchDraggable(this);
			},
			controllerAs: 'draggableObject'
		}
	})

	/**
	 * Represents drop targets
	 */
	.directive('dropTarget', function(){
		return {
			restrict: 'A',
			controller: function($scope, $element, $attrs, $drag){
				var _self = this;

				// Represents its model
				var _model = $scope.$eval($attrs.dropModel);

				// Represents its element
				var _element = $element;

				// Represents data transferring
				this.dataTransfer = new DataTransfer(null, _model);

				// Listener
				var _on = {
					dragenter: [],
					dragover: [],
					dragleave: [],
					drop: []
				};

				// ########## CONSTRUCTOR

				// Make the element not-selectable
				_element.css({
					'-webkit-touch-callout'	: 'none',
				    '-webkit-user-select'	: 'none',
				    '-khtml-user-select'	: 'none',
				    '-moz-user-select'		: 'none',
				    '-ms-user-select'		: 'none',
				    'user-select'			: 'none',
				});

				if (Modernizr.draganddrop) { // HTML5 Mode

					_element.on('dragenter', function(){
						for (var i = _on.dragenter.length - 1; i >= 0; i--) {
							_self.trigger('dragenter', _self);
						};
					});
					_element.on('dragover', function(){
						for (var i = _on.dragover.length - 1; i >= 0; i--) {
							_self.trigger('dragover', _self);
						};
					});
					_element.on('dragleave', function(){
						for (var i = _on.dragleave.length - 1; i >= 0; i--) {
							_self.trigger('dragleave', _self);
						};
					});

				} else { // NON-HTML5 Mode

					_element.on('mouseenter', function(){
						// Need to ask draggy service if the user is dragging something
						if ($drag.isDraggingObject()) {
							_self.trigger('dragenter', _self);
						}
					});
					_element.on('mouseover', function(){
						// Need to ask draggy service if the user is dragging something
						if ($drag.isDraggingObject()) {
							for (var i = _on.dragover.length - 1; i >= 0; i--) {
								_self.trigger('dragover', _self);
							};
						}
					});
					_element.on('mouseout', function(){
						// Need to ask draggy service if the user is dragging something
						if ($drag.isDraggingObject()) {
							_self.trigger('dragleave', _self);
						}
					});

				}

				// ########## END CONSTRUCTOR

				this.trigger = function(eventName, arguments){
					for (var i = _on[eventName].length - 1; i >= 0; i--) {
						_on[eventName][i](arguments);
					};
				}

				this.getElement = function(){
					return _element;
				}
				this.getModel = function(){
					return _model;
				}

				this.on = function (eventName, callback) {
					_on[eventName].push(callback);
				}
				this.un = function (eventName, callback) {
					var i = _on[eventName].indexOf(callback);
					if (i > -1) _on[eventName].splice(i, 1);
				}

				// Let draggy service watch this(DraggableObject)'s events
				$drag.$watchDropTarget(this);
			},
			controllerAs: 'dropTarget'
		}
	})

	function DataTransfer(data, model) {
		var _data = data;
		var _model = model;

		this.getData = function() {
			return _data;
		}

		this.hasData = function(){
			return (typeof _data !== 'undefined' && _data != null);
		}

		this.transfer = function(receiver, consumeData){
			consumeData = (typeof consumeData === 'undefined') ? true : consumeData;

			if (typeof _model === 'undefined' || _model == null) {
				consumeData = false;
			}

			// Expects receiver to be DropTarget
			if (receiver.dataTransfer && DataTransfer.prototype.isPrototypeOf(receiver.dataTransfer)) {

				if (consumeData) { // Consume the data in sender's model
					receiver.dataTransfer.receive(_data);	

					var i = _model.indexOf(_data);

					if (i > -1) {
						_model.splice(i, 1);
					}
				} else { // Not consuming the data in means cloning
					var clonedData = angular.copy(_data);
					receiver.dataTransfer.receive(clonedData);
				}

			} else {
				console.log(
					'myste1tainn/ngDraggable', 
					'WARNING', 
					'the receiver does not implements DataTransfer protocols'
				);
			}
		}
		this.receive = function(prop, data){
			if (typeof data === 'undefined' &&
				typeof prop !== 'undefined') {
				data = prop;
				_model.push(data);
			} else {
				_model[prop] = data;
			}
		}
	}

})();