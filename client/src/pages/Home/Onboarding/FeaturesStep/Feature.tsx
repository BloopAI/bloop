import { ReactElement } from 'react';

type Props = {
  icon: ReactElement;
  title: string;
  description: string;
};

const Feature = ({ icon, description, title }: Props) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-3 items-center body-m text-white">
        {icon}
        {title}
      </div>
      <div className="pl-8 body-s text-gray-500">{description}</div>
    </div>
  );
};

export default Feature;
