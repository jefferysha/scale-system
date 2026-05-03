import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the system title', () => {
    render(<App />);
    expect(screen.getByText('天平称重系统')).toBeInTheDocument();
  });
});
