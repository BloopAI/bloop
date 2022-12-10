import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="0.75"
      y="0.75"
      width="14.5"
      height="14.5"
      rx="2.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M4 8L6 10L4 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="2.75"
      y="2.75"
      width="14.5"
      height="14.5"
      rx="2.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M6 10L8 12L6 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
