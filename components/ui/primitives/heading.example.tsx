import { Heading } from './heading'

/**
 * Heading Component Examples
 * 
 * Demonstrates the usage of the Heading primitive component
 * following the 1.250 typography scale.
 */

export function HeadingExamples() {
  return (
    <div className="space-y-8 p-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">Heading Levels</h2>
        <div className="space-y-4">
          <Heading level="h1">Heading 1 - 61.04px</Heading>
          <Heading level="h2">Heading 2 - 48.83px</Heading>
          <Heading level="h3">Heading 3 - 39.06px</Heading>
          <Heading level="h4">Heading 4 - 31.25px</Heading>
          <Heading level="h5">Heading 5 - 25px</Heading>
          <Heading level="h6">Heading 6 - 20px</Heading>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Vietnamese Content</h2>
        <div className="space-y-4">
          <Heading level="h1">Chào Mừng Đến Với MindX</Heading>
          <Heading level="h2">Dịch vụ của chúng tôi</Heading>
          <Heading level="h3">Khóa học lập trình</Heading>
          <Heading level="h4">Giới thiệu về khóa học</Heading>
          <Heading level="h5">Thông tin chi tiết</Heading>
          <Heading level="h6">Liên hệ với chúng tôi</Heading>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Polymorphic Rendering (asChild)</h2>
        <div className="space-y-4">
          <Heading level="h2" asChild>
            <a href="#" className="text-primary hover:underline">
              Clickable heading as link
            </a>
          </Heading>
          
          <Heading level="h3" asChild>
            <div className="text-success">
              Heading as div with custom color
            </div>
          </Heading>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Custom Styling</h2>
        <div className="space-y-4">
          <Heading level="h2" className="text-primary">
            Heading with brand color
          </Heading>
          
          <Heading level="h3" className="text-muted-foreground">
            Muted heading
          </Heading>
          
          <Heading level="h4" className="text-center">
            Centered heading
          </Heading>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Semantic HTML</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The component renders the correct semantic HTML element based on the level prop.
        </p>
        <div className="space-y-4">
          <Heading level="h1">This renders as &lt;h1&gt;</Heading>
          <Heading level="h2">This renders as &lt;h2&gt;</Heading>
          <Heading level="h3">This renders as &lt;h3&gt;</Heading>
        </div>
      </section>
    </div>
  )
}
