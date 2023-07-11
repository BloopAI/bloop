import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.40201 4.09172C11.9788 4.09172 15.7778 6.46256 15.7778 11.9998V13.1111C14.2295 9.47469 11.0156 9.10424 7.40201 9.10424V11.3949C7.40201 12.1856 6.47828 12.601 5.90155 12.0702L0.517132 7.11599C0.115096 6.74676 0.125864 6.10304 0.538669 5.74596L5.92309 1.10752C6.507 0.604687 7.40201 1.02493 7.40201 1.80104V4.09172Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.40201 7.09172C13.9788 7.09172 17.7778 9.46256 17.7778 14.9998V16.1111C16.2295 12.4747 13.0156 12.1042 9.40201 12.1042V14.3949C9.40201 15.1856 8.47828 15.601 7.90155 15.0702L2.51713 10.116C2.1151 9.74676 2.12586 9.10304 2.53867 8.74596L7.92309 4.10752C8.507 3.60469 9.40201 4.02493 9.40201 4.80104V7.09172Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
