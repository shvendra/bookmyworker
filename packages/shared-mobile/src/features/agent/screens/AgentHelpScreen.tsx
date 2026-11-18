import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HelpChatModal } from '../../../shared/components/ui/HelpChatModal';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'AgentHelp'>;

/**
 * Agent / Worker "Get Help" as a full page (header + back arrow) instead of a dialog — same
 * Help Center flow as the Employer app (HelpChatModal in page mode).
 */
export const AgentHelpScreen = ({ navigation }: Props): React.JSX.Element => (
  <HelpChatModal visible asPage onClose={() => navigation.goBack()} />
);
