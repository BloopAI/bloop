import { useState } from 'react';
import TextInput from '../../../TextInput';
import Button from '../../../Button';
import SettingsRow from '../../SettingsRow';
import SettingsText from '../../SettingsText';

const PasswordSettings = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  return (
    <div>
      <SettingsRow>
        <SettingsText
          title="Password"
          subtitle="Confirm your current password before setting a new one"
        />
        <div className="flex flex-1 flex-col gap-4 items-end">
          <TextInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            name="currentPassword"
            label="Current Password"
            variant="filled"
            type="password"
          />
          <TextInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            name="newPassword"
            label="New Password"
            variant="filled"
            type="password"
            helperText="8 characters minimum"
          />
          <TextInput
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            name="confirmNewPassword"
            label="Confirm New Password"
            variant="filled"
            type="password"
          />
          <Button disabled={!newPassword || newPassword !== confirmNewPassword}>
            Change Password
          </Button>
        </div>
      </SettingsRow>
    </div>
  );
};

export default PasswordSettings;
