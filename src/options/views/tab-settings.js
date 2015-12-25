var ExportList = BaseView.extend({
  el: '.export-list',
  templateUrl: '/options/templates/option.html',
  initialize: function () {
    BaseView.prototype.initialize.call(this);
    this.listenTo(scriptList, 'reset change', this.render);
  },
  _render: function () {
    var _this = this;
    _this.$el.html(scriptList.map(function (script) {
      return _this.templateFn(script.toJSON());
    }).join(''));
  },
  getSelected: function () {
    var selected = [];
    this.$('option').each(function (i, option) {
      if (option.selected) selected.push(scriptList.at(i));
    });
    return selected;
  },
  toggleAll: function () {
    var options = this.$('option');
    var select = _.some(options, function (option) {
      return !option.selected;
    });
    options.each(function (i, option) {
      option.selected = select;
    });
  },
});

var SettingsTab = BaseView.extend({
  el: '#tab',
  name: 'settings',
  events: {
    'change [data-check]': 'updateCheckbox',
    'change #sInjectMode': 'updateInjectMode',
    'change #cUpdate': 'updateAutoUpdate',
    'click #bSelect': 'toggleSelection',
    'click #bImport': 'importFile',
    'click #bExport': 'exportData',
    'click #bVacuum': 'onVacuum',
  },
  templateUrl: '/options/templates/tab-settings.html',
  _render: function () {
    var options = _.options.getAll();
    this.$el.html(this.templateFn(options));
    this.$('#sInjectMode').val(options.injectMode);
    this.updateInjectHint();
    this.exportList = new ExportList;
    this.updateSuboptions();
  },
  updateSuboptions: function (item) {
    (item ? this.$(item).parents('.option-group') : this.$('.option-group'))
    .each(function (i, el) {
      var $el = $(el);
      var checked = $el.children('label').children('input[type=checkbox]').prop('checked');
      var suboption = $el.find('.suboption');
      checked ? suboption.removeClass('disabled') : suboption.addClass('disabled');
      suboption.find('input[type=checkbox]').prop('disabled', !checked);
    });
  },
  updateCheckbox: function (e) {
    _.updateCheckbox(e);
    this.updateSuboptions(e.target);
  },
  updateAutoUpdate: function (e) {
    _.sendMessage({cmd: 'AutoUpdate'});
  },
  updateInjectHint: function () {
    this.$('#sInjectMode+span').text([
      _.i18n('hintInjectModeNormal'),
      _.i18n('hintInjectModeAdvanced'),
    ][this.$('#sInjectMode').val()]);
  },
  updateInjectMode: function (e) {
    _.options.set('injectMode', e.target.value);
    this.updateInjectHint();
  },
  toggleSelection: function () {
    this.exportList.toggleAll();
  },
  importData: function (file) {
    function getVMConfig(text) {
      var vm;
      try {
        vm = JSON.parse(text);
      } catch (e) {
        console.log('Error parsing ViolentMonkey configuration.');
      }
      vm = vm || {};
      _.forEach(vm.values, function (value, key) {
        _.sendMessage({
          cmd: 'SetValue',
          data: {
            uri: key,
            values: value,
          }
        });
      });
      _.forEach(vm.settings, function (value, key) {
        _.options.set(key, value);
      });
      return vm;
    }
    function getVMFile(entry, vm) {
      if (entry.filename.slice(-8) !== '.user.js') return;
      vm = vm || {};
      return new Promise(function (resolve, reject) {
        var writer = new zip.TextWriter;
        entry.getData(writer, function (text) {
          var script = {code: text};
          if (vm.scripts) {
            var more = vm.scripts[entry.filename.slice(0, -8)];
            if (more) script.more = _.omit(more, ['id']);
          }
          _.sendMessage({
            cmd: 'ParseScript',
            data: script,
          }).then(function () {
            resolve(true);
          });
        });
      });
    }
    function getVMFiles(entries) {
      var i = _.findIndex(entries, function (entry) {
        return entry.filename === 'ViolentMonkey';
      });
      if (~i) return new Promise(function (resolve, reject) {
        var writer = new zip.TextWriter;
        entries[i].getData(writer, function (text) {
          entries.splice(i, 1);
          resolve({
            vm: getVMConfig(text),
            entries: entries,
          });
        });
      });
      return {
        entries: entries,
      };
    }
    function readZip(file) {
      return new Promise(function (resolve, reject) {
        zip.createReader(new zip.BlobReader(file), function (res) {
          res.getEntries(function (entries) {
            resolve(entries);
          });
        }, function (err) {reject(err);});
      });
    }
    readZip(file).then(getVMFiles).then(function (data) {
      var vm = data.vm;
      var entries = data.entries;
      return Promise.all(entries.map(function (entry) {
        return getVMFile(entry, vm);
      })).then(function (res) {
        return _.filter(res).length;
      });
    }).then(function (count) {
      scriptList.reload();
      alert(_.i18n('msgImported', [count]));
    });
  },
  importFile: function () {
    var _this = this;
    $('<input type=file accept=".zip">')
    .change(function (e) {
      if (this.files && this.files.length)
        _this.importData(this.files[0]);
    })
    .trigger('click');
  },
  exportData: function () {
    function getWriter() {
      return new Promise(function (resolve, reject) {
        zip.createWriter(new zip.BlobWriter, function (writer) {
          resolve(writer);
        });
      });
    }
    function addFile(writer, file) {
      return new Promise(function (resolve, reject) {
        writer.add(file.name, new zip.TextReader(file.content), function () {
          resolve(writer);
        });
      });
    }
    function download(writer) {
      return new Promise(function (resolve, reject) {
        writer.close(function (blob) {
          var url = URL.createObjectURL(blob);
          $('<a>').attr({
            href: url,
            download: 'scripts.zip',
          }).trigger('click');
          URL.revokeObjectURL(url);
          resolve();
        });
      });
    }
    var bExport = this.$('#bExport');
    bExport.prop('disabled', true);
    var selected = this.exportList.getSelected();
    if (!selected.length) return;
    var withValues = this.$('#cbValues').prop('checked');
    _.sendMessage({
      cmd: 'ExportZip',
      data: {
        values: withValues,
        ids: _.pluck(selected, 'id'),
      }
    }).then(function (data) {
      var names = {};
      var vm = {
        scripts: {},
        settings: _.options.getAll(),
      };
      if (withValues) vm.values = {};
      var files = data.scripts.map(function (script) {
        var name = script.custom.name || script.meta.name || 'Noname';
        if (names[name]) name += '_' + (++ names[name]);
        else names[name] = 1;
        vm.scripts[name] = _.pick(script, ['id', 'custom', 'enabled', 'update']);
        if (withValues) {
          var values = data.values[script.uri];
          if (values) vm.values[script.uri] = values;
        }
        return {
          name: name + '.user.js',
          content: script.code,
        };
      });
      files.push({
        name: 'ViolentMonkey',
        content: JSON.stringify(vm),
      });
      return files;
    }).then(function (files) {
      return files.reduce(function (result, file) {
        return result.then(function (writer) {
          return addFile(writer, file);
        });
      }, getWriter()).then(download);
    }).then(function () {
      bExport.prop('disabled', false);
    });
  },
  onVacuum: function (e) {
    var button = $(e.target);
    button.prop('disabled', true).html(_.i18n('buttonVacuuming'));
    _.sendMessage({cmd: 'Vacuum'}).then(function () {
      button.html(_.i18n('buttonVacuumed'));
    });
  },
});
