/**
 * LearnFlow Minimalist Animation System (Framer Motion)
 * Curated, high-performance animation presets designed for a sleek enterprise feel.
 */

export const transitions = {
  spring: {
    type: "spring",
    stiffness: 380,
    damping: 30,
  },
  smooth: {
    duration: 0.28,
    ease: [0.16, 1, 0.3, 1], // Apple-like easeOutExpo curve
  },
  subtle: {
    duration: 0.2,
    ease: "easeInOut",
  },
  stagger: (staggerTime = 0.05, delayChildren = 0.02) => ({
    staggerChildren: staggerTime,
    delayChildren,
  }),
};

export const pageVariants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.18,
      ease: "easeInOut",
    },
  },
};

export const containerStaggerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

export const itemFadeUpVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export const itemFadeVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

export const cardHoverVariants = {
  rest: { y: 0, transition: transitions.smooth },
  hover: { y: -2, transition: transitions.smooth },
};

export const dropdownVariants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: -6,
    transition: { duration: 0.12, ease: "easeInOut" },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -6,
    transition: { duration: 0.12, ease: "easeInOut" },
  },
};

export const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export const buttonTapVariants = {
  tap: { scale: 0.985 },
};
