import { memo } from 'react';

type Props = {
  percent: number;
  sizeClassName?: string;
};

type UsageProps = {
  percent: number;
};

const Usage = ({ percent }: UsageProps) => {
  const r = 7;
  const C = 2 * Math.PI * r;

  function setPercentage(percentage: number) {
    const filled = C * (percentage / 100);
    const unfilled = C - filled;
    return `${filled} ${unfilled}`;
  }

  const strokeDashArray = setPercentage(percent > 100 ? 100 : percent);

  const map = [
    { fill: 'fill-green', stroke: 'stroke-green' },
    { fill: 'fill-yellow', stroke: 'stroke-yellow' },
    { fill: 'fill-orange-600', stroke: 'stroke-orange-600' },
    { fill: 'fill-red', stroke: 'stroke-red' },
    { fill: 'fill-red', stroke: 'stroke-red' },
  ];

  const index = Math.max(Math.min(Math.floor(percent / 25), map.length - 1), 0);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      key="usage-med"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 16C13.3137 16 16 13.3137 16 10C16 6.6863 13.3137 4 10 4C6.6863 4 4 6.6863 4 10C4 13.3137 6.6863 16 10 16ZM10 18C14.4183 18 18 14.4183 18 10C18 5.58173 14.4183 2 10 2C5.58173 2 2 5.58173 2 10C2 14.4183 5.58173 18 10 18Z"
        className="fill-bg-border-hover"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.5267 8.5267C8.9174 8.136 9.4473 7.9165 9.99984 7.9165C10.5524 7.9165 11.0823 8.136 11.473 8.5267C11.8637 8.9174 12.0832 9.4473 12.0832 9.99984C12.0832 10.5524 11.8637 11.0823 11.473 11.473C11.0823 11.8637 10.5524 12.0832 9.99984 12.0832C9.4473 12.0832 8.9174 11.8637 8.5267 11.473C8.136 11.0823 7.9165 10.5524 7.9165 9.99984C7.9165 9.4473 8.136 8.9174 8.5267 8.5267Z"
        className={map[index]?.fill}
      />
      <mask id="path-3-inside-1_10650_70292" fill="white">
        <path d="M10 2.99702C10 2.44638 10.4481 1.9936 10.9945 2.06205C11.8767 2.17257 12.7367 2.42971 13.5383 2.82502C14.6389 3.36775 15.5998 4.15638 16.3468 5.12991C17.0938 6.10343 17.6069 7.23576 17.8463 8.43928C18.0857 9.6428 18.045 10.8853 17.7274 12.0706C17.4098 13.2558 16.8238 14.3522 16.0147 15.2748C15.2056 16.1974 14.1952 16.9214 13.0615 17.391C11.9278 17.8606 10.7012 18.0631 9.47677 17.9829C8.58491 17.9244 7.71154 17.7171 6.89224 17.3717C6.38485 17.1578 6.22319 16.5416 6.49851 16.0648C6.77383 15.5879 7.38198 15.4333 7.89779 15.626C8.44498 15.8305 9.02076 15.9547 9.60719 15.9931C10.5265 16.0534 11.4473 15.9013 12.2984 15.5488C13.1495 15.1962 13.9081 14.6526 14.5155 13.96C15.1229 13.2674 15.5629 12.4443 15.8013 11.5545C16.0398 10.6646 16.0703 9.73183 15.8906 8.82829C15.7108 7.92475 15.3257 7.07467 14.7649 6.3438C14.204 5.61293 13.4826 5.02087 12.6564 4.61341C12.1293 4.35348 11.5686 4.17313 10.9925 4.0766C10.4494 3.98561 10 3.54765 10 2.99702Z" />
      </mask>
      <circle
        cx="50%"
        cy="50%"
        r="7"
        fill="transparent"
        className={map[index]?.stroke}
        strokeWidth="2"
        strokeDasharray={strokeDashArray}
        strokeDashoffset="10.9955"
      ></circle>
      <defs>
        <radialGradient
          id="paint0_radial_10650_70292"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(5 6.5) rotate(66.5014) scale(12.5399)"
        >
          <stop stopColor="#C7374D" />
          <stop offset="1" stopColor="#C73790" />
        </radialGradient>
      </defs>
    </svg>
  );
};

const TokenUsage = ({ percent, sizeClassName }: Props) => {
  return (
    <div className={sizeClassName || 'w-5 h-5'}>
      <Usage percent={percent} />
    </div>
  );
};

export default memo(TokenUsage);
