import React, { useState, useEffect } from 'react';
import { preloadMascotFrames } from './mascotCache';

export type MascotAnimation = 'standAndRead' | 'walk' | 'jump' | 'wave' | 'verify' | 'turn' | 'review' | 'walkToSit';

interface MascotProps {
  animation?: MascotAnimation;
  className?: string;
  style?: React.CSSProperties;
  frameRate?: number; // ms per frame
}

const ANIMATION_FRAMES: Record<MascotAnimation, string[]> = {
  standAndRead: [
    '/mascot/standAndRead/1.png',
    '/mascot/standAndRead/tải xuống.png',
    ...Array.from({ length: 23 }, (_, i) => `/mascot/standAndRead/tải xuống (${i + 1}).png`),
  ],
  walk: Array.from({ length: 25 }, (_, i) => `/mascot/walk/frame-${i + 1}.png`),
  jump: Array.from({ length: 25 }, (_, i) => `/mascot/jump/frame-${i + 1}.png`),
  wave: [], // To be populated if needed
  verify: [], // To be populated if needed
  turn: [], // To be populated if needed
  review: [], // To be populated if needed
  walkToSit: Array.from({ length: 25 }, (_, i) => `/mascot/walkToSit/frame-${i + 1}.png`),
};

export const Mascot: React.FC<MascotProps> = ({
  animation = 'standAndRead',
  className = '',
  style,
  frameRate = 100
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const frames = ANIMATION_FRAMES[animation];

  useEffect(() => {
    // Reset state khi đổi animation
    setCurrentFrame(0);
    setLoopCount(0);
    setIsLooping(false);

    if (frames && frames.length > 0) {
      preloadMascotFrames(frames);
    }
  }, [animation, frames]);

  useEffect(() => {
    const isSprite = animation === 'walkToSit';
    const frameCount = isSprite ? 25 : frames?.length || 0;

    if (frameCount <= 1) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        // Logic đặc biệt cho animation 'standAndRead'
        if (animation === 'standAndRead') {
          const FRAME_END = 22; // Frame 23 (index 22)
          const FRAME_LOOP_START = 9; // Frame 10 (index 9)
          const MAX_LOOPS = 3;

          if (!isLooping) {
            if (prev >= FRAME_END) {
              setIsLooping(true);
              setLoopCount(1);
              return FRAME_LOOP_START;
            }
            return prev + 1;
          } else {
            if (prev >= FRAME_END) {
              if (loopCount < MAX_LOOPS) {
                setLoopCount((c) => c + 1);
                return FRAME_LOOP_START;
              } else {
                setIsLooping(false);
                setLoopCount(0);
                return 0;
              }
            }
            return prev + 1;
          }
        }

        // Logic mặc định cho các animation khác
        if (animation === 'walkToSit' && prev >= frameCount - 1) {
          return frameCount - 1;
        }
        return (prev + 1) % frameCount;
      });
    }, frameRate);

    return () => clearInterval(interval);
  }, [frames, frameRate, animation, isLooping, loopCount]);


  if (!frames || frames.length === 0) {
    return null;
  }

  return (
    <img
      src={frames[currentFrame]}
      alt={`Mascot ${animation}`}
      className={className}
      style={style}
    />
  );
};
