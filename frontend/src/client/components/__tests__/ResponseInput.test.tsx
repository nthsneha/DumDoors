import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResponseInput } from '../ResponseInput';

// Mock the CSS classes that might not be available in test environment
vi.mock('../../index.css', () => ({}));

describe('ResponseInput', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders with default props', () => {
    render(<ResponseInput onSubmit={mockOnSubmit} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    expect(textarea).toBeInTheDocument();
    
    // When timeLeft is 0 (default), button shows "Time expired"
    const submitButton = screen.getByRole('button', { name: /time expired/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('shows character count and updates in real-time', () => {
    render(<ResponseInput onSubmit={mockOnSubmit} timeLeft={60} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    const charCount = screen.getByText('0/500 characters');
    
    expect(charCount).toBeInTheDocument();
    
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    
    expect(screen.getByText('11/500 characters')).toBeInTheDocument();
  });

  it('validates response length and shows errors', async () => {
    render(<ResponseInput onSubmit={mockOnSubmit} timeLeft={60} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    const submitButton = screen.getByRole('button', { name: /submit your response/i });
    
    // Test empty response - button should be disabled, so we need to interact first
    fireEvent.change(textarea, { target: { value: 'test' } }); // Enable button
    fireEvent.change(textarea, { target: { value: '' } }); // Clear to trigger validation
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Response cannot be empty')).toBeInTheDocument();
    });
    
    // Test too short response
    fireEvent.change(textarea, { target: { value: 'Hi' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Response must be at least 10 characters long')).toBeInTheDocument();
    });
  });

  it('enables submit button when valid response is entered', () => {
    render(<ResponseInput onSubmit={mockOnSubmit} timeLeft={60} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    const submitButton = screen.getByRole('button', { name: /submit your response/i });
    
    expect(submitButton).toBeDisabled();
    
    fireEvent.change(textarea, { target: { value: 'This is a valid response with enough characters' } });
    
    expect(submitButton).toBeEnabled();
  });

  it('calls onSubmit with valid response', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    
    render(<ResponseInput onSubmit={mockOnSubmit} timeLeft={60} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    const submitButton = screen.getByRole('button', { name: /submit your response/i });
    
    const testResponse = 'This is a valid response with enough characters';
    fireEvent.change(textarea, { target: { value: testResponse } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(testResponse);
    });
  });

  it('shows loading state during submission', async () => {
    const slowSubmit = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<ResponseInput onSubmit={slowSubmit} timeLeft={60} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    const submitButton = screen.getByRole('button', { name: /submit your response/i });
    
    fireEvent.change(textarea, { target: { value: 'Valid response for testing' } });
    fireEvent.click(submitButton);
    
    expect(screen.getByText('Submitting Response...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    
    await waitFor(() => {
      expect(slowSubmit).toHaveBeenCalled();
    });
  });

  it('shows success message when submitted prop is true', () => {
    render(<ResponseInput onSubmit={mockOnSubmit} submitted={true} />);
    
    expect(screen.getByText('Response submitted successfully!')).toBeInTheDocument();
    expect(screen.getByText('Response Submitted')).toBeInTheDocument();
  });

  it('disables input when time is up', () => {
    render(<ResponseInput onSubmit={mockOnSubmit} timeLeft={0} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    const submitButton = screen.getByRole('button', { name: /time expired/i });
    
    expect(textarea).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(screen.getByText("Time's Up!")).toBeInTheDocument();
  });

  it('shows warning when approaching character limit', () => {
    render(<ResponseInput onSubmit={mockOnSubmit} timeLeft={60} maxLength={100} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    
    // Enter text that's 85% of the limit (85 characters)
    const longText = 'a'.repeat(85);
    fireEvent.change(textarea, { target: { value: longText } });
    
    expect(screen.getByText('85/100 characters')).toBeInTheDocument();
    expect(screen.getByText('(15 remaining)')).toBeInTheDocument();
  });

  it('supports keyboard shortcuts', () => {
    render(<ResponseInput onSubmit={mockOnSubmit} timeLeft={60} />);
    
    const textarea = screen.getByPlaceholderText('Describe your creative solution...');
    
    fireEvent.change(textarea, { target: { value: 'Valid response for testing' } });
    
    // Test Ctrl+Enter shortcut
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    expect(mockOnSubmit).toHaveBeenCalledWith('Valid response for testing');
  });
});