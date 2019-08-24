import { getUniqId, sendMessage } from './utils';
import initialize from './content';

(function main() {
  // Avoid running repeatedly due to new `document.documentElement`
  const VM_KEY = '__Violentmonkey';
  if (window[VM_KEY]) return;
  window[VM_KEY] = 1;

  browser.__isContent = true;

  function initBridge() {
    const contentId = getUniqId();
    const webId = getUniqId();
    initialize(contentId, webId);
  }

  initBridge();

  function createElement(tagName, props, children) {
    const el = document.createElement(tagName);
    if (props) {
      Object.keys(props).forEach((key) => {
        if (key === 'on') {
          const events = props[key];
          Object.keys(events).forEach((type) => {
            el.addEventListener(type, events[type], false);
          });
        } else {
          el[key] = props[key];
        }
      });
    }
    if (children) {
      children.forEach((child) => {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else {
          el.appendChild(child);
        }
      });
    }
    return el;
  }

  function notifyCharset() {
    return new Promise((resolve, reject) => {
      const notice = createElement('div', {
        style: 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4)',
      }, [
        createElement('div', {
          style: 'position:absolute;width:400px;top:0;left:50%;margin-left:-200px;padding:20px;border:1px solid #ddd;background:#fff;',
        }, [
          createElement('h3', {
            textContent: 'Character encoding may be incorrect.',
          }),
          createElement('p', null, [
            'You may need to set character encoding to ',
            createElement('strong', { textContent: 'UTF-8' }),
            ' manually in the browser. Continue anyway?',
          ]),
          createElement('button', {
            textContent: 'Continue',
            on: {
              click: resolve,
            },
          }),
          createElement('button', {
            textContent: 'Later',
            on: {
              click() {
                reject();
                notice.parentNode.removeChild(notice);
              },
            },
          }),
        ]),
      ]);
      document.body.appendChild(notice);
    });
  }

  // For installation
  function checkJS() {
    if (!document.querySelector('title')) {
      // plain text
      const pre = document.querySelector('pre');
      (document.characterSet === 'UTF-8'
        ? Promise.resolve()
        : notifyCharset())
      .then(() => sendMessage({
        cmd: 'ConfirmInstall',
        data: {
          code: pre.textContent,
          url: window.location.href,
          from: document.referrer,
        },
      }))
      .then(() => {
        if (window.history.length > 1) window.history.go(-1);
        else browser.__ensureTabId().then(() => sendMessage({ cmd: 'TabClose' }));
      }, () => {});
    }
  }
  if (/\.user\.js$/.test(window.location.pathname)) {
    if (document.readyState === 'complete') checkJS();
    else window.addEventListener('load', checkJS, false);
  }
}());
