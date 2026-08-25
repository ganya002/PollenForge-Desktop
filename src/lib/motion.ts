export const easeOut = [0.22, 1, 0.36, 1] as const
export const easeSnappy = [0.32, 0.72, 0, 1] as const
export const easeSmooth = [0.25, 0.1, 0.25, 1] as const

// Snappy spring - 140ms perceived, feels instant but fluid
export const snappySpring = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
}

// Smooth spring - for larger layout shifts
export const smoothSpring = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
}

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: 0.16, ease: easeSnappy },
}

export const fadeUpSnappy = {
  initial: { opacity: 0, y: 6, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.985 },
  transition: snappySpring,
}

export const fadeScale = {
  initial: { opacity: 0, scale: 0.98, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
  transition: { duration: 0.14, ease: easeSnappy },
}

export const slidePanel = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 12 },
  transition: { duration: 0.18, ease: easeSnappy },
}

export const slidePanelSpring = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 12 },
  transition: smoothSpring,
}

// Staggered list - useful for tool timeline & suggestions
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.03, delayChildren: 0.04 },
  },
  exit: {
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: snappySpring,
  },
  exit: { opacity: 0, y: 4, transition: { duration: 0.12, ease: easeSnappy } },
}

// Insightful: progress-aware - scale + opacity tied to streaming state
export const streamingPulse = {
  initial: { opacity: 0.7, scale: 1 },
  animate: {
    opacity: [0.7, 1, 0.7],
    scale: [1, 1.015, 1],
    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

// Layout - for auto layout animations (sidebar drag, composer)
export const layoutSpring = {
  layout: true,
  transition: smoothSpring,
}
