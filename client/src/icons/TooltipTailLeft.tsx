import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="5"
    height="13"
    viewBox="0 0 4 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.82843 12.1569L4.82843 0.843144L0.58579 5.08578C-0.195259 5.86683 -0.195259 7.13316 0.58579 7.91421L4.82843 12.1569Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="5"
    height="13"
    viewBox="0 0 4 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.82843 12.1569L4.82843 0.843144L0.58579 5.08578C-0.195259 5.86683 -0.195259 7.13316 0.58579 7.91421L4.82843 12.1569Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
