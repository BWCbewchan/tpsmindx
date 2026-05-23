import { render } from '@testing-library/react'
import { Text } from '../text'

describe('Text Component', () => {
  it('renders as a span by default', () => {
    const { container } = render(<Text>Test content</Text>)
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('SPAN')
    expect(element.textContent).toBe('Test content')
  })

  it('accepts all standard span props', () => {
    const { container } = render(
      <Text id="test-text" data-testid="text" aria-label="Test text">
        Content
      </Text>
    )
    const element = container.firstChild as HTMLElement
    expect(element.id).toBe('test-text')
    expect(element.getAttribute('data-testid')).toBe('text')
    expect(element.getAttribute('aria-label')).toBe('Test text')
  })

  it('applies default variants correctly', () => {
    const { container } = render(<Text>Content</Text>)
    const element = container.firstChild as HTMLElement
    // Default: size=base, weight=normal, color=primary
    expect(element.className).toContain('text-base')
    expect(element.className).toContain('font-normal')
    expect(element.className).toContain('text-foreground')
  })

  describe('Size variants', () => {
    it('applies xs size correctly', () => {
      const { container } = render(<Text size="xs">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-xs')
    })

    it('applies sm size correctly', () => {
      const { container } = render(<Text size="sm">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-sm')
    })

    it('applies base size correctly', () => {
      const { container } = render(<Text size="base">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-base')
    })

    it('applies lg size correctly', () => {
      const { container } = render(<Text size="lg">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-lg')
    })

    it('applies xl size correctly', () => {
      const { container } = render(<Text size="xl">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-xl')
    })
  })

  describe('Weight variants', () => {
    it('applies light weight correctly', () => {
      const { container } = render(<Text weight="light">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('font-light')
    })

    it('applies normal weight correctly', () => {
      const { container } = render(<Text weight="normal">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('font-normal')
    })

    it('applies medium weight correctly', () => {
      const { container } = render(<Text weight="medium">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('font-medium')
    })

    it('applies semibold weight correctly', () => {
      const { container } = render(<Text weight="semibold">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('font-semibold')
    })

    it('applies bold weight correctly', () => {
      const { container } = render(<Text weight="bold">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('font-bold')
    })
  })

  describe('Color variants', () => {
    it('applies primary color correctly', () => {
      const { container } = render(<Text color="primary">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-foreground')
    })

    it('applies secondary color correctly', () => {
      const { container } = render(<Text color="secondary">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-muted-foreground')
    })

    it('applies muted color correctly', () => {
      const { container } = render(<Text color="muted">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-muted-foreground/60')
    })

    it('applies disabled color correctly', () => {
      const { container } = render(<Text color="disabled">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-muted-foreground/40')
    })

    it('applies error color correctly', () => {
      const { container } = render(<Text color="error">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-destructive')
    })

    it('applies success color correctly', () => {
      const { container } = render(<Text color="success">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-success')
    })

    it('applies warning color correctly', () => {
      const { container } = render(<Text color="warning">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-warning')
    })

    it('applies info color correctly', () => {
      const { container } = render(<Text color="info">Content</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-info')
    })
  })

  describe('Combined variants', () => {
    it('applies multiple variants correctly', () => {
      const { container } = render(
        <Text size="lg" weight="bold" color="error">
          Content
        </Text>
      )
      const element = container.firstChild as HTMLElement
      expect(element.className).toContain('text-lg')
      expect(element.className).toContain('font-bold')
      expect(element.className).toContain('text-destructive')
    })
  })

  it('applies custom className correctly', () => {
    const { container } = render(<Text className="custom-class">Content</Text>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('custom-class')
  })

  it('supports polymorphic rendering with asChild prop', () => {
    const { container } = render(
      <Text asChild>
        <a href="/test">Link content</a>
      </Text>
    )
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('A')
    expect(element.getAttribute('href')).toBe('/test')
    expect(element.textContent).toBe('Link content')
  })

  it('renders Vietnamese content correctly', () => {
    const { container } = render(
      <Text>Chào mừng đến với MindX</Text>
    )
    const element = container.firstChild as HTMLElement
    expect(element.textContent).toBe('Chào mừng đến với MindX')
  })

  it('renders Vietnamese content with diacritics correctly', () => {
    const vietnameseTexts = [
      'Địa chỉ email',
      'Mật khẩu',
      'Họ và tên',
      'Số điện thoại',
      'Cập nhật hồ sơ thành công',
      'Email là bắt buộc',
    ]

    vietnameseTexts.forEach((text) => {
      const { container } = render(<Text>{text}</Text>)
      const element = container.firstChild as HTMLElement
      expect(element.textContent).toBe(text)
    })
  })

  it('merges multiple classNames correctly', () => {
    const { container } = render(
      <Text className="class1 class2 class3">Content</Text>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('class1')
    expect(element.className).toContain('class2')
    expect(element.className).toContain('class3')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(
      <Text ref={ref as React.RefObject<HTMLSpanElement>}>Content</Text>
    )
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
  })

  describe('Typography scale (1.250 ratio)', () => {
    it('follows the 1.250 scale for all size variants', () => {
      // This test verifies that the component uses the correct Tailwind classes
      // The actual font sizes are defined in tailwind.config.js following the 1.250 ratio
      const sizes = ['xs', 'sm', 'base', 'lg', 'xl'] as const
      
      sizes.forEach((size) => {
        const { container } = render(<Text size={size}>Content</Text>)
        const element = container.firstChild as HTMLElement
        expect(element.className).toContain(`text-${size}`)
      })
    })
  })
})
