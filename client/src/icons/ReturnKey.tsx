import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.5 11.5L5.21429 15M1.5 11.5L5.21429 8.00001M1.5 11.5L11.5 11.5C13.1569 11.5 14.5 10.1569 14.5 8.50001L14.5 4C14.5 2.34314 13.1569 0.999999 11.5 0.999999L6.5 0.999999"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.5 13.5L7.21429 17M3.5 13.5L7.21429 10M3.5 13.5L13.5 13.5C15.1569 13.5 16.5 12.1569 16.5 10.5L16.5 6C16.5 4.34314 15.1569 3 13.5 3L8.5 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
