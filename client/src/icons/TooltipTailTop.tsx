import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="12"
    height="5"
    viewBox="0 0 12 4"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0 4.82843H11.3137L7.07107 0.58579C6.29002 -0.195259 5.02369 -0.195259 4.24264 0.58579L0 4.82843Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="12"
    height="5"
    viewBox="0 0 12 4"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0 4.82843H11.3137L7.07107 0.58579C6.29002 -0.195259 5.02369 -0.195259 4.24264 0.58579L0 4.82843Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
