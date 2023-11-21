'use strict';

import utils from './utils.js';
import bind from './helpers/bind.js';
import Axios from './core/Axios.js';
import mergeConfig from './core/mergeConfig.js';
import defaults from './defaults/index.js';
import formDataToJSON from './helpers/formDataToJSON.js';
import CanceledError from './cancel/CanceledError.js';
import CancelToken from './cancel/CancelToken.js';
import isCancel from './cancel/isCancel.js';
import {VERSION} from './env/data.js';
import toFormData from './helpers/toFormData.js';
import AxiosError from './core/AxiosError.js';
import spread from './helpers/spread.js';
import isAxiosError from './helpers/isAxiosError.js';
import AxiosHeaders from "./core/AxiosHeaders.js";
import adapters from './adapters/adapters.js';
import HttpStatusCode from './helpers/HttpStatusCode.js';

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 *
 * @returns {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  // 根据axios官方提供的默认配置创建一个axios上下文实例对象（包含了：默认配置【请求的超时时间，请求头信息】,相应的拦截器对象）
  const context = new Axios(defaultConfig); 
  // （1）bind返回的是一个wrap()函数所以我们使用时可以用axios(config)函数来发送请求,axios(config) === axios.request(config)
  //  (2) instance = function wrap() {
  //   return Axios.prototype.request.apply(context, config)
  // }
  const instance = bind(Axios.prototype.request, context); // instance = Axios.prototype.request.bind(context)

  // （3）打印instance.prototype，构造函数constructor的属性只有name，length这些只读属性

  // Copy axios.prototype to instance：把原型上的方法继承到instance上，instance.get(), instance.post()
  utils.extend(instance, Axios.prototype, context, {allOwnKeys: true});

  //（4）打印instance.prototype，构造函数的属性多了Axios.prototype上的所有属性，这些属性函数指向的是context实例

  // Copy context to instance: 将context实例的可枚举属性（defaults和interceptors）拷贝到instance构造函数中
  utils.extend(instance, context, null, {allOwnKeys: true});

  /* 以上的这些操作，总结就是将Axios类的构造函数的属性和原型上的属性拷贝到instance函数对象上 */

  // Factory for creating new instances：工厂函数，在实例对象上添加create函数，是为了大型应用或者多域使用的场景下，方便创造多个axios实例，不同的axios实例可以设置不同的baseURL
  instance.create = function create(instanceConfig) {
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };

  return instance;
}

// Create the default instance to be exported
/* axios.__proto__ === Function.prototype  => axios是一个函数*/
const axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Expose Cancel & CancelToken
axios.CanceledError = CanceledError;
axios.CancelToken = CancelToken;
axios.isCancel = isCancel;
axios.VERSION = VERSION;
axios.toFormData = toFormData;

// Expose AxiosError class
axios.AxiosError = AxiosError;

// alias for CanceledError for backward compatibility
axios.Cancel = axios.CanceledError;

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};

axios.spread = spread;

// Expose isAxiosError
axios.isAxiosError = isAxiosError;

// Expose mergeConfig
axios.mergeConfig = mergeConfig;

axios.AxiosHeaders = AxiosHeaders;

axios.formToJSON = thing => formDataToJSON(utils.isHTMLForm(thing) ? new FormData(thing) : thing);

axios.getAdapter = adapters.getAdapter;

axios.HttpStatusCode = HttpStatusCode;

axios.default = axios;

// this module should only have a default export
export default axios
