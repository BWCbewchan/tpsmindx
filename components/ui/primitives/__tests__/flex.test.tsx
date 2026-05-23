import { render } from '@testing-library/react'
import { Flex } from '../flex'

describe('Flex Component', () => {
  it('renders as a div with flex by default', () => {
    const { container } = render(<Flex>Test content</Flex>)
    const element = container.firstChild as HTMLElement
    expect(element.tagName).toBe('DIV')
    expect(element.textContent).toBe('Test content')
    expect(element.className).toContain('flex')
  })

  it('applies default gap variant (md)', () => {
    const { container } = render(<Flex>Content</Flex>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('gap-4')
  })

  it('applies default align variant (center)', () => {
    const { container } = render(<Flex>Content</Flex>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('items-center')
  })

  it('applies default justify variant (start)', () => {
    const { container } = render(<Flex>Content</Flex>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('justify-start')
  })

  it('applies default wrap variant (nowrap)', () => {
    const { container } = render(<Flex>Content</Flex>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('flex-nowrap')
  })

  it('applies gap variant correctly', () => {
    const { container: container1 } = render(<Flex gap="none">Content</Flex>)
    expect((container1.firstChild as HTMLElement).className).toContain('gap-0')

    const { container: container2 } = render(<Flex gap="xs">Content</Flex>)
    expect((container2.firstChild as HTMLElement).className).toContain('gap-1')

    const { container: container3 } = render(<Flex gap="sm">Content</Flex>)
    expect((container3.firstChild as HTMLElement).className).toContain('gap-2')

    const { container: container4 } = render(<Flex gap="md">Content</Flex>)
    expect((container4.firstChild as HTMLElement).className).toContain('gap-4')

    const { container: container5 } = render(<Flex gap="lg">Content</Flex>)
    expect((container5.firstChild as HTMLElement).className).toContain('gap-6')

    const { container: container6 } = render(<Flex gap="xl">Content</Flex>)
    expect((container6.firstChild as HTMLElement).className).toContain('gap-8')
  })

  it('applies align variant correctly', () => {
    const { container: container1 } = render(<Flex align="start">Content</Flex>)
    expect((container1.firstChild as HTMLElement).className).toContain('items-start')

    const { container: container2 } = render(<Flex align="center">Content</Flex>)
    expect((container2.firstChild as HTMLElement).className).toContain('items-center')

    const { container: container3 } = render(<Flex align="end">Content</Flex>)
    expect((container3.firstChild as HTMLElement).className).toContain('items-end')

    const { container: container4 } = render(<Flex align="stretch">Content</Flex>)
    expect((container4.firstChild as HTMLElement).className).toContain('items-stretch')

    const { container: container5 } = render(<Flex align="baseline">Content</Flex>)
    expect((container5.firstChild as HTMLElement).className).toContain('items-baseline')
  })

  it('applies justify variant correctly', () => {
    const { container: container1 } = render(<Flex justify="start">Content</Flex>)
    expect((container1.firstChild as HTMLElement).className).toContain('justify-start')

    const { container: container2 } = render(<Flex justify="center">Content</Flex>)
    expect((container2.firstChild as HTMLElement).className).toContain('justify-center')

    const { container: container3 } = render(<Flex justify="end">Content</Flex>)
    expect((container3.firstChild as HTMLElement).className).toContain('justify-end')

    const { container: container4 } = render(<Flex justify="between">Content</Flex>)
    expect((container4.firstChild as HTMLElement).className).toContain('justify-between')

    const { container: container5 } = render(<Flex justify="around">Content</Flex>)
    expect((container5.firstChild as HTMLElement).className).toContain('justify-around')

    const { container: container6 } = render(<Flex justify="evenly">Content</Flex>)
    expect((container6.firstChild as HTMLElement).className).toContain('justify-evenly')
  })

  it('applies wrap variant correctly', () => {
    const { container: container1 } = render(<Flex wrap="nowrap">Content</Flex>)
    expect((container1.firstChild as HTMLElement).className).toContain('flex-nowrap')

    const { container: container2 } = render(<Flex wrap="wrap">Content</Flex>)
    expect((container2.firstChild as HTMLElement).className).toContain('flex-wrap')

    const { container: container3 } = render(<Flex wrap="wrap-reverse">Content</Flex>)
    expect((container3.firstChild as HTMLElement).className).toContain('flex-wrap-reverse')
  })

  it('accepts all standard div props', () => {
    const { container } = render(
      <Flex id="test-flex" data-testid="flex" aria-label="Test flex">
        Content
      </Flex>
    )
    const element = container.firstChild as HTMLElement
    expect(element.id).toBe('test-flex')
    expect(element.getAttribute('data-testid')).toBe('flex')
    expect(element.getAttribute('aria-label')).toBe('Test flex')
  })

  it('applies custom className correctly', () => {
    const { container } = render(<Flex className="custom-class">Content</Flex>)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('custom-class')
    expect(element.className).toContain('flex')
  })

  it('combines all variants correctly', () => {
    const { container } = render(
      <Flex gap="lg" align="center" justify="between" wrap="wrap">
        Content
      </Flex>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('gap-6')
    expect(element.className).toContain('items-center')
    expect(element.className).toContain('justify-between')
    expect(element.className).toContain('flex-wrap')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(
      <Flex ref={ref as React.RefObject<HTMLDivElement>}>Content</Flex>
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('renders multiple children with horizontal layout', () => {
    const { container } = render(
      <Flex>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </Flex>
    )
    const element = container.firstChild as HTMLElement
    expect(element.children.length).toBe(3)
    expect(element.className).toContain('flex')
    expect(element.className).not.toContain('flex-col')
  })

  it('creates button group layout correctly', () => {
    const { container } = render(
      <Flex gap="sm" justify="end">
        <button>Hủy</button>
        <button>Lưu</button>
      </Flex>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('gap-2')
    expect(element.className).toContain('justify-end')
    expect(element.children.length).toBe(2)
  })

  it('creates navigation layout correctly', () => {
    const { container } = render(
      <Flex justify="between" align="center">
        <div>Logo</div>
        <div>Menu</div>
      </Flex>
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('justify-between')
    expect(element.className).toContain('items-center')
  })
})
