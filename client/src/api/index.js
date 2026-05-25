import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  withCredentials: true, // sends HttpOnly cookie automatically on every request
});

// Token no longer stored in localStorage — the HttpOnly cookie handles auth.
// This interceptor catches expired sessions and redirects cleanly.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale user display data and force re-login
      localStorage.removeItem('user');
      const publicPaths = ['/login', '/register'];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
