## Questions

1. axios.interceptors.request.use(config => config, error => {
   // 是否可以直接 return error ？
   return Promise.reject(error);
   });
