import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';

import { Eye, EyeOff } from 'lucide-react';

const loginFormSchema = z.object({
  userId: z.string().min(1, 'Register Number or Faculty ID is required.').trim(),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      userId: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const cleanedValues = {
        userId: values.userId.trim().toUpperCase(),
        password: values.password,
      };
      
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(cleanedValues),
      });
      const data = await response.json();
      login(data.token, data.role, data.userId);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 shadow-2xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="h-10 w-10 bg-white/5 rounded-lg flex items-center justify-center mx-auto text-white border border-white/10 mb-4">
            <span className="font-extrabold text-sm">MCET</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Department of AI&DS</h1>
          <p className="text-xs text-muted-foreground">On-Duty approval management portal</p>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">Register Number / Faculty ID</Label>
            <Input
              id="userId"
              placeholder="e.g. 727624BAD115"
              {...register('userId')}
              disabled={isSubmitting}
            />
            {errors.userId && (
              <p className="text-xs text-destructive font-medium">{errors.userId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                disabled={isSubmitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </main>
  );
};
