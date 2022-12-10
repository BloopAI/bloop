import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="12"
    height="5"
    viewBox="0 0 12 5"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0 0H11.3137L7.07107 4.24264C6.29002 5.02369 5.02369 5.02369 4.24264 4.24264L0 0Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="12"
    height="5"
    viewBox="0 0 12 5"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0 0H11.3137L7.07107 4.24264C6.29002 5.02369 5.02369 5.02369 4.24264 4.24264L0 0Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
