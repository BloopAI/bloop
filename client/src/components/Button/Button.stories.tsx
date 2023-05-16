import { Fragment } from 'react';
import { MailIcon } from '../../icons';
import Button from './index';

export default {
  title: 'components/Button',
  component: Button,
};

const sizes = ['large', 'medium', 'small', 'tiny'] as const;

export const Primary = () => {
  return (
    <div className="gap-4 grid grid-cols-4-fit justify-items-start justify-center items-center">
      {sizes.map((s) => (
        <Fragment key={s}>
          {s}
          <Button size={s}>
            <MailIcon />
            Button label
            <MailIcon />
          </Button>
          <Button size={s} onlyIcon title="Mail">
            <MailIcon />
          </Button>
          <Button size={s}>OK</Button>
        </Fragment>
      ))}
      {sizes.map((s) => (
        <Fragment key={s + 'disabled'}>
          {s}
          <Button size={s} disabled>
            <MailIcon />
            Disabled
            <MailIcon />
          </Button>
          <Button size={s} disabled onlyIcon title="Mail">
            <MailIcon />
          </Button>
          <Button size={s} disabled>
            Disabled
          </Button>
        </Fragment>
      ))}
    </div>
  );
};

export const Secondary = () => {
  return (
    <div className="gap-4 grid grid-cols-4-fit justify-items-start justify-center items-center">
      {sizes.map((s) => (
        <Fragment key={s}>
          {s}
          <Button size={s} variant="secondary">
            <MailIcon />
            Button label
            <MailIcon />
          </Button>
          <Button size={s} variant="secondary" onlyIcon title="Mail">
            <MailIcon />
          </Button>
          <Button size={s} variant="secondary">
            OK
          </Button>
        </Fragment>
      ))}
      {sizes.map((s) => (
        <Fragment key={s + 'disabled'}>
          {s}
          <Button size={s} disabled variant="secondary">
            <MailIcon />
            Disabled
            <MailIcon />
          </Button>
          <Button size={s} disabled variant="secondary" onlyIcon title="Mail">
            <MailIcon />
          </Button>
          <Button size={s} disabled variant="secondary">
            Disabled
          </Button>
        </Fragment>
      ))}
    </div>
  );
};

export const Tertiary = () => {
  return (
    <div className="gap-4 grid grid-cols-4-fit justify-items-start justify-center items-center">
      {sizes.map((s) => (
        <Fragment key={s}>
          {s}
          <Button size={s} variant="tertiary">
            <MailIcon />
            Button label
            <MailIcon />
          </Button>
          <Button size={s} variant="tertiary" onlyIcon title="Mail">
            <MailIcon />
          </Button>
          <Button size={s} variant="tertiary">
            OK
          </Button>
        </Fragment>
      ))}
      {sizes.map((s) => (
        <Fragment key={s + 'disabled'}>
          {s}
          <Button size={s} disabled variant="tertiary">
            <MailIcon />
            Disabled
            <MailIcon />
          </Button>
          <Button size={s} disabled variant="tertiary" onlyIcon title="Mail">
            <MailIcon />
          </Button>
          <Button size={s} disabled variant="tertiary">
            Disabled
          </Button>
        </Fragment>
      ))}
    </div>
  );
};

export const TertiaryOutlined = () => {
  return (
    <div className="gap-4 grid grid-cols-4-fit justify-items-start justify-center items-center">
      {sizes.map((s) => (
        <Fragment key={s}>
          {s}
          <Button size={s} variant="tertiary-outlined">
            <MailIcon />
            Button label
            <MailIcon />
          </Button>
          <Button size={s} variant="tertiary-outlined" onlyIcon title="Mail">
            <MailIcon />
          </Button>
          <Button size={s} variant="tertiary-outlined">
            OK
          </Button>
        </Fragment>
      ))}
      {sizes.map((s) => (
        <Fragment key={s + 'disabled'}>
          {s}
          <Button size={s} disabled variant="tertiary-outlined">
            <MailIcon />
            Disabled
            <MailIcon />
          </Button>
          <Button
            size={s}
            disabled
            variant="tertiary-outlined"
            onlyIcon
            title="Mail"
          >
            <MailIcon />
          </Button>
          <Button size={s} disabled variant="tertiary-outlined">
            Disabled
          </Button>
        </Fragment>
      ))}
    </div>
  );
};
