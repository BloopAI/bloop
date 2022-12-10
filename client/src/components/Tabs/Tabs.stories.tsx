import { useState } from 'react';
import { MailIcon } from '../../icons';
import Tabs from './index';
import '../../index.css';

export default {
  title: 'components/Tabs',
  component: Tabs,
};

export const LinkMedium = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900">
      <Tabs
        tabs={[
          { title: 'Medium1' },
          { title: 'Medium2', iconLeft: <MailIcon /> },
          { title: 'Medium3', iconRight: <MailIcon /> },
          { title: 'Medium4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
};

export const LinkSmall = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900">
      <Tabs
        tabs={[
          { title: 'Small1' },
          { title: 'Small2', iconLeft: <MailIcon /> },
          { title: 'Small3', iconRight: <MailIcon /> },
          { title: 'Small4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        size="small"
      />
    </div>
  );
};

export const LinkLarge = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900">
      <Tabs
        tabs={[
          { title: 'Large1' },
          { title: 'Large2', iconLeft: <MailIcon /> },
          { title: 'Large3', iconRight: <MailIcon /> },
          { title: 'Large4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        size="large"
      />
    </div>
  );
};

export const LinkFullWidth = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900 max-w-md2 w-full">
      <Tabs
        tabs={[
          { title: 'Tab1' },
          { title: 'Tab2', iconLeft: <MailIcon /> },
          { title: 'Tab3', iconRight: <MailIcon /> },
          { title: 'Tab4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        fullWidth
      />
    </div>
  );
};

export const ButtonMedium = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900">
      <Tabs
        tabs={[
          { title: 'Medium1' },
          { title: 'Medium2', iconLeft: <MailIcon /> },
          { title: 'Medium3', iconRight: <MailIcon /> },
          { title: 'Medium4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="button"
      />
    </div>
  );
};

export const ButtonSmall = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900">
      <Tabs
        tabs={[
          { title: 'Small1' },
          { title: 'Small2', iconLeft: <MailIcon /> },
          { title: 'Small3', iconRight: <MailIcon /> },
          { title: 'Small4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        size="small"
        variant="button"
      />
    </div>
  );
};

export const ButtonLarge = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900">
      <Tabs
        tabs={[
          { title: 'Large1' },
          { title: 'Large2', iconLeft: <MailIcon /> },
          { title: 'Large3', iconRight: <MailIcon /> },
          { title: 'Large4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        size="large"
        variant="button"
      />
    </div>
  );
};

export const ButtonFullWidth = () => {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="bg-gray-900 max-w-md2 w-full">
      <Tabs
        tabs={[
          { title: 'Tab1' },
          { title: 'Tab2', iconLeft: <MailIcon /> },
          { title: 'Tab3', iconRight: <MailIcon /> },
          { title: 'Tab4', iconLeft: <MailIcon />, iconRight: <MailIcon /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        fullWidth
        variant="button"
      />
    </div>
  );
};
