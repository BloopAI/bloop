import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    viewBox="0 0 8 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="flex-shrink-0 w-[8px] h-[6px]"
  >
    <path
      d="M1 3.09524L3 5L7 1"
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
      d="M5.5 10L8.5 12.5L14.5 7.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
