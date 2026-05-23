import { render } from '@testing-library/react'
import { Box } from '../box'

describe('Box Component', () => {
  it('renders as a div by default', () => {
    const { container } = render(<Box>Test content</Box>)
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('DIV')
    expect(element.textContent).toBe('Test content')
  })

  it('accepts all standard div props', () => {
    const { container } = render(
      <Box id="test-box" data-testid="box" aria-label="Test box">
        Content
      </Box>
    )
    const element = container.firstChild as HTMLElement
    expect(element.id).toBe('test-box')
    expect(element.getAttribute('data-testid')).toBe('box')
    expect(element.getAttribute('aria-label')).toBe('Test box')
  })

  it('applies className correctly', () => {
    const { container } = render(<Box className="custom-class">Content</Box>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('custom-class')
  })

  it('supports polymorphic rendering with asChild prop', () => {
    const { container } = render(
      <Box asChild>
        <a href="/test">Link content</a>
      </Box>
    )
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('A')
    expect(element.getAttribute('href')).toBe('/test')
    expect(element.textContent).toBe('Link content')
  })

  it('merges multiple classNames correctly', () => {
    const { container } = render(
      <Box className="class1 class2 class3">Content</Box>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('class1')
    expect(element.className).toContain('class2')
    expect(element.className).toContain('class3')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(
      <Box ref={ref as React.RefObject<HTMLDivElement>}>Content</Box>
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
