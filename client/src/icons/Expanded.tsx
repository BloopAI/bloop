import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="18"
      y="7.5"
      width="6"
      height="16"
      rx="2"
      transform="rotate(90 18 7.5)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 4L15 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M4.79999 16.7H15.2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
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
      x="18"
      y="7.5"
      width="6"
      height="16"
      rx="2"
      transform="rotate(90 18 7.5)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 4L15 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M4.79999 16.7H15.2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
