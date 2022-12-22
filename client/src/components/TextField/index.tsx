import React from 'react';

type Props = {
  value: string;
  active?: boolean;
  icon?: React.ReactElement;
  className?: string;
};

const TextField = ({ icon, value, className, active = true }: Props) => {
  return (
    <span className={`flex items-center gap-2 ${className ? className : ''}`}>
      {icon}
      <span className="ellipsis">{value}</span>
    </span>
  );
};
export default TextField;
