import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  withCredentials: true,
});

let refreshando = false;
let filaDeEspera = [];

const processarFila = (erro) => {
  filaDeEspera.forEach((p) => (erro ? p.reject(erro) : p.resolve()));
  filaDeEspera = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Se não for 401, ou já tentou refresh, ou é a própria rota de refresh/login: rejeita
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/login')
    ) {
      if (error.response?.status === 401) {
        localStorage.removeItem('user');
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
        if (!publicPaths.some((p) => window.location.pathname.startsWith(p))) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }

    // Se já há um refresh em andamento, enfileira a requisição
    if (refreshando) {
      return new Promise((resolve, reject) => {
        filaDeEspera.push({
          resolve: () => resolve(api(original)),
          reject,
        });
      });
    }

    original._retry = true;
    refreshando = true;

    try {
      await api.post('/auth/refresh');
      processarFila(null);
      return api(original);
    } catch {
      processarFila(new Error('Sessão expirada'));
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      refreshando = false;
    }
  }
);

export default api;
