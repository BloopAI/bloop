import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 17 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16 6H5M5 6L8 3M5 6L8 9"
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
      transform="matrix(4.37114e-08 1 1 -4.37114e-08 2 0)"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17 10H6M6 10L9 7M6 10L9 13"
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
      transform="matrix(4.37114e-08 1 1 -4.37114e-08 3 4)"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
