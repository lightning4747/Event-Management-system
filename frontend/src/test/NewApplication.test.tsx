import { render, screen, fireEvent } from '@testing-library/react';
import { NewApplication } from '../pages/NewApplication';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: '727624BAD115', role: 'Student', fullName: 'BOW' },
    token: 'mock-token',
  }),
}));

describe('NewApplication Form Validations', () => {
  it('shows error messages for empty fields and blocks submission', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NewApplication />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Event title is required./i)).toBeInTheDocument();
    expect(await screen.findByText(/Event location is required./i)).toBeInTheDocument();
    expect(await screen.findByText(/Start date is required./i)).toBeInTheDocument();
    expect(await screen.findByText(/End date is required./i)).toBeInTheDocument();
  });

  it('triggers error validation when end date is before start date', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NewApplication />
        </BrowserRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/Event Title/i), { target: { value: 'TechFest' } });
    fireEvent.change(screen.getByLabelText(/Event Location/i), { target: { value: 'Block C' } });
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2026-07-20' } });
    fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2026-07-18' } });

    const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/End date must be on or after start date./i)).toBeInTheDocument();
  });
});
