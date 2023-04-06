import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import Button from '../../../Button';
import TextInput from '../../../TextInput';
import SettingsRow from '../../SettingsRow';
import SettingsText from '../../SettingsText';
import { UIContext } from '../../../../context/uiContext';
import { EMAIL_REGEX } from '../../../../consts/validations';
import { saveUserData } from '../../../../services/api';
import { DeviceContext } from '../../../../context/deviceContext';

const ProfileSettings = () => {
  const { onBoardingState, setOnBoardingState } = useContext(UIContext);
  const { envConfig } = useContext(DeviceContext);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    emailError: '',
  });

  useEffect(() => {
    const savedForm = onBoardingState['STEP_DATA_FORM'];

    setForm((prev) => ({
      ...prev,
      firstName: savedForm?.firstName || '',
      lastName: savedForm?.lastName || '',
      email: savedForm?.email || '',
    }));
  }, [onBoardingState]);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
      emailError: e.target.name === 'email' ? '' : prev.emailError,
    }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (form.emailError) {
        return;
      }
      setOnBoardingState((prev) => ({
        ...prev,
        ['STEP_DATA_FORM']: form,
      }));
      saveUserData({
        email: form.email,
        first_name: form.firstName,
        last_name: form.lastName,
        unique_id: envConfig.tracking_id || '',
      });
    },
    [form, envConfig.tracking_id],
  );

  return (
    <form className="block">
      {/*<div className="border-t border-t-gray-800 flex items-center justify-start gap-4 py-6">*/}
      {/*  <img*/}
      {/*    src={avatarUrl || '/empty_avatar.png'}*/}
      {/*    alt="avatar"*/}
      {/*    className="w-13 h-13 rounded-full "*/}
      {/*  />*/}
      {/*  <label className="flex items-center gap-4 flex-1 relative cursor-pointer">*/}
      {/*    <input*/}
      {/*      type="file"*/}
      {/*      className="hidden"*/}
      {/*      id="avatar-upload"*/}
      {/*      onChange={(e) => setAvatarUrl(e.target.files?.[0]?.name || '')}*/}
      {/*    />*/}
      {/*    <Button variant="secondary">Choose</Button>*/}
      {/*    /!* overlay over button to prevent click event to be fired on button instead of label *!/*/}
      {/*    <div className="absolute top-0 left-0 bottom-0 w-24" />*/}
      {/*    <p className="body-s text-gray-500">JPG, GIF or PNG. 1MB Max.</p>*/}
      {/*  </label>*/}
      {/*  <Button onlyIcon variant="tertiary-outlined" title="Remove avatar">*/}
      {/*    <TrashCan />*/}
      {/*  </Button>*/}
      {/*</div>*/}
      <SettingsRow>
        <SettingsText
          title="First and last name"
          subtitle="Manage how you will be called in bloop"
        />
        <div className="flex flex-1 flex-col gap-4">
          <TextInput
            value={form.firstName}
            onChange={onChange}
            name="firstName"
            label="First name"
            variant="filled"
            placeholder="Your name"
          />
          <TextInput
            value={form.lastName}
            onChange={onChange}
            name="lastName"
            label="Last name"
            variant="filled"
            placeholder="Your last name"
          />
        </div>
      </SettingsRow>
      <SettingsRow>
        <SettingsText
          title="Email"
          subtitle="Used to sign in, syncing and product updates"
        />
        <div className="flex-1 flex flex-col items-end">
          <TextInput
            value={form.email}
            onChange={onChange}
            name="email"
            label="Email"
            variant="filled"
            placeholder="Your email address"
            validate={() => {
              if (!EMAIL_REGEX.test(form.email)) {
                setForm((prev) => ({
                  ...prev,
                  emailError: 'Email is not valid',
                }));
              }
            }}
            error={form.emailError}
          />
        </div>
      </SettingsRow>
      <Button
        size="small"
        className="absolute top-0 right-0"
        disabled={
          !!form.emailError ||
          (form.email === onBoardingState['STEP_DATA_FORM']?.email &&
            form.firstName === onBoardingState['STEP_DATA_FORM']?.firstName &&
            form.lastName === onBoardingState['STEP_DATA_FORM']?.lastName)
        }
        onClick={handleSubmit}
      >
        Save changes
      </Button>
    </form>
  );
};

export default ProfileSettings;
