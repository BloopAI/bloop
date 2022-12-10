import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.05026 10.9498L10.9498 1.05027"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1.05026 1.05029L10.9498 10.9498"
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
      d="M5.05026 14.9498L14.9498 5.05027"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.05026 5.05029L14.9498 14.9498"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
