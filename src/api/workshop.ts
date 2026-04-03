import request from '@/utils/request'
// import { useTokenStore } from '@/stores/token.js'


// Define the Data Type from server 
export interface TData {
  code:    number;
  message: string;
  data:    any;
}

// The service function now returns a Promise that resolves to an array of WorkshopParam objects
export const workshopParamsService = (): Promise<{ data: TData }> => {
    //获取token状态
    // const tokenStore = useTokenStore()
    // //通过请求头Authorization携带token
    // return request.get('/category', { headers: { 'Authorization': tokenStore.token } })    
    return request.get('/json/a.json');
};

// // 添加 
// export const articleCategoryAddService = (categoryModel) => {
//     return request.post('/category', categoryModel)
// }

// // 修改 
// export const articleCategoryUpdateService = (categoryModel) => {
//     return request.put('/category', categoryModel)
// }

// // 删除 
// export const articleCategoryDeleteService = (id) => {
//     return request.delete('/category?id=' + id)
// }
// // 列表查询
// export const articleListService = (params) => {
//     return request.get('/article', { params: params })
// }
 