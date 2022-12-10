import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="18"
    height="14"
    viewBox="0 0 18 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="4" width="18" height="6" rx="0.705882" fill="#304FFF" />
    <path
      d="M4.5 1.5L4.5 12.5M2.75 1.5H6.25M2.75 12.5H6.25"
      stroke="#DDDDE1"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const BoxedIcon = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="3" y="9" width="18" height="6" rx="0.705882" fill="#304FFF" />
    <path
      d="M7.5 6.5L7.5 17.5M5.75 6.5H9.25M5.75 17.5H9.25"
      stroke="#DDDDE1"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
