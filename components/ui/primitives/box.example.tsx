/**
 * Box Component Usage Examples
 * 
 * The Box component is the most primitive layout component in the design system.
 * All other components should compose from Box.
 */

import { Box } from './box'

// Example 1: Basic usage as a div
export function BasicBoxExample() {
  return (
    <Box className="p-4 bg-gray-100 rounded-md">
      This is a basic Box component rendered as a div
    </Box>
  )
}

// Example 2: Polymorphic rendering with asChild
export function PolymorphicBoxExample() {
  return (
    <Box asChild>
      <a href="/link" className="text-blue-600 hover:underline">
        This Box renders as a link element
      </a>
    </Box>
  )
}

// Example 3: Using Box as a container
export function ContainerBoxExample() {
  return (
    <Box className="max-w-4xl mx-auto p-6">
      <Box className="bg-white shadow-md rounded-lg p-4">
        <h2 className="text-xl font-bold mb-2">Card Title</h2>
        <p className="text-gray-600">Card content goes here</p>
      </Box>
    </Box>
  )
}

// Example 4: Box with all standard div props
export function BoxWithPropsExample() {
  return (
    <Box
      id="custom-box"
      className="p-4"
      role="region"
      aria-label="Custom region"
      data-testid="example-box"
      onClick={() => console.log('Box clicked')}
    >
      Box with various HTML attributes
    </Box>
  )
}

// Example 5: Composing complex components from Box
export function ComposedCardExample() {
  return (
    <Box className="border border-gray-200 rounded-lg overflow-hidden">
      <Box className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Card Header</h3>
      </Box>
      <Box className="px-6 py-4">
        <p>Card content built by composing Box components</p>
      </Box>
      <Box className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
        <button className="px-4 py-2 text-gray-600">Hủy</button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded">Lưu</button>
      </Box>
    </Box>
  )
}
