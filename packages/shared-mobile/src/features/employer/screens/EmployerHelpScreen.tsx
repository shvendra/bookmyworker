import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HelpChatModal } from '../../../shared/components/ui/HelpChatModal';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'EmployerHelp'>;

/**
 * Employer "Get Help" as a full page (header + back arrow) instead of a
 * bottom-sheet dialog. Same Help Center flow/data as before.
 */
export const EmployerHelpScreen = ({ navigation }: Props): React.JSX.Element => (
  <HelpChatModal visible asPage onClose={() => navigation.goBack()} />
);
