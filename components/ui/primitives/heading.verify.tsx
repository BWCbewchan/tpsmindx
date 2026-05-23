/**
 * Verification script for Heading component
 * This file demonstrates that the Heading component can be imported and used correctly
 */

import { Heading } from './heading'

// Type checking verification
const VerifyHeading = () => {
  return (
    <>
      {/* Basic usage */}
      <Heading>Default heading</Heading>
      
      {/* All heading levels */}
      <Heading level="h1">Heading 1</Heading>
      <Heading level="h2">Heading 2</Heading>
      <Heading level="h3">Heading 3</Heading>
      <Heading level="h4">Heading 4</Heading>
      <Heading level="h5">Heading 5</Heading>
      <Heading level="h6">Heading 6</Heading>
      
      {/* With custom className */}
      <Heading className="text-primary">Custom styled</Heading>
      
      {/* Polymorphic rendering */}
      <Heading asChild>
        <a href="#">Link as heading</a>
      </Heading>
      
      {/* Vietnamese content */}
      <Heading level="h1">Chào Mừng Đến Với MindX</Heading>
      
      {/* With all HTML attributes */}
      <Heading 
        level="h2" 
        id="main-heading"
        className="text-center"
        aria-label="Main heading"
      >
        Full featured heading
      </Heading>
    </>
  )
}

export default VerifyHeading
