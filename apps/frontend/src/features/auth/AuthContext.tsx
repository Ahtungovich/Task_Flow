import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ReactNode, createContext, useContext } from 'react';
import { ApiError } from '../../shared/api/client';
import { UserProfile } from '../../shared/types/domain';
import { LoginPayload, RegisterPayload, authApi } from './authApi';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  register: (payload: RegisterPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await authApi.getMe();
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 401) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (res) => {
      queryClient.setQueryData(['auth', 'me'], res.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (res) => {
      queryClient.setQueryData(['auth', 'me'], res.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
    },
  });

  const user = data ?? null;

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login: async (payload) => {
      const res = await loginMutation.mutateAsync(payload);
      return res.user;
    },
    register: async (payload) => {
      const res = await registerMutation.mutateAsync(payload);
      return res.user;
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    setUser: (updatedUser) => {
      queryClient.setQueryData(['auth', 'me'], updatedUser);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return ctx;
}
