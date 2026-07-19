import * as React from 'react';

export interface UserSession {
  userId: string;
  role: string;
}

export interface AuthContextType {
  token: string | null;
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, role: string, userId: string) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const decodeToken = (token: string): UserSession | null => {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = atob(parts[1]);
      const payload = JSON.parse(payloadStr);
      if (payload.userId && payload.role) {
        return {
          userId: payload.userId,
          role: payload.role,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const storedToken = localStorage.getItem('mcet_auth_token');
    if (storedToken) {
      const decoded = decodeToken(storedToken);
      if (decoded) {
        setToken(storedToken);
        setUser(decoded);
      } else {
        localStorage.removeItem('mcet_auth_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, role: string, userId: string) => {
    localStorage.setItem('mcet_auth_token', newToken);
    setToken(newToken);
    setUser({ role, userId });
  };

  const logout = () => {
    localStorage.removeItem('mcet_auth_token');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
