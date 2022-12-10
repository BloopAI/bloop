import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 12 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6 1L6 12M6 12L9 9M6 12L3 9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="11.25"
      y1="15.75"
      x2="0.75"
      y2="15.75"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 3L10 14M10 14L13 11M10 14L7 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="15.25"
      y1="17.75"
      x2="4.75"
      y2="17.75"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
