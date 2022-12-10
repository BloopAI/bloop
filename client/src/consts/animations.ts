const EASE_IN_SLOW = [0.4, 0, 0, 1];

const FILTER_EXPAND_ANIMATION_DURATION = 0.3;

export const FILTER_PARENT_ANIMATION = {
  duration: FILTER_EXPAND_ANIMATION_DURATION,
  ease: 'linear',
};
export const FILTER_TEXT_ANIMATION = {
  delay: FILTER_EXPAND_ANIMATION_DURATION - 0.1,
};
export const FILTER_SECTION_ANIMATION = { duration: 0.3, ease: EASE_IN_SLOW };

export const MODAL_SIDEBAR_CHANGE_ANIMATION = {
  duration: 0.5,
  ease: 'anticipate',
};
export const MODAL_SIDEBAR_APPEAR_ANIMATION = {
  duration: 0.2,
  ease: 'easeOut',
};

export const ACCORDION_CHILDREN_ANIMATION = {
  duration: 0.3,
  ease: EASE_IN_SLOW,
};
