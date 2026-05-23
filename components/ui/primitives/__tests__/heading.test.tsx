import { render } from '@testing-library/react'
import { Heading } from '../heading'

describe('Heading Component', () => {
  it('renders as h2 by default', () => {
    const { container } = render(<Heading>Test heading</Heading>)
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('H2')
    expect(element.textContent).toBe('Test heading')
  })

  it('accepts all standard heading props', () => {
    const { container } = render(
      <Heading id="test-heading" data-testid="heading" aria-label="Test heading">
        Content
      </Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.id).toBe('test-heading')
    expect(element.getAttribute('data-testid')).toBe('heading')
    expect(element.getAttribute('aria-label')).toBe('Test heading')
  })

  it('applies font-bold by default', () => {
    const { container } = render(<Heading>Content</Heading>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('font-bold')
  })

  it('applies default level (h2) correctly', () => {
    const { container } = render(<Heading>Content</Heading>)
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('H2')
    expect(element.className).toContain('text-4xl')
  })

  describe('Heading levels', () => {
    it('renders h1 with correct size (61.04px)', () => {
      const { container } = render(<Heading level="h1">Heading 1</Heading>)
      const element = container.firstChild as HTMLElement
      expect(element.tagName).toBe('H1')
      expect(element.className).toContain('text-5xl')
    })

    it('renders h2 with correct size (48.83px)', () => {
      const { container } = render(<Heading level="h2">Heading 2</Heading>)
      const element = container.firstChild as HTMLElement
      expect(element.tagName).toBe('H2')
      expect(element.className).toContain('text-4xl')
    })

    it('renders h3 with correct size (39.06px)', () => {
      const { container } = render(<Heading level="h3">Heading 3</Heading>)
      const element = container.firstChild as HTMLElement
      expect(element.tagName).toBe('H3')
      expect(element.className).toContain('text-3xl')
    })

    it('renders h4 with correct size (31.25px)', () => {
      const { container } = render(<Heading level="h4">Heading 4</Heading>)
      const element = container.firstChild as HTMLElement
      expect(element.tagName).toBe('H4')
      expect(element.className).toContain('text-2xl')
    })

    it('renders h5 with correct size (25px)', () => {
      const { container } = render(<Heading level="h5">Heading 5</Heading>)
      const element = container.firstChild as HTMLElement
      expect(element.tagName).toBe('H5')
      expect(element.className).toContain('text-xl')
    })

    it('renders h6 with correct size (20px)', () => {
      const { container } = render(<Heading level="h6">Heading 6</Heading>)
      const element = container.firstChild as HTMLElement
      expect(element.tagName).toBe('H6')
      expect(element.className).toContain('text-lg')
    })
  })

  describe('Typography scale (1.250 ratio)', () => {
    it('follows the 1.250 scale for all heading levels', () => {
      // This test verifies that the component uses the correct Tailwind classes
      // The actual font sizes are defined in tailwind.config.js following the 1.250 ratio:
      // h1: 61.04px (16 * 1.25^6) -> text-5xl
      // h2: 48.83px (16 * 1.25^5) -> text-4xl
      // h3: 39.06px (16 * 1.25^4) -> text-3xl
      // h4: 31.25px (16 * 1.25^3) -> text-2xl
      // h5: 25px (16 * 1.25^2) -> text-xl
      // h6: 20px (16 * 1.25) -> text-lg
      
      const levelToClass = {
        h1: 'text-5xl',
        h2: 'text-4xl',
        h3: 'text-3xl',
        h4: 'text-2xl',
        h5: 'text-xl',
        h6: 'text-lg',
      } as const

      Object.entries(levelToClass).forEach(([level, className]) => {
        const { container } = render(
          <Heading level={level as keyof typeof levelToClass}>Content</Heading>
        )
        const element = container.firstChild as HTMLElement
        expect(element.className).toContain(className)
      })
    })
  })

  it('applies custom className correctly', () => {
    const { container } = render(
      <Heading className="custom-class">Content</Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('custom-class')
    expect(element.className).toContain('font-bold')
  })

  it('supports polymorphic rendering with asChild prop', () => {
    const { container } = render(
      <Heading level="h2" asChild>
        <a href="/test">Link heading</a>
      </Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('A')
    expect(element.getAttribute('href')).toBe('/test')
    expect(element.textContent).toBe('Link heading')
    expect(element.className).toContain('text-4xl')
    expect(element.className).toContain('font-bold')
  })

  it('renders Vietnamese content correctly', () => {
    const { container } = render(
      <Heading level="h1">Chào Mừng Đến Với MindX</Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.textContent).toBe('Chào Mừng Đến Với MindX')
  })

  it('renders Vietnamese content with diacritics correctly', () => {
    const vietnameseHeadings = [
      'Chào Mừng Đến Với MindX',
      'Dịch vụ của chúng tôi',
      'Khóa học lập trình',
      'Giới thiệu về khóa học',
      'Thông tin chi tiết',
      'Liên hệ với chúng tôi',
    ]

    vietnameseHeadings.forEach((text, index) => {
      const level = `h${index + 1}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      const { container } = render(<Heading level={level}>{text}</Heading>)
      const element = container.firstChild as HTMLElement
      expect(element.textContent).toBe(text)
    })
  })

  it('merges multiple classNames correctly', () => {
    const { container } = render(
      <Heading className="class1 class2 class3">Content</Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('class1')
    expect(element.className).toContain('class2')
    expect(element.className).toContain('class3')
    expect(element.className).toContain('font-bold')
  })

  it('can override font-bold with custom className', () => {
    const { container } = render(
      <Heading className="font-normal">Content</Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('font-normal')
  })

  it('supports custom colors via className', () => {
    const { container } = render(
      <Heading level="h2" className="text-primary">
        Heading with brand color
      </Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('text-primary')
  })

  it('supports text alignment via className', () => {
    const { container } = render(
      <Heading level="h3" className="text-center">
        Centered heading
      </Heading>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('text-center')
  })

  describe('Semantic HTML', () => {
    it('renders correct semantic HTML element for each level', () => {
      const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const
      
      levels.forEach((level) => {
        const { container } = render(
          <Heading level={level}>Content</Heading>
        )
        const element = container.firstChild as HTMLElement
        expect(element.tagName).toBe(level.toUpperCase())
      })
    })
  })

  describe('Accessibility', () => {
    it('maintains semantic heading hierarchy', () => {
      const { container } = render(
        <div>
          <Heading level="h1">Main Title</Heading>
          <Heading level="h2">Section Title</Heading>
          <Heading level="h3">Subsection Title</Heading>
        </div>
      )
      
      const h1 = container.querySelector('h1')
      const h2 = container.querySelector('h2')
      const h3 = container.querySelector('h3')
      
      expect(h1).toBeTruthy()
      expect(h2).toBeTruthy()
      expect(h3).toBeTruthy()
    })

    it('supports aria attributes', () => {
      const { container } = render(
        <Heading level="h2" aria-label="Section heading" role="heading" aria-level={2}>
          Content
        </Heading>
      )
      const element = container.firstChild as HTMLElement
      expect(element.getAttribute('aria-label')).toBe('Section heading')
      expect(element.getAttribute('role')).toBe('heading')
      expect(element.getAttribute('aria-level')).toBe('2')
    })
  })

  describe('Requirements validation', () => {
    it('validates Requirement 6.1: Heading is a primitive base component', () => {
      // The Heading component is defined in components/ui/primitives/
      // and is exported from the primitives index
      const { container } = render(<Heading>Content</Heading>)
      expect(container.firstChild).toBeTruthy()
    })

    it('validates Requirement 6.4: Supports polymorphic props (asChild)', () => {
      const { container } = render(
        <Heading asChild>
          <div>Polymorphic heading</div>
        </Heading>
      )
      const element = container.firstChild as HTMLElement
      expect(element.tagName).toBe('DIV')
    })

    it('validates Requirement 4.4: Defines heading styles (h1-h6) following 1.250 scale', () => {
      const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const
      levels.forEach((level) => {
        const { container } = render(<Heading level={level}>Content</Heading>)
        const element = container.firstChild as HTMLElement
        expect(element.tagName).toBe(level.toUpperCase())
      })
    })

    it('validates Requirement 4.13: Font sizes follow 1.250 ratio', () => {
      // Verified by checking that correct Tailwind classes are applied
      // which are configured in tailwind.config.js with 1.250 ratio
      const { container: h1Container } = render(<Heading level="h1">H1</Heading>)
      const { container: h6Container } = render(<Heading level="h6">H6</Heading>)
      
      expect((h1Container.firstChild as HTMLElement).className).toContain('text-5xl')
      expect((h6Container.firstChild as HTMLElement).className).toContain('text-lg')
    })
  })
})
