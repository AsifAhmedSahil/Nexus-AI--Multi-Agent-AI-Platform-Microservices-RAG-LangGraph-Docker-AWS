import proxy from "express-http-proxy"


export const proxyWithHeader = (serviceUrl, options = {}) =>{
    return proxy(serviceUrl,{
        ...options,
        timeout: 300000,
        proxyReqOptDecorator:(proxyReqOpts,srcReq)=>{
            if(srcReq.user){
                proxyReqOpts.headers["x-user-id"] = srcReq.user.userId
            }

            return proxyReqOpts
        }
    })
}
