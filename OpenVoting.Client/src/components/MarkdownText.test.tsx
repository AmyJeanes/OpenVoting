import { render, screen } from '@testing-library/react';
import { MarkdownText } from './MarkdownText';

describe('MarkdownText', () => {
  it('renders emphasis, lists, links, and preserves line breaks', () => {
    render(<MarkdownText content={'**Bold**\n- one\n- two\n\n[Docs](https://example.com)'} />);

    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com');
  });

  it('does not treat raw html as executable markup', () => {
    render(<MarkdownText content={'<script>alert(1)</script>'} />);

    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});