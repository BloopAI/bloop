import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.39206 6.18644L4.283 5.77944C3.92565 4.44577 4.71711 3.07493 6.05077 2.71758L12.8123 0.905843C14.1459 0.548489 15.5168 1.33994 15.8741 2.67361L16.9094 6.53731C17.2667 7.87098 16.4753 9.24182 15.1416 9.59918L12.8167 10.2221"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="0.950012"
      y="6.6319"
      width="11.5"
      height="8.5"
      rx="1.75"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.39206 8.18644L5.283 7.77944C4.92565 6.44577 5.71711 5.07493 7.05077 4.71758L13.8123 2.90584C15.1459 2.54849 16.5168 3.33994 16.8741 4.67361L17.9094 8.53731C18.2667 9.87098 17.4753 11.2418 16.1416 11.5992L13.8167 12.2221"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="1.95001"
      y="8.6319"
      width="11.5"
      height="8.5"
      rx="1.75"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
