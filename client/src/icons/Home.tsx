import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.5 6.99889L7.46933 1.02889C7.76267 0.736221 8.23733 0.736221 8.53 1.02889L14.5 6.99889M3 5.49889V12.2489C3 12.6629 3.336 12.9989 3.75 12.9989H6.5V9.74889C6.5 9.33489 6.836 8.99889 7.25 8.99889H8.75C9.164 8.99889 9.5 9.33489 9.5 9.74889V12.9989H12.25C12.664 12.9989 13 12.6629 13 12.2489V5.49889M5.5 12.9989H11"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
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
    <path
      d="M1.5 7.99889L7.46933 2.02889C7.76267 1.73622 8.23733 1.73622 8.53 2.02889L14.5 7.99889M3 6.49889V13.2489C3 13.6629 3.336 13.9989 3.75 13.9989H6.5V10.7489C6.5 10.3349 6.836 9.99889 7.25 9.99889H8.75C9.164 9.99889 9.5 10.3349 9.5 10.7489V13.9989H12.25C12.664 13.9989 13 13.6629 13 13.2489V6.49889M5.5 13.9989H11"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
