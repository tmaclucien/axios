'use strict';

export default function bind(fn, thisArg) {
  // 用法：axios(config)， arguments即为config
  return function wrap() {
    return fn.apply(thisArg, arguments);
  };
}
