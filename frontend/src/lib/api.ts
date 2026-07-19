const getAuthToken = (): string | null => {
  return localStorage.getItem('mcet_auth_token');
};

export interface APIError extends Error {
  status?: number;
  code?: string;
}

export const apiFetch = async (
  path: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set content type for JSON payloads
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  const response = await fetch(`${baseUrl}${cleanPath}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An unexpected error occurred.';
    let errBody: any = {};
    try {
      errBody = await response.json();
      errorMsg = errBody.error?.message || errBody.message || errorMsg;
    } catch {
      try {
        const textBody = await response.text();
        if (textBody && textBody.length < 150 && !textBody.trim().startsWith('<')) {
          errorMsg = textBody;
        } else {
          errorMsg = `Server error ${response.status}: ${response.statusText}`;
        }
      } catch {
        errorMsg = `Server error ${response.status}: ${response.statusText}`;
      }
    }
    const error = new Error(errorMsg) as APIError;
    error.status = response.status;
    error.code = errBody?.error?.code || errBody?.code;
    throw error;
  }

  return response;
};
