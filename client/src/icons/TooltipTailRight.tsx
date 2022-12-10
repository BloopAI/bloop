import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="6"
    height="13"
    viewBox="1 0 6 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0.82843 12.1569L0.82843 0.843144L5.07107 5.08578C5.85212 5.86683 5.85212 7.13316 5.07107 7.91421L0.82843 12.1569Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="6"
    height="13"
    viewBox="0 0 6 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0.82843 12.1569L0.82843 0.843144L5.07107 5.08578C5.85212 5.86683 5.85212 7.13316 5.07107 7.91421L0.82843 12.1569Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
