import * as React from 'react';
import { useAuth } from '../context/AuthContext';

export interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground p-6 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-destructive">ACCESS DENIED</h2>
          <p className="text-sm text-muted-foreground">
            You do not have sufficient permissions to view this page. Contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
