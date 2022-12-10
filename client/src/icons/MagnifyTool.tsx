import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M11.9581 11.5153L14.7866 14.3437"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9.5" cy="9.5" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M13.9581 13.5153L16.7866 16.3437"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
