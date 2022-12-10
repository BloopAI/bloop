import ProfileSettings from './Profile';

// const tabs = [{ title: 'Profile' }, { title: 'Password' }];

const General = () => {
  // const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="w-full relative">
      <div className="mb-7">
        <h5>General</h5>
      </div>
      {/*<Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />*/}
      {/*{activeTab === 0 ? <ProfileSettings /> : <PasswordSettings />}*/}
      <ProfileSettings />
    </div>
  );
};

export default General;
