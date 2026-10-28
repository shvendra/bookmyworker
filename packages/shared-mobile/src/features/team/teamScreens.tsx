import React from 'react';
import { TeamHomeScreen } from './screens/TeamHomeScreen';
import { TeamRequirementsScreen } from './screens/TeamRequirementsScreen';
import { TeamWorkerSearchScreen } from './screens/TeamWorkerSearchScreen';
import { TeamInfoScreen } from './screens/TeamInfoScreen';
import { PostRequirementScreen } from '../jobs/screens/PostRequirementScreen';
import { RequirementDetailScreen } from '../jobs/screens/RequirementDetailScreen';
import { WorkerProfileScreen } from '../search/screens/WorkerProfileScreen';
import { EmployerAttendanceScreen } from '../employer/screens/EmployerAttendanceScreen';
import { RequirementCalendarScreen } from '../employer/screens/RequirementCalendarScreen';

/**
 * Every screen a signed-in TEAM MEMBER can reach (the same stack is used by the employer app and the shared navigator).
 * Which of them actually work is decided by the member's permissions on the server — a screen without permission simply gets
 * a "not allowed" answer from the API. Home is first, so it is the initial screen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const renderTeamScreens = (Stack: any): React.JSX.Element => (
  <>
    <Stack.Screen name="TeamHome" component={TeamHomeScreen} options={{ animation: 'none', headerShown: false }} />
    <Stack.Screen name="TeamRequirements" component={TeamRequirementsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
    <Stack.Screen name="WorkerSearch" component={TeamWorkerSearchScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
    <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} options={{ animation: 'slide_from_right' }} />
    <Stack.Screen name="PostRequirement" component={PostRequirementScreen} options={{ animation: 'slide_from_right' }} />
    <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} options={{ animation: 'slide_from_right' }} />
    <Stack.Screen name="EmployerAttendance" component={EmployerAttendanceScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
    <Stack.Screen name="RequirementCalendar" component={RequirementCalendarScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
    <Stack.Screen name="Notifications" component={TeamInfoScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
    <Stack.Screen name="Subscription" component={TeamInfoScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
  </>
);
