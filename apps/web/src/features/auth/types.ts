export interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'operator' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: User;
  refresh_token: string | null;
}
