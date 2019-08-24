import Vue from 'vue';
import {
  i18n, sendMessage, injectContent, debounce,
} from '#/common';
import handlers from '#/common/handlers';
import * as tld from '#/common/tld';
import '#/common/ui/style';
import App from './views/app';
import { store } from './utils';

tld.initTLD();

Vue.prototype.i18n = i18n;

const el = document.createElement('div');
document.body.appendChild(el);
new Vue({
  render: h => h(App),
})
.$mount(el);

const init = debounce(() => {
  injectContent('setPopup()');
  delayClear();
}, 100);
let delayedClear;

Object.assign(handlers, {
  GetPopup: init,
  SetPopup(data, src) {
    cancelClear();
    store.currentTab = src;
    if (/^https?:\/\//i.test(src.tab.url)) {
      const matches = src.tab.url.match(/:\/\/([^/]*)/);
      const domain = matches[1];
      store.domain = tld.getDomain(domain) || domain;
    }
    store.commands = Object.entries(data.menus)
    .reduce((map, [id, values]) => {
      map[id] = Object.keys(values).sort();
      return map;
    }, {});
    sendMessage({
      cmd: 'GetMetas',
      data: data.ids,
    })
    .then((scripts) => {
      store.scripts = scripts;
    });
  },
});
browser.tabs.onActivated.addListener(({ tabId }) => {
  store.currentTab = { tabId };
  init();
});
browser.tabs.onUpdated.addListener(init);
init();

function clear() {
  store.scripts = [];
  store.commands = [];
  store.domain = '';
  delayedClear = null;
}
function cancelClear() {
  if (delayedClear) clearTimeout(delayedClear);
}
function delayClear() {
  cancelClear();
  delayedClear = setTimeout(clear, 200);
}
