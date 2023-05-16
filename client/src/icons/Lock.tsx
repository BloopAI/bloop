import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 14 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="0.75"
      y="6.25"
      width="12.5"
      height="9.5"
      rx="1.75"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M4 5.5V4.5C4 2.84315 5.34315 1.5 7 1.5V1.5C8.65685 1.5 10 2.84315 10 4.5V5.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3.75"
      y="7.25"
      width="12.5"
      height="9.5"
      rx="1.75"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M7 6.5V5.5C7 3.84315 8.34315 2.5 10 2.5V2.5C11.6569 2.5 13 3.84315 13 5.5V6.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
