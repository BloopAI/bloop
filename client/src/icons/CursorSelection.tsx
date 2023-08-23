import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="18"
    height="14"
    viewBox="0 0 18 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="4" width="18" height="6" rx="0.705882" className="fill-bg-main" />
    <path
      d="M4.5 1.5L4.5 12.5M2.75 1.5H6.25M2.75 12.5H6.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const BoxedIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2.25"
      y="6.75"
      width="13.5"
      height="4.5"
      rx="0.529412"
      className="fill-bg-main"
    />
    <path
      d="M5.625 4.875L5.625 13.125M4.3125 4.875H6.9375M4.3125 13.125H6.9375"
      stroke="currentColor"
      strokeWidth="1.125"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
