/*
 * jQuery Tags Input 3.0.0
 *
 * Developed by Kimberly Grey
 * https://github.com/querkmachine
 *
 * Based on the one built by XOXCO, Inc. 
 * http://xoxco.com/clickable/jquery-tags-input
 *
 * Licensed under the MIT licence:
 * http://www.opensource.org/licenses/mit-license.php
 * 
 */

;(function($, window, document, undefined) {
	'use strict';
	const pluginName = 'tagsInput';
	const defaults = {
		classes: {
			container: 'tag-input',
			tagContainer: 'tag-input__tag-list',
			tag: 'tag-input__tag',
			tagLabel: 'tag-input__label',
			tagRemove: 'tag-input__remove',
			form: 'tag-input__form',
			formLabel: 'screenreader',
			formInput: 'tag-input__input',
			formInputInvalid: 'tag-input__input--invalid',
			autoComplete: 'tag-input__autocomplete',
			autoCompleteItem: 'tag-input__autocomplete-item'
		},
		l10n: {
			defaultText: 'Add a tag',
			removeLabel: '&times;',
			removeTitle: 'Remove tag \'{tag}\'',
		},
		formPosition: 'below',
		interactive: true,
		minChars: 0,
		maxChars: false,
		autoComplete: { 
			source: '',
			restrictive: false
		},
		hide: true,
		delimiter: ',',
		unique: true,
		removeWithBackspace: true,
		autosize: true,
		comfortZone: 20,
		debug: false
	};
	function Plugin(element, options) {
		this.$element = $(element);
		this.settings = $.extend(true, {}, defaults, options);
		this._defaults = defaults;
		this._name = pluginName;
		this.id = `${pluginName}-${Math.random().toString(36).substring(6)}`;

		// Don't init if it's already been done 
		if(typeof this.$element.data(`${pluginName}-init`) !== 'undefined') {
			return;
		};

		this.autoCompleteOptions;
		this.callbacks = [];

		if(this.settings.debug) console.log('settings', this.settings);
		this.init();
	};
	$.extend(Plugin.prototype, {
		init: function() {
			this.$element.data(`${this._name}-init`, true);

			// Setting up callbacks
			if(this.settings.onAddTag || this.settings.onRemoveTag || this.settings.onChange || this.settings.onError) {
				this.callbacks['onAddTag'] = this.settings.onAddTag;
				this.callbacks['onRemoveTag'] = this.settings.onRemoveTag;
				this.callbacks['onChange'] = this.settings.onChange;
				this.callbacks['onError'] = this.settings.onError;
			}

			// Hide the defaut text input
			if(this.settings.hide) {
				this.$element.hide();
			};

			// Generate initial markup
			let $container,
			    $tagContainer,
			    $form,
			    $formLabel,
			    $formInput;
			$container = $('<div/>', {
				'class': this.settings.classes.container
			});
			$tagContainer = $('<div/>', {
				'class': this.settings.classes.tagContainer
			});
			this.$container = $container;
			this.$tagContainer = $tagContainer;
			$container.append($tagContainer);
			if(this.settings.interactive) {
				$form = $('<div/>', {
					'class': this.settings.classes.form
				});
				$formLabel = $('<label/>', {
					'class': this.settings.classes.formLabel,
					'text': this.settings.l10n.defaultText,
					'for': this.id
				});
				$formInput = $('<input/>', {
					'class': this.settings.classes.formInput,
					'placeholder': this.settings.l10n.defaultText,
					'type': 'text',
					'id': this.id
				});
				this.$form = $form;
				this.$formLabel = $formLabel;
				this.$formInput = $formInput;
				$form.append($formLabel).append($formInput);
				if(this.settings.formPosition === 'above') {
					$container.prepend($form);
				}
				else {
					$container.append($form);
				}
			}

			// Populate any tags already set
			if(this.$element.val() != '') {
				this.importTags(this.$element, this.$element.val());
			};

			if(this.settings.interactive) {
				this.resetAutosize();

				// Focus the input if the user clicks anywhere on the control
				$container.on('click', () => {
					$formInput.trigger('focus');
				});

				// If autocomplete is used... 
				if(typeof this.settings.autoComplete.source !== 'undefined') {
					if(typeof jQuery.autocompleter !== 'undefined') {
						$formInput.autocompleter(this.settings.autoComplete);
						$formInput.on('result', (e, data, formatted) => {
							if(data) {
								this.addTag(`${data[0]}`, {
									focus: true
								});
							};
						});
					}
					else {
						$.ajax({
							url: this.settings.autoComplete.source,
							dataType: 'json'
						}).done((data) => {
							if(this.settings.debug) console.log('autoCompleteOptions', data);
							this.autoCompleteOptions = data;
							this.initAutoComplete();
						});
					}
				};

				// If the user presses the key for a delimiter character (e.g. a comma), add a tag
				$formInput.on('keypress', (e) => {
					if(this.checkDelimiter(e)) {
						e.preventDefault();
						if((this.settings.minChars <= $formInput.val().length) && (!this.settings.maxChars || this.settings.maxChars >= $formInput.val().length)) {
							this.addTag($formInput.val(), {
								focus: true
							});
						}
						this.resetAutosize();
						return false;
					}
					else if(this.settings.autosize) {
						this.doAutosize();
					}
				});

				// If the user presses backspace on an empty input, delete the last tag
				if(this.settings.removeWithBackspace) {
					$formInput.on('keydown', (e) => {
						if(e.which === 8 && $formInput.val() === '') {
							e.preventDefault();
							const lastTag = this.$tagContainer.find(`.${this.settings.classes.tag}:last .${this.settings.classes.tagLabel}`).text();
							this.removeTag(lastTag);
							$formInput.trigger('focus');
						}
					});
				};

				// Remove input error style if input value gets changed
				if(this.settings.unique) {
					$formInput.on('keydown', (e) => {
						$formInput.removeClass(this.settings.classes.formInputInvalid);
					});
				};
			};

			// Add code to the DOM finally
			this.$element.after($container);
		},
		initAutoComplete: function() {
			const id = `${this.id}-autocomplete`;
			const $autoComplete = $('<ul/>', {
				'class': this.settings.classes.autoComplete,
				'aria-live': 'polite',
				'id': id,
				'role': 'listbox'
			});
			$.each(this.autoCompleteOptions, (i, item) => {
				const $autoCompleteItem = $('<li/>', {
					'class': this.settings.classes.autoCompleteItem,
					'tabindex': '0',
					'text': item.label,
					'role': 'option'
				}).on('keydown', (e) => {
					if(e.which != 13) { return; }
					this.$formInput.val('');
					this.addTag(item.label, {
						focus: true
					});
				}).on('click', (e) => {
					this.$formInput.val('');
					this.addTag(item.label, {
						focus: true
					});
				}).on('focus', function(e) {
					$(`#${id}-selected`).removeAttr('id');
					$(this).attr('id', `${id}-selected`);
				});
				$autoComplete.append($autoCompleteItem);
			});
			this.$formInput.after($autoComplete);
			this.$formInput.attr('role', 'combobox').attr('aria-autocomplete', 'list').attr('aria-owns', id).attr('aria-activedescendant', `${id}-selected`).on('keyup focus', (e) => {
				if(this.$formInput.val() != '') {
					$autoComplete.attr('aria-hidden', 'false');
				}
				else {
					$autoComplete.attr('aria-hidden', 'true');
				}
			}).on('blur', (e) => {
				$autoComplete.attr('aria-hidden', 'true');
			}).on('keyup change paste', (e) => {
				const value = this.$formInput.val().toLowerCase();
				$autoComplete.children().each((i, item) => {
					if($(item).text().toLowerCase().includes(value)) {
						$(item).attr('aria-hidden', 'false');
					}
					else {
						$(item).attr('aria-hidden', 'true');
					}
				});
			});
		},
		doAutosize: function() {
			if(this.settings.debug) console.log('doAutosize')
			if(this.$formInput.val() === '') { return; }
			this.$formInput.on('keyup paste', (e) => {
				const width = $(`#${this.id}-tester`).html(this.$formInput.val()).width() + this.settings.comfortZone;
				this.$formInput.width(width);
			});
		},
		resetAutosize: function() {
			if(this.settings.debug) console.log('resetAutosize')
			if(!$(`#${this.id}-tester`).length) {
				const $formInputDummy = $('<span/>').css({
					'position': 'absolute',
					'top': '-9999px',
					'left': '-9999px',
					'width': 'auto',
					'font-size': this.$formInput.css('font-size'),
					'font-family': this.$formInput.css('font-family'),
					'font-weight': this.$formInput.css('font-weight'),
					'letter-spacing': this.$formInput.css('letter-spacing'),
					'white-space': 'nowrap'
				}).attr('id', `${this.id}-tester`);
				$('body').append($formInputDummy);
				return;
			};
			$(`#${this.id}-tester`).css({'width': 'auto'});
		},
		addTag: function(value, options) {
			if(this.settings.debug) console.log('addTag', value, options);

			let errorCallback = false;
			if(this.callbacks && this.callbacks['onError']) {
				errorCallback = this.callbacks['onError'];
			}

			// Combine default options with those passed
			options = $.extend({
				focus: false,
				callback: false,
				unique: this.settings.unique,
				valueChecks: true
			}, options);

			// Set up tag array
			let tagsList = [];
			if(this.$element.val() != '') {
				tagsList = this.$element.val().split(this.settings.delimiter);
			};

			value = $.trim(value);

			// Check if value actually has content
			if(value === '') {
				if(options.valueChecks && errorCallback) {
					this.$formInput.addClass(this.settings.classes.formInputInvalid);
					errorCallback.call(this, 'emptyvalue');
					console.trace();
				}
				return false;
			};

			// Check if the tag is unique or not, reject it if not
			if(options.valueChecks && options.unique) {
				const skipTag = this.tagExists(value);
				if(skipTag) {
					this.$formInput.addClass(this.settings.classes.formInputInvalid);
					if(errorCallback) {
						errorCallback.call(this, 'notunique');
					}
					return false;
				};
			};

			// Check if tag is in the allowed options
			if(options.valueChecks && this.settings.autoComplete.restrictive) {
				const allowedValues = [];
				$.each(this.autoCompleteOptions, (i, item) => {
					allowedValues.push(item.label.toLowerCase());
				});
				if($.inArray(value.toLowerCase(), allowedValues) == -1) {
					this.$formInput.addClass(this.settings.classes.formInputInvalid);
					if(errorCallback) {
						errorCallback.call(this, 'notpermitted');
					}
					return false;
				}
			}

			// Add markup for the new tag
			const $tag = $('<span/>', {
				'class': this.settings.classes.tag
			});
			const $tagLabel = $('<span/>', {
				'class': this.settings.classes.tagLabel,
				'text': value
			});
			const $tagRemove = $('<button/>', {
				'class': this.settings.classes.tagRemove,
				'type': 'button',
				'title': this.settings.l10n.removeTitle.replace('{tag}', value),
				'aria-label': this.settings.l10n.removeTitle.replace('{tag}', value)
			}).html(this.settings.l10n.removeLabel.replace('{tag}', value)).on('click', (e) => {
				this.removeTag(value);
			});
			this.$tagContainer.append($tag.append($tagLabel).append($tagRemove));
			
			// Update tags list 
			tagsList.push(value);
			this.inputUpdate(this.$element, tagsList);

			// Manage focus
			this.$formInput.val('');
			if(options.focus) {
				this.$formInput.trigger('focus');
			}
			else {
				this.$formInput.trigger('blur');
			};

			// Fire callbacks
			if(options.callbacks) {
				if(this.callbacks && this.callbacks['onAddTag']) {
					let func = this.callbacks['onAddTag'];
					func.call(this, value);
				}
				if(this.callbacks && this.callbacks['onChange']) {
					let func = this.callbacks['onChange'];
					func.call(this, this.$element, tagsList[tagsList.length - 1]);
				}
			}

		},
		removeTag: function(value) {
			if(this.settings.debug) console.log('removeTag', value)

			// Remove all the visible tags
			value = unescape(value);
			this.$tagContainer.children().remove();

			// Build a new tag string, ommitting the one that's to be removed
			const old = this.$element.val().split(this.settings.delimiter);
			let str = '';
			for(let i = 0; i < old.length; i++) {
				if(old[i] !== value) {
					str += this.settings.delimiter + old[i];
				}
			}
			this.importTags(this.$element, str);

			// Fire callback
			if(this.callbacks && this.callbacks['onRemoveTag']) {
				let func = this.callbacks['onRemoveTag'];
				func.call(this, value);
			}
		},
		tagExists: function(value) {
			if(this.settings.debug) console.log('tagExists', value)
			const tagsList = this.$element.val().toLowerCase().split(this.settings.delimiter);
			return ($.inArray(value.toLowerCase(), tagsList) >= 0);
		},
		checkDelimiter: function(event) {
			if(this.settings.debug) console.log('checkDelimiter', event);
			if(event.which === 13 || event.which === this.settings.delimiter.charCodeAt(0)) {
				return true;
			};
			return false;
		},
		inputUpdate: function($object, tagsList) {
			if(this.settings.debug) console.log('inputUpdate', $object, tagsList);
			$object.val(tagsList.join(this.settings.delimiter));
		},
		importTags: function($object, value) {
			if(this.settings.debug) console.log('importTags', $object, value);
			$object.val('');

			// Split up delimited list of tags and process them individually
			const tags = value.split(this.settings.delimiter);
			for(let i = 0; i < tags.length; i++) {
				this.addTag(tags[i], {
					valueChecks: false
				});
			};
		}
	});
	$.fn[pluginName] = function(options) {
		return this.each(function() {
			if(!$.data(this, `plugin_${pluginName}`)) {
				$.data(this, `plugin_${pluginName}`, new Plugin(this, options));
			};
		});
	};
})(jQuery, window, document);