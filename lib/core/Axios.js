'use strict';

import utils from './../utils.js';
import buildURL from '../helpers/buildURL.js';
import InterceptorManager from './InterceptorManager.js';
import dispatchRequest from './dispatchRequest.js';
import mergeConfig from './mergeConfig.js';
import buildFullPath from './buildFullPath.js';
import validator from '../helpers/validator.js';
import AxiosHeaders from './AxiosHeaders.js';

const validators = validator.validators;

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 *
 * @return {Axios} A new instance of Axios
 */
class Axios {
  constructor(instanceConfig) {
    this.defaults = instanceConfig;
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager()
    };
  }

  /**
   * 核心的请求方法，所有的请求最终都会指向这个方法
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  request(configOrUrl, config) {
    /*eslint no-param-reassign:0*/
    // Allow for axios('example/url'[, config]) a la fetch API
    // 判断参数类型，从而支持不同的请求形式：axios(url, config), axios(config)
    if (typeof configOrUrl === 'string') {
      config = config || {};
      config.url = configOrUrl; // config: {url, baseURL} 请求的相对地址就是第一个传进来的参数configUrl
    } else {
      config = configOrUrl || {}; // 如果configUrl不是字符串，那么就是对象形式
    }

    config = mergeConfig(this.defaults, config); // 将实例请求的参数对象和创建实例时的默认配置进行合并；优先级：deafults -> instanceConfig -> requestConfig

    const {transitional, paramsSerializer, headers} = config;

    if (transitional !== undefined) {
      validator.assertOptions(transitional, {
        silentJSONParsing: validators.transitional(validators.boolean),
        forcedJSONParsing: validators.transitional(validators.boolean),
        clarifyTimeoutError: validators.transitional(validators.boolean)
      }, false);
    }

    if (paramsSerializer != null) {
      if (utils.isFunction(paramsSerializer)) {
        config.paramsSerializer = {
          serialize: paramsSerializer
        }
      } else {
        validator.assertOptions(paramsSerializer, {
          encode: validators.function,
          serialize: validators.function
        }, true);
      }
    }

    // Set config.method：转换请求方法至小写
    config.method = (config.method || this.defaults.method || 'get').toLowerCase();

    // Flatten headers
    let contextHeaders = headers && utils.merge(
      headers.common,
      headers[config.method]
    );

    headers && utils.forEach(
      ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
      (method) => {
        delete headers[method];
      }
    );

    config.headers = AxiosHeaders.concat(contextHeaders, headers);

    // filter out skipped interceptors
    /* request interceptor chains */
    const requestInterceptorChain = [];
    let synchronousRequestInterceptors = true;
    /* （1）InterceptorManager.prototype.forEach */
    /* （2）interceptor === {fulfilled， rejected，synchronous， runWhen} */
    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
      if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
        return;
      }

      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous; // output: false

      /* (1) output: [requestFulfilled2, requestRejected2, requestFulfilled1, requestRejected1, ...] */
      /* (2) FILO: First in, last out  */
      requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected); 
    });
    /* response interceptor chains */
    const responseInterceptorChain = [];
    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
      /* (1) output: [responseFulfilled1, responseRejected1, responseFulfilled2, responseRejected2, ...] */
      /* (2) : First in, first out  */
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected); 
    });

    let promise;
    let i = 0;
    let len;

    /* asynchronous way */
    if (!synchronousRequestInterceptors) {
      /* （1）The chain array is used to store request interceptors, dispatchRequest function and response interceptors in the specified order */
      /*  (2) chain example: [..., requestFulfilled2, requestRejected2, requestFulfilled1, requestRejected1, dispatchRequest.bind(this), undefined, responseFulfilled1, responseRejected1, responseFulfilled2, responseRejected2, ...] */
      /* （3）excute those functions one by one from left to right by using promise*/
      /* （4）return this promise in the Axios.prototype.request */
      const chain = [dispatchRequest.bind(this), undefined];
      chain.unshift.apply(chain, requestInterceptorChain); 
      chain.push.apply(chain, responseInterceptorChain); 
      len = chain.length;

      /* (1) This promise always resolve axios config*/
      /* (2) By resolving config, we could access axios config in those interceptors fulfiiled callback functions' params */
      promise = Promise.resolve(config);

      /*
      * promise chains excution explanation: 
      *   promise
      *    .then(
      *      requestFulfilled2, => request fulfilled function must return the config 
      *      requestRejected2
      *    )
      *   .then(
      *     requestFulfilled1, =>  next requestinterceptor's fulfilled funtion could receive the config as long as the previous one return it 
      *     requestRejected1
      *   )
      *   ....
      *   .then(
      *     dispatchRequest,
      *     undefined
      *   )
      *   ...
      *   .then(
      *     responseFulfilled1, => response fulfilled function must return the response 
      *     requestRejected1
      *   )
      *   .then(
      *     responseFulfilled2, =>  next response interceptor's fulfilled funtion could receive the config/response as long as the previous one return it 
      *     responsetRejected2
      *   )
      * 
      */
      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }

      return promise;
    }

    /* Notice: Both asynchronous and synchronous way will follow "from left to right", the only difference is that asynchronous way will not block the main thread */

    /* synchronous way */
    len = requestInterceptorChain.length;

    let newConfig = config;

    i = 0;

    /* step1: excute request interceptors */
    /* while method has block effect, that's how synchronous way works */
    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];
      const onRejected = requestInterceptorChain[i++];
      try {
        newConfig = onFulfilled(newConfig);
      } catch (error) {
        onRejected.call(this, error);
        break;
      }
    }

    /* step2: excute dispatchRequest method */
    try {
      promise = dispatchRequest.call(this, newConfig);
    } catch (error) {
      return Promise.reject(error);
    }

    i = 0;
    len = responseInterceptorChain.length;

    /* step3: excute response interceptors */
    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }

    return promise;
  }

  getUri(config) {
    config = mergeConfig(this.defaults, config);
    const fullPath = buildFullPath(config.baseURL, config.url);
    return buildURL(fullPath, config.params, config.paramsSerializer);
  }
}

// Provide aliases for supported request methods：这里将普通的请求（无body请求体数据）挂载到Axios类的原型上
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(mergeConfig(config || {}, {
      method,
      url,
      data: (config || {}).data
    }));
  };
});

// 这里将带有body请求体数据的请求方法挂载到Axios类的原型上
utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/

  function generateHTTPMethod(isForm) {
    return function httpMethod(url, data, config) {
      return this.request(mergeConfig(config || {}, {
        method,
        headers: isForm ? {
          'Content-Type': 'multipart/form-data'
        } : {},
        url,
        data
      }));
    };
  }

  Axios.prototype[method] = generateHTTPMethod();

  Axios.prototype[method + 'Form'] = generateHTTPMethod(true);
});

export default Axios;
