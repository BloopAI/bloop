import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.24281 1.37465L1.08362 7.53506L0.464844 6.9164L6.62403 0.755992L7.24281 1.37465Z"
      fill="currentColor"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0.646062 0.645508H6.9169C7.15852 0.645508 7.3544 0.841383 7.3544 1.08301V7.35384H6.4794V1.52051H0.646062V0.645508Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.2428 4.37465L4.08362 10.5351L3.46484 9.9164L9.62403 3.75599L10.2428 4.37465Z"
      fill="currentColor"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.64606 3.64551H9.9169C10.1585 3.64551 10.3544 3.84138 10.3544 4.08301V10.3538H9.4794V4.52051H3.64606V3.64551Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
