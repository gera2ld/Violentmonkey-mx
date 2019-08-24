import { i18n, noop } from '#/common';

export function notify(options) {
  browser.notifications.create(options.id || 'ViolentMonkey', {
    title: `${options.title} - ${i18n('extName')}`,
    message: options.body,
    isClickable: options.isClickable,
  });
}

export function broadcast(data) {
  browser.__send('CONTENT', data);
}

export function sendMessageOrIgnore(...args) {
  return browser.runtime.sendMessage(...args).catch(noop);
}
