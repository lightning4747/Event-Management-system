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
    expect(await screen.findByText(/Institution name is required./i)).toBeInTheDocument();
    expect(await screen.findByText(/Start date is required./i)).toBeInTheDocument();
    expect(await screen.findByText(/End date is required./i)).toBeInTheDocument();
    expect(await screen.findByText(/Event proof \/ permission document/i)).toBeInTheDocument();
  });

  it('triggers error validation when end date is before start date', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NewApplication />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const titleInput = screen.getByLabelText(/Event Title/i);
    const locationInput = screen.getByLabelText(/Name of the Institution/i);
    const fromDateInput = screen.getByLabelText(/Start Date/i);
    const toDateInput = screen.getByLabelText(/End Date/i);

    // Provide future dates where toDate < fromDate
    const today = new Date();
    const futureFrom = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const futureTo = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    fireEvent.change(titleInput, { target: { value: 'TechFest' } });
    fireEvent.change(locationInput, { target: { value: 'Block C' } });
    fireEvent.change(fromDateInput, { target: { value: futureFrom } });
    fireEvent.change(toDateInput, { target: { value: futureTo } });

    const categorySelect = screen.getByLabelText(/Category/i);
    fireEvent.change(categorySelect, { target: { value: 'Co-curricular' } });

    const typeSelect = await screen.findByLabelText(/Activity Type/i);
    fireEvent.change(typeSelect, { target: { value: 'Hackathon' } });

    const proofInput = screen.getByLabelText(/Event Proof \/ Permission Document/i);
    const mockFile = new File(['proof content'], 'permission.pdf', { type: 'application/pdf' });
    fireEvent.change(proofInput, { target: { files: [mockFile] } });

    const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/End date must be on or after start date./i)).toBeInTheDocument();
  });
});
