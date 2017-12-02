import 'src/common/browser';
import { inject, getUniqId, sendMessage } from './utils';
import initialize from './content';

(function main() {
  // Ignore XML, etc.
  if (document.documentElement.tagName.toLowerCase() !== 'html') return;

  // Avoid running repeatedly due to new `document.documentElement`
  if (window.VM) return;
  window.VM = 1;

  browser.__isContent = true;

  function initBridge() {
    const contentId = getUniqId();
    const webId = getUniqId();
    initialize(contentId, webId).then(needInject => {
      if (needInject) {
        doInject(contentId, webId);
      }
    });
  }

  function doInject(contentId, webId) {
    const props = {};
    [
      Object.getOwnPropertyNames(window),
      Object.getOwnPropertyNames(global),
    ].forEach(keys => {
      keys.forEach(key => { props[key] = 1; });
    });
    const args = [
      JSON.stringify(webId),
      JSON.stringify(contentId),
      JSON.stringify(Object.keys(props)),
    ];
    inject(`(${window.VM_initializeWeb.toString()}())(${args.join(',')})`);
  }

  initBridge();

  // For installation
  function checkJS() {
    if (!document.querySelector('title')) {
      // plain text
      sendMessage({
        cmd: 'ConfirmInstall',
        data: {
          code: document.body.textContent,
          url: window.location.href,
          from: document.referrer,
        },
      })
      .then(() => {
        if (window.history.length > 1) window.history.go(-1);
        else browser.__ensureTabId().then(() => sendMessage({ cmd: 'TabClose' }));
      });
    }
  }
  if (/\.user\.js$/.test(window.location.pathname)) {
    if (document.readyState === 'complete') checkJS();
    else window.addEventListener('load', checkJS, false);
  }
}());
