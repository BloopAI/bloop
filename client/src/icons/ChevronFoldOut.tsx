import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.00001 10.375L6.08334 7.875L1.91668 7.875L4.00001 10.375Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.99999 1.625L1.91666 4.125L6.08332 4.125L3.99999 1.625Z"
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
      d="M10 14.375L12.0833 11.875L7.91668 11.875L10 14.375Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.99999 5.625L7.91666 8.125L12.0833 8.125L9.99999 5.625Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
