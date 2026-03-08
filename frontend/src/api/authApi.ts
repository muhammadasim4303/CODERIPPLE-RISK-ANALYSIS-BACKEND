import axiosInstance from './axiosInstance';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  github_id: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  // Initiate GitHub OAuth flow
  initiateGithubAuth: () => {
    // In real implementation, redirect to backend OAuth endpoint
    window.location.href = `${axiosInstance.defaults.baseURL}/auth/github`;
  },

  // Handle OAuth callback
  handleCallback: async (code: string): Promise<AuthResponse> => {
    const response = await axiosInstance.post<AuthResponse>('/auth/github/callback', { code });
    return response.data;
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await axiosInstance.get<User>('/auth/me');
    return response.data;
  },

  // Logout
  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
    localStorage.removeItem('auth_token');
  },

  // Refresh token
  refreshToken: async (): Promise<{ token: string }> => {
    const response = await axiosInstance.post<{ token: string }>('/auth/refresh');
    return response.data;
  },
};
