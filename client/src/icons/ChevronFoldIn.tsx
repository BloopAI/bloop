import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.00001 7.875L6.08334 10.375L1.91668 10.375L4.00001 7.875Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.99999 4.125L1.91666 1.625L6.08332 1.625L3.99999 4.125Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 11.875L12.0833 14.375L7.91668 14.375L10 11.875Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.99999 8.125L7.91666 5.625L12.0833 5.625L9.99999 8.125Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
