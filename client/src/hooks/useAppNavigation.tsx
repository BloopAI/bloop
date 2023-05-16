import { useContext } from 'react';
import { AppNavigationContext } from '../context/appNavigationContext';

const useAppNavigation = () => useContext(AppNavigationContext);

export default useAppNavigation;
