// src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: "http://localhost:3001",
  timeout: 10000,
  withCredentials: true
});

apiClient.interceptors.response.use(
  (response) => response.data, // 统一脱壳
  (error) => {
    // 统一错误处理，例如调用 antd 的 message.error
    return Promise.reject(error);
  }
);

export default apiClient;