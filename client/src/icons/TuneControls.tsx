import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16.5 12L14.5 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M6.5 12L1.5 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="11.5"
      cy="12"
      r="2.5"
      transform="rotate(90 11.5 12)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M1.5 4L3.5 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M11.5 4L16.5 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="6.5"
      cy="4"
      r="2.5"
      transform="rotate(-90 6.5 4)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.5 14L15.5 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M7.5 14L2.5 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="12.5"
      cy="14"
      r="2.5"
      transform="rotate(90 12.5 14)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M2.5 6L4.5 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M12.5 6L17.5 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="7.5"
      cy="6"
      r="2.5"
      transform="rotate(-90 7.5 6)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
