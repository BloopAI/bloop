import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 12 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6 16L6 5M6 5L9 8M6 5L3 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="0.75"
      y1="-0.75"
      x2="11.25"
      y2="-0.75"
      transform="matrix(-1 0 0 1 12 2)"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 17L10 6M10 6L13 9M10 6L7 9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="0.75"
      y1="-0.75"
      x2="11.25"
      y2="-0.75"
      transform="matrix(-1 0 0 1 16 3)"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
