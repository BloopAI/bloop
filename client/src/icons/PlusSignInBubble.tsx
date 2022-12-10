import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="0.75"
      y="0.75"
      width="14.5"
      height="14.5"
      rx="7.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M8 5.5L8 10.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5.5 8L10.5 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
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
      rx="7.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10 7.5L10 12.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M7.5 10L12.5 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
