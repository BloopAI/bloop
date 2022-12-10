import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M0 2.5C0 1.39543 0.895431 0.5 2 0.5H5.17157C5.70201 0.5 6.21071 0.710714 6.58579 1.08579L7.41421 1.91421C7.78929 2.28929 8.29799 2.5 8.82843 2.5H14C15.1046 2.5 16 3.39543 16 4.5V11.5C16 12.6046 15.1046 13.5 14 13.5H2C0.895431 13.5 0 12.6046 0 11.5V2.5Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 5.5C2 4.39543 2.89543 3.5 4 3.5H7.17157C7.70201 3.5 8.21071 3.71071 8.58579 4.08579L9.41421 4.91421C9.78929 5.28929 10.298 5.5 10.8284 5.5H16C17.1046 5.5 18 6.39543 18 7.5V14.5C18 15.6046 17.1046 16.5 16 16.5H4C2.89543 16.5 2 15.6046 2 14.5V5.5Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
