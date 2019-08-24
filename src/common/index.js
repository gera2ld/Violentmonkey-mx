export function i18n(name, args) {
  return browser.i18n.getMessage(name, args) || name;
}
export const defaultImage = '/icons/icon_48.png';

export function normalizeKeys(key) {
  if (key == null) return [];
  if (Array.isArray(key)) return key;
  return `${key}`.split('.').filter(Boolean);
}

export function initHooks() {
  const hooks = [];

  function fire(data) {
    hooks.slice().forEach((cb) => {
      cb(data);
    });
  }

  function hook(callback) {
    hooks.push(callback);
    return () => {
      const i = hooks.indexOf(callback);
      if (i >= 0) hooks.splice(i, 1);
    };
  }

  return { hook, fire };
}

export function sendMessage(payload) {
  const promise = browser.runtime.sendMessage(payload)
  .then((res) => {
    const { data, error } = res || {};
    if (error) return Promise.reject(error);
    return data;
  });
  promise.catch((err) => {
    if (process.env.DEBUG) console.warn(err);
  });
  return promise;
}

export function debounce(func, time) {
  let timer;
  function run(thisObj, args) {
    timer = null;
    func.apply(thisObj, args);
  }
  return function debouncedFunction(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, time, this, args);
  };
}

export function throttle(func, time) {
  let timer;
  function run(thisObj, args) {
    timer = null;
    func.apply(thisObj, args);
  }
  return function throttledFunction(...args) {
    if (!timer) {
      timer = setTimeout(run, time, this, args);
    }
  };
}

export function noop() {}

export function leftpad(input, length, pad = '0') {
  let num = input.toString();
  while (num.length < length) num = `${pad}${num}`;
  return num;
}

export function getRnd4() {
  return Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(-4);
}

export function getUniqId(prefix) {
  return (prefix || '') + Date.now().toString(36) + getRnd4();
}

/**
 * Get locale attributes such as `@name:zh-CN`
 */
export function getLocaleString(meta, key) {
  const languages = navigator.languages || [navigator.language];
  if (languages.length === 1) {
    const i = languages[0].indexOf('-');
    if (i > 0) languages.push(languages[0].slice(0, i));
  }
  const localeMeta = languages
  .map(lang => meta[`${key}:${lang}`] || meta[`${key}:${lang.toLowerCase()}`])
  .find(Boolean);
  return localeMeta || meta[key] || '';
}

const __rt = {};
export function injectContent(script, tabId) {
  let { br } = __rt;
  if (!br) {
    const rt = window.external.mxGetRuntime();
    br = rt && rt.create('mx.browser');
    __rt.br = br;
  }
  br.executeScript(`if(window.mx)try{${script}}catch(e){}`, tabId);
}

const binaryTypes = [
  'blob',
  'arraybuffer',
];

/**
 * Make a request.
 * @param {String} url
 * @param {Object} headers
 * @return Promise
 */
export function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const { responseType } = options;
    xhr.open(options.method || 'GET', url, true);
    if (binaryTypes.includes(responseType)) xhr.responseType = responseType;
    const headers = Object.assign({}, options.headers);
    let { body } = options;
    if (body && Object.prototype.toString.call(body) === '[object Object]') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    Object.keys(headers).forEach((key) => {
      xhr.setRequestHeader(key, headers[key]);
    });
    xhr.onload = () => {
      const res = getResponse(xhr, {
        // status for `file:` protocol will always be `0`
        status: xhr.status || 200,
      });
      if (res.status > 300) reject(res);
      else resolve(res);
    };
    xhr.onerror = () => {
      const res = getResponse(xhr, { status: -1 });
      reject(res);
    };
    xhr.onabort = xhr.onerror;
    xhr.ontimeout = xhr.onerror;
    xhr.send(body);
  });
  function getResponse(xhr, extra) {
    const { responseType } = options;
    let data;
    if (binaryTypes.includes(responseType)) {
      data = xhr.response;
    } else {
      data = xhr.responseText;
    }
    if (responseType === 'json') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        // Ignore invalid JSON
      }
    }
    return Object.assign({
      url,
      data,
      xhr,
    }, extra);
  }
}

export function buffer2string(buffer) {
  const array = new window.Uint8Array(buffer);
  const sliceSize = 8192;
  let str = '';
  for (let i = 0; i < array.length; i += sliceSize) {
    str += String.fromCharCode.apply(null, array.subarray(i, i + sliceSize));
  }
  return str;
}

export function getFullUrl(url, base) { // eslint-disable-line
  // Maxthon sucks
  // Maxthon does not support URL constructor
  // TODO add polyfill for URL constructor
  return url;
}

export function isRemote(url) {
  return url && !(/^(file:|data:|https?:\/\/localhost[:/]|http:\/\/127\.0\.0\.1[:/])/.test(url));
}

export function cache2blobUrl(raw, { defaultType, type: overrideType } = {}) {
  if (raw) {
    const parts = `${raw}`.split(',');
    const { length } = parts;
    const b64 = parts[length - 1];
    const type = overrideType || parts[length - 2] || defaultType || '';
    // Binary string is not supported by blob constructor,
    // so we have to transform it into array buffer.
    const bin = window.atob(b64);
    const arr = new window.Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type });
    return URL.createObjectURL(blob);
  }
}

export function encodeFilename(name) {
  // `escape` generated URI has % in it
  return name.replace(/[-\\/:*?"<>|%\s]/g, (m) => {
    let code = m.charCodeAt(0).toString(16);
    if (code.length < 2) code = `0${code}`;
    return `-${code}`;
  });
}

export function decodeFilename(filename) {
  return filename.replace(/-([0-9a-f]{2})/g, (_m, g) => String.fromCharCode(parseInt(g, 16)));
}

export function compareVersion(ver1, ver2) {
  const parts1 = (ver1 || '').split('.');
  const parts2 = (ver2 || '').split('.');
  for (let i = 0; i < parts1.length || i < parts2.length; i += 1) {
    const delta = (parseInt(parts1[i], 10) || 0) - (parseInt(parts2[i], 10) || 0);
    if (delta) return delta < 0 ? -1 : 1;
  }
  return 0;
}

const units = [
  ['min', 60],
  ['h', 24],
  ['d', 1000, 365],
  ['y'],
];
export function formatTime(duration) {
  duration /= 60 * 1000;
  const unitInfo = units.find((item) => {
    const max = item[1];
    if (!max || duration < max) return true;
    const step = item[2] || max;
    duration /= step;
    return false;
  });
  return `${duration | 0}${unitInfo[0]}`;
}
