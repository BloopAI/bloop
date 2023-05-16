import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="2.40002"
      y="5.19995"
      width="11.2"
      height="8.8"
      rx="2"
      fill="currentColor"
    />
    <path
      d="M5.59998 5.2V4.4C5.59998 3.07452 6.67449 2 7.99998 2V2C9.32546 2 10.4 3.07452 10.4 4.4V5.2"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2.40002"
      y="5.19995"
      width="11.2"
      height="8.8"
      rx="2"
      fill="currentColor"
    />
    <path
      d="M5.59998 5.2V4.4C5.59998 3.07452 6.67449 2 7.99998 2V2C9.32546 2 10.4 3.07452 10.4 4.4V5.2"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
