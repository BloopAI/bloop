import { CheckIcon, MailIcon } from '../../icons';
import Breadcrumbs from './index';
import '../../index.css';

export default {
  title: 'components/Breadcrumbs',
  component: Breadcrumbs,
};

const onClick = (e: any) => {
  e.preventDefault();
};

export const Default = () => {
  return (
    <div>
      <Breadcrumbs
        path="Home/Section/Subsection"
        pathParts={[
          { label: 'Home', onClick },
          {
            label: 'Section',
            icon: <MailIcon />,
            onClick,
          },
          {
            label: 'Subsection',
            icon: <CheckIcon />,
            onClick,
          },
        ]}
      />
    </div>
  );
};

export const Truncated = () => {
  return (
    <div
      style={{
        width: 500,
        border: '1px solid red',
      }}
    >
      <Breadcrumbs
        path="Home/Some Section"
        pathParts={[
          {
            label: 'Home',
            icon: <MailIcon />,
            onClick,
          },
          {
            label: 'Some Section',
            onClick,
          },
          {
            label: 'Some Long Section',
            onClick,
          },
          {
            label: 'Another Long Section',
            onClick,
          },
          {
            label: 'Prev Subsection',
            onClick,
          },
          {
            label: 'Subsection',
            onClick,
          },
        ]}
      />
    </div>
  );
};

export const Button = () => {
  return (
    <div
      style={{
        width: 500,
        border: '1px solid red',
      }}
    >
      <Breadcrumbs
        path="Home/Some Section"
        type="button"
        pathParts={[
          {
            label: 'Home',
            icon: <MailIcon />,
            onClick,
          },
          {
            label: 'Some Section',
            onClick,
          },
          {
            label: 'Some Long Section',
            onClick,
          },
          {
            label: 'Another Long Section',
            onClick,
          },
          {
            label: 'Prev Subsection',
            onClick,
          },
          {
            label: 'Subsection',
            onClick,
          },
        ]}
      />
    </div>
  );
};
