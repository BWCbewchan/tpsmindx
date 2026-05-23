'use client'

import { useEffect, useRef, useState } from 'react'
import Slider from './slider'
import SliderSidebar from './slider-sidebar'

interface Post {
    id: string | number
    slug: string
    title: string
    description: string
    content: string
    featured_image: string
    banner_image: string
    thumbnail_position?: string
    post_type: string
    published_at: string
    view_count: number
    created_at: string
}

interface HeroSectionProps {
    posts: Post[]
}

export default function HeroSection({ posts }: HeroSectionProps) {
    const sliderRef = useRef<HTMLDivElement>(null)
    const sidebarRef = useRef<HTMLDivElement>(null)
    const [sliderHeight, setSliderHeight] = useState<number | null>(null)

    useEffect(() => {
        const updateHeight = () => {
            if (sliderRef.current) {
                const height = sliderRef.current.offsetHeight
                setSliderHeight(height)
            }
        }

        // Update on mount and resize
        updateHeight()
        window.addEventListener('resize', updateHeight)

        // Use ResizeObserver for more accurate tracking
        const resizeObserver = new ResizeObserver(updateHeight)
        if (sliderRef.current) {
            resizeObserver.observe(sliderRef.current)
        }

        return () => {
            window.removeEventListener('resize', updateHeight)
            resizeObserver.disconnect()
        }
    }, [posts])

    return (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Slider - Left Side */}
                <div ref={sliderRef} className="flex-1 min-w-0">
                    <Slider posts={posts} />
                </div>
                
                {/* Sidebar - Right Side */}
                <div 
                    ref={sidebarRef}
                    className="w-full lg:w-96 shrink-0"
                    style={{
                        height: sliderHeight && window.innerWidth >= 1024 ? `${sliderHeight}px` : 'auto'
                    }}
                >
                    <SliderSidebar />
                </div>
            </div>
        </section>
    )
}
