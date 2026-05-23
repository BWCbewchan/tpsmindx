import { render } from '@testing-library/react'
import { Stack } from '../stack'

describe('Stack Component', () => {
  it('renders as a div with flex-col by default', () => {
    const { container } = render(<Stack>Test content</Stack>)
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('DIV')
    expect(element.textContent).toBe('Test content')
    expect(element.className).toContain('flex')
    expect(element.className).toContain('flex-col')
  })

  it('applies default gap variant (md)', () => {
    const { container } = render(<Stack>Content</Stack>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('gap-4')
  })

  it('applies default align variant (stretch)', () => {
    const { container } = render(<Stack>Content</Stack>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('items-stretch')
  })

  it('applies gap variant correctly', () => {
    const { container: container1 } = render(<Stack gap="none">Content</Stack>)
    expect((container1.firstChild as HTMLElement).className).toContain('gap-0')

    const { container: container2 } = render(<Stack gap="xs">Content</Stack>)
    expect((container2.firstChild as HTMLElement).className).toContain('gap-1')

    const { container: container3 } = render(<Stack gap="sm">Content</Stack>)
    expect((container3.firstChild as HTMLElement).className).toContain('gap-2')

    const { container: container4 } = render(<Stack gap="md">Content</Stack>)
    expect((container4.firstChild as HTMLElement).className).toContain('gap-4')

    const { container: container5 } = render(<Stack gap="lg">Content</Stack>)
    expect((container5.firstChild as HTMLElement).className).toContain('gap-6')

    const { container: container6 } = render(<Stack gap="xl">Content</Stack>)
    expect((container6.firstChild as HTMLElement).className).toContain('gap-8')
  })

  it('applies align variant correctly', () => {
    const { container: container1 } = render(<Stack align="start">Content</Stack>)
    expect((container1.firstChild as HTMLElement).className).toContain('items-start')

    const { container: container2 } = render(<Stack align="center">Content</Stack>)
    expect((container2.firstChild as HTMLElement).className).toContain('items-center')

    const { container: container3 } = render(<Stack align="end">Content</Stack>)
    expect((container3.firstChild as HTMLElement).className).toContain('items-end')

    const { container: container4 } = render(<Stack align="stretch">Content</Stack>)
    expect((container4.firstChild as HTMLElement).className).toContain('items-stretch')
  })

  it('accepts all standard div props', () => {
    const { container } = render(
      <Stack id="test-stack" data-testid="stack" aria-label="Test stack">
        Content
      </Stack>
    )
    const element = container.firstChild as HTMLElement
    expect(element.id).toBe('test-stack')
    expect(element.getAttribute('data-testid')).toBe('stack')
    expect(element.getAttribute('aria-label')).toBe('Test stack')
  })

  it('applies custom className correctly', () => {
    const { container } = render(<Stack className="custom-class">Content</Stack>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('custom-class')
    expect(element.className).toContain('flex')
    expect(element.className).toContain('flex-col')
  })

  it('combines gap and align variants correctly', () => {
    const { container } = render(
      <Stack gap="lg" align="center">
        Content
      </Stack>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('gap-6')
    expect(element.className).toContain('items-center')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(
      <Stack ref={ref as React.RefObject<HTMLDivElement>}>Content</Stack>
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('renders multiple children with vertical layout', () => {
    const { container } = render(
      <Stack>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </Stack>
    )
    const element = container.firstChild as HTMLElement
    expect(element.children.length).toBe(3)
    expect(element.className).toContain('flex-col')
  })
})
