//定制请求的实例

//导入axios  npm install axios
import axios, { type AxiosInstance } from 'axios';
import { ElMessage } from 'element-plus';

// ----Create an axios instance
//定义一个变量,记录公共的前缀  ,  baseURL
// const base_URL = 'http://localhost:8080';
const base_URL = '/api';

// const instance = axios.create({baseURL})
const instance: AxiosInstance = axios.create({
  baseURL: base_URL, // import.meta.env.VITE_API_BASE_URL, // api base_url
  timeout: 5000, // request timeout
});


// -----------------------------------------------------
//导入token状态
// import { useTokenStore } from '@/stores/token.js';
// import router from '@/router/index.js';
// -----------------------------------------------------

// 请求拦截器
instance.interceptors.request.use(
    (config ) => {
        // // 在发送请求之前做什么
        // let tokenStore = useTokenStore()
        // // 如果token中有值，在携带
        // if (tokenStore.token) {
        //     config.headers.Authorization = tokenStore.token
        // }
        return config
    },
    (err) => {
        // 如果请求错误做什么
        console.log(err); // for debug

        return Promise.reject(err)
    }
)

// 响应拦截器
instance.interceptors.response.use(

    (response) => {
        // const {code,message, data} = response.data 
        if (response.data.code === 0) {
            return response.data;
        }
        // alert(result.msg?result.msg:'服务异常')
        ElMessage.error(response.data.message ? response.data.message : '服务异常')
        return Promise.reject(response.data);//异步的状态转化成失败的状态
    },

    (err) => {
        console.log('response-err=' + err); // for debug

        // 如果响应状态码时401，代表未登录，给出对应的提示，并跳转到登录页
        if (err.response.status === 401) {
            ElMessage.error('请先登录！')
            
            // ------------------------
            // router.push('/login')
            // ------------------------
        } else {
            // ElMessage({
            //     message: err.message || 'Error',
            //     type: 'error',
            //     duration: 5 * 1000,
            // });

            ElMessage.error('服务异常');
        }

        return Promise.reject(err);//异步的状态转化成失败的状态
    }
)
 

export default instance;