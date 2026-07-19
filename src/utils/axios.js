import axios from 'axios';
// config
import { BASE_URL } from '../config';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: BASE_URL });

const accessToken = window.localStorage.getItem("accessToken");

if (accessToken) {
  axiosInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject((error.response && error.response.data) || 'Something went wrong')
);

export default axiosInstance;
