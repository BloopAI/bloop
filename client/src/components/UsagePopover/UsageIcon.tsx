import { memo } from 'react';

type Props = {
  percent: number;
  sizeClassName?: string;
};

type UsageProps = {
  percent: number;
};

const Usage = ({ percent }: UsageProps) => {
  const map = [
    { circle: 'fill-green', arrow: 'fill-current' },
    { circle: 'fill-yellow', arrow: 'fill-current' },
    { circle: 'fill-yellow', arrow: 'fill-current' },
    { circle: 'fill-red', arrow: 'fill-red' },
  ];

  const index = Math.max(Math.min(Math.floor(percent / 25), map.length - 1), 0);

  return (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <mask
        id="mask0_2445_23499"
        maskUnits="userSpaceOnUse"
        x="1"
        y="0"
        width="14"
        height="16"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M13.0178 5.10325L8.00027 2.20638L2.98275 5.10325V10.897L8.00027 13.7938L13.0178 10.897V5.10325ZM8.66693 1.05168C8.2544 0.813503 7.74614 0.813503 7.3336 1.05168L2.31608 3.94855C1.90355 4.18672 1.64941 4.62689 1.64941 5.10325V10.897C1.64941 11.3733 1.90355 11.8135 2.31608 12.0517L7.3336 14.9485C7.74614 15.1867 8.2544 15.1867 8.66693 14.9485L13.6845 12.0517C14.097 11.8135 14.3511 11.3733 14.3511 10.897V5.10325C14.3511 4.62689 14.097 4.18672 13.6845 3.94855L8.66693 1.05168Z"
          fill="currentColor"
        />
      </mask>
      <g mask="url(#mask0_2445_23499)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M13.0178 5.10325L8.00027 2.20638L2.98275 5.10325V10.897L8.00027 13.7938L13.0178 10.897V5.10325ZM8.66693 1.05168C8.2544 0.813503 7.74614 0.813503 7.3336 1.05168L2.31608 3.94855C1.90355 4.18672 1.64941 4.62689 1.64941 5.10325V10.897C1.64941 11.3733 1.90355 11.8135 2.31608 12.0517L7.3336 14.9485C7.74614 15.1867 8.2544 15.1867 8.66693 14.9485L13.6845 12.0517C14.097 11.8135 14.3511 11.3733 14.3511 10.897V5.10325C14.3511 4.62689 14.097 4.18672 13.6845 3.94855L8.66693 1.05168Z"
          className={index > 2 ? 'fill-red' : 'fill-current'}
        />
        {index <= 1 ? (
          <path
            d="M8 0C9.15097 1.37252e-08 10.2884 0.248356 11.3346 0.728113C12.3808 1.20787 13.3112 1.90773 14.0622 2.77991C14.8133 3.6521 15.3672 4.67607 15.6864 5.78192C16.0055 6.88777 16.0822 8.04946 15.9113 9.18768L8 8V0Z"
            className={map[index]?.circle}
          />
        ) : index === 2 ? (
          <path
            d="M8 0C9.45751 1.73807e-08 10.8873 0.398182 12.1351 1.15154C13.3828 1.90491 14.401 2.98482 15.0797 4.27466C15.7584 5.5645 16.0718 7.01526 15.9862 8.47025C15.9005 9.92525 15.419 11.3292 14.5935 12.5305C13.7681 13.7317 12.6302 14.6847 11.3027 15.2864C9.97523 15.8881 8.50856 16.1158 7.06112 15.9447C5.61368 15.7737 4.24047 15.2104 3.08979 14.3158C1.93911 13.4213 1.05469 12.2293 0.53204 10.8687L8 8V0Z"
            className={map[index]?.circle}
          />
        ) : null}
      </g>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.52892 5.52827C7.78927 5.26792 8.21138 5.26792 8.47173 5.52827L10.1384 7.19494C10.3987 7.45529 10.3987 7.8774 10.1384 8.13775C9.87805 8.3981 9.45594 8.3981 9.19559 8.13775L8.66699 7.60915V10.6663C8.66699 11.0345 8.36852 11.333 8.00033 11.333C7.63214 11.333 7.33366 11.0345 7.33366 10.6663V7.60915L6.80506 8.13775C6.54471 8.3981 6.1226 8.3981 5.86225 8.13775C5.6019 7.8774 5.6019 7.45529 5.86225 7.19494L7.52892 5.52827Z"
        className={map[index]?.arrow}
      />
    </svg>
  );
};

const UsageIcon = ({ percent, sizeClassName }: Props) => {
  return (
    <div className={sizeClassName || 'w-5 h-5'}>
      <Usage percent={percent} />
    </div>
  );
};

export default memo(UsageIcon);
