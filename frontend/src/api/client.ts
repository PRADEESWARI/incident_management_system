import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ims_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ims_token');
      localStorage.removeItem('ims_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const signalClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.REACT_APP_SIGNAL_API_KEY || 'signal-ingestion-api-key-2024',
  },
});
