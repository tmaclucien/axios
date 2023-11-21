'use strict';

import utils from './../utils.js';

class InterceptorManager {
  constructor() {
    /* store fulfilled and rejected function as an object in the array, like: {fulfilled，rejected,synchronous， runWhen} */
    this.handlers = [];
  }

  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(fulfilled, rejected, options) {
    this.handlers.push({
      fulfilled,
      rejected,
      synchronous: options ? options.synchronous : false, // as default, the interceptors will be excute in an asynchronous way
      runWhen: options ? options.runWhen : null // 如果要基于运行时检查执行特定拦截器，可以通过这个runWhen这个参数，类型为函数
    });
    /* (1) return the register index of the interceptor in the chain array, and could be deleted by eject(index) */
    /* (2) index = axios.request.interceptors.use(); axios.interceptors.request.eject(index) */
    return this.handlers.length - 1; 
  }

  /**
   * Remove an interceptor from the stack：
   *
   * @param {Number} id The ID(or index) that was returned by `use`
   *
   * @returns {Boolean} `true` if the interceptor was removed, `false` otherwise
   */
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  clear() {
    if (this.handlers) {
      this.handlers = [];
    }
  }

  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(fn) {
    /* （1）utils.forEach will interate over every obj({fulfilled, rejected, synchronous， runWhen}) stored in handlers arr*/
    /* （2）excute forEachHander(obj)*/
    /*  (3) if obj !== null 如果obj不为空，既说明我们在拦截的时候传入了成功或者失败回调函数*/
    /*  (4) 执行fn，obj作为参数*/
    utils.forEach(this.handlers, function forEachHandler(h) {
      if (h !== null) {
        fn(h);
      }
    });
  }
}

export default InterceptorManager;
