import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { AppRole } from '../../shared/types/domain';
import { useAppTheme } from '../../core/theme';
import { AppText } from '../../shared/components/ui/AppText';

// ── Dashboards ────────────────────────────────────────────────────────────────
import { WorkerDashboardScreen } from '../../features/worker/screens/WorkerDashboardScreen';
import { EmployerDashboardScreen } from '../../features/employer/screens/EmployerDashboardScreen';
import { AgentDashboardScreen } from '../../features/agent/screens/AgentDashboardScreen';
// ── Role-specific feature screens ─────────────────────────────────────────────
import { PayoutScreen } from '../../features/wallet/screens/PayoutScreen';
import { TransactionScreen } from '../../features/wallet/screens/TransactionScreen';

// ── Shared screens ────────────────────────────────────────────────────────────
import { WorkerSearchScreen } from '../../features/search/screens/WorkerSearchScreen';
import { PostRequirementScreen } from '../../features/jobs/screens/PostRequirementScreen';
import { AddWorkerScreen } from '../../features/agent/screens/AddWorkerScreen';
import { AttendanceScreen } from '../../features/attendance/screens/AttendanceScreen';
import { JobMarketplaceScreen } from '../../features/jobs/screens/JobMarketplaceScreen';
import { ChatNavigator } from './ChatNavigator';
import { ProfileScreen } from '../../features/profile/screens/ProfileScreen';

type Icon = keyof typeof Ionicons.glyphMap;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TabComponent = React.ComponentType<any>;

interface TabConfig {
  name: string;
  /** i18n key for tab label — translated at render time */
  labelKey: string;
  component: TabComponent;
  icon: { outline: Icon; filled: Icon };
  /** Make this the center "action" tab (special styling) */
  isAction?: boolean;
  /**
   * When set, pulls unread count from React Query cache to show a badge.
   * 'notifications' reads from the ['notifications'] query cache.
   */
  badgeKey?: 'notifications';
}

const roleTabConfigs: Record<AppRole, TabConfig[]> = {
  worker: [
    { name: 'Home',       labelKey: 'tab_home',       component: WorkerDashboardScreen, icon: { outline: 'home-outline',       filled: 'home'       } },
    { name: 'Jobs',       labelKey: 'tab_jobs',        component: JobMarketplaceScreen,  icon: { outline: 'briefcase-outline',  filled: 'briefcase'  } },
    { name: 'Attendance', labelKey: 'tab_attendance',  component: AttendanceScreen,      icon: { outline: 'calendar-outline',   filled: 'calendar'   }, isAction: true },
    { name: 'Chat',       labelKey: 'tab_chat',        component: ChatNavigator,         icon: { outline: 'chatbubbles-outline',filled: 'chatbubbles'} },
    { name: 'Profile',    labelKey: 'tab_profile',     component: ProfileScreen,         icon: { outline: 'person-outline',     filled: 'person'     } },
  ],
  employer: [
    { name: 'Home',         labelKey: 'tab_dashboard', component: EmployerDashboardScreen, icon: { outline: 'home-outline',       filled: 'home'       } },
    { name: 'Workers',      labelKey: 'tab_workers',   component: WorkerSearchScreen,      icon: { outline: 'people-outline',     filled: 'people'     } },
    { name: 'Post',         labelKey: 'tab_post',      component: PostRequirementScreen,   icon: { outline: 'add-circle-outline', filled: 'add-circle' }, isAction: true },
    { name: 'Transactions', labelKey: 'tab_payments',  component: TransactionScreen,       icon: { outline: 'wallet-outline',     filled: 'wallet'     } },
    { name: 'Profile',      labelKey: 'tab_profile',   component: ProfileScreen,           icon: { outline: 'person-outline',     filled: 'person'     } },
  ],
  agent: [
    { name: 'Home',    labelKey: 'tab_home',    component: AgentDashboardScreen, icon: { outline: 'home-outline',      filled: 'home'      } },
    { name: 'Browse',  labelKey: 'tab_browse',  component: JobMarketplaceScreen, icon: { outline: 'briefcase-outline', filled: 'briefcase' } },
    { name: 'Chat',    labelKey: 'tab_chat',    component: ChatNavigator,        icon: { outline: 'chatbubbles-outline',filled: 'chatbubbles'} },
    { name: 'Profile', labelKey: 'tab_profile', component: ProfileScreen,        icon: { outline: 'person-outline',    filled: 'person'    } },
  ],
  selfworker: [
    { name: 'Home',     labelKey: 'tab_home',       component: AgentDashboardScreen, icon: { outline: 'home-outline',       filled: 'home'       } },
    { name: 'Browse',   labelKey: 'tab_browse',     component: JobMarketplaceScreen, icon: { outline: 'briefcase-outline',  filled: 'briefcase'  } },
    { name: 'Register', labelKey: 'tab_register',   component: AddWorkerScreen,      icon: { outline: 'person-add-outline', filled: 'person-add' }, isAction: true },
    { name: 'Payout',   labelKey: 'tab_payout',     component: PayoutScreen,         icon: { outline: 'wallet-outline',     filled: 'wallet'     } },
    { name: 'Profile',  labelKey: 'tab_profile',    component: ProfileScreen,        icon: { outline: 'person-outline',     filled: 'person'     } },
  ],
  // Admin/SuperAdmin roles fall back to the employer tab set
  admin: [
    { name: 'Home',         labelKey: 'tab_dashboard', component: EmployerDashboardScreen, icon: { outline: 'home-outline',       filled: 'home'       } },
    { name: 'Workers',      labelKey: 'tab_workers',   component: WorkerSearchScreen,      icon: { outline: 'people-outline',     filled: 'people'     } },
    { name: 'Post',         labelKey: 'tab_post',      component: PostRequirementScreen,   icon: { outline: 'add-circle-outline', filled: 'add-circle' }, isAction: true },
    { name: 'Transactions', labelKey: 'tab_payments',  component: TransactionScreen,       icon: { outline: 'wallet-outline',     filled: 'wallet'     } },
    { name: 'Profile',      labelKey: 'tab_profile',   component: ProfileScreen,           icon: { outline: 'person-outline',     filled: 'person'     } },
  ],
  superadmin: [
    { name: 'Home',         labelKey: 'tab_dashboard', component: EmployerDashboardScreen, icon: { outline: 'home-outline',       filled: 'home'       } },
    { name: 'Workers',      labelKey: 'tab_workers',   component: WorkerSearchScreen,      icon: { outline: 'people-outline',     filled: 'people'     } },
    { name: 'Post',         labelKey: 'tab_post',      component: PostRequirementScreen,   icon: { outline: 'add-circle-outline', filled: 'add-circle' }, isAction: true },
    { name: 'Transactions', labelKey: 'tab_payments',  component: TransactionScreen,       icon: { outline: 'wallet-outline',     filled: 'wallet'     } },
    { name: 'Profile',      labelKey: 'tab_profile',   component: ProfileScreen,           icon: { outline: 'person-outline',     filled: 'person'     } },
  ],
};

type DynamicTabsParamList = Record<string, undefined>;
const Tab = createBottomTabNavigator<DynamicTabsParamList>();

// ── Animated tab item ──────────────────────────────────────────────────────────
interface TabItemProps {
  routeKey: string;
  tabCfg: TabConfig;
  isFocused: boolean;
  badgeCount: number;
  onPress: () => void;
  accessibilityLabel: string;
}

const TabItem = ({ tabCfg, isFocused, badgeCount, onPress, accessibilityLabel }: TabItemProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const isDark = theme.mode === 'dark';

  const handlePressIn = (): void => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 60, bounciness: 4 }).start();
    Animated.spring(iconScale, { toValue: 0.82, useNativeDriver: true, speed: 60, bounciness: 4 }).start();
  };
  const handlePressOut = (): void => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 10 }).start();
    Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 10 }).start();
  };

  const icons = tabCfg.icon;
  const label = t(tabCfg.labelKey, tabCfg.labelKey);
  const iconColor = isFocused ? theme.colors.primary : (isDark ? theme.colors.mutedText : '#94A3B8');

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}
      style={tabStyles.tab}
    >
      {/* Active top-dot indicator */}
      {isFocused && (
        <View style={[tabStyles.activeDot, { backgroundColor: theme.colors.primary }]} />
      )}

      {/* Active bg pill */}
      {isFocused && (
        <View
          style={[
            tabStyles.activePill,
            { backgroundColor: isDark ? theme.colors.primary + '20' : theme.colors.primaryLight },
          ]}
        />
      )}

      {/* Icon with badge */}
      <Animated.View style={[tabStyles.iconWrap, { transform: [{ scale: iconScale }] }]}>
        <Ionicons
          name={isFocused ? icons.filled : icons.outline}
          size={isFocused ? 23 : 21}
          color={iconColor}
        />
        {badgeCount > 0 && (
          <View style={[tabStyles.badge, { backgroundColor: theme.colors.danger }]}>
            {badgeCount > 9 ? (
              <AppText style={tabStyles.badgeText}>9+</AppText>
            ) : (
              <AppText style={tabStyles.badgeText}>{String(badgeCount)}</AppText>
            )}
          </View>
        )}
      </Animated.View>

      <Animated.View style={{ transform: [{ scale }] }}>
        <AppText
          variant="micro"
          color={iconColor}
          style={[tabStyles.label, isFocused && { fontWeight: '700', color: theme.colors.primary }]}
          numberOfLines={1}
        >
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
};

// ── Action tab item ────────────────────────────────────────────────────────────
interface ActionTabItemProps {
  routeKey: string;
  tabCfg: TabConfig;
  isFocused: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

const ActionTabItem = ({ tabCfg, isFocused, onPress, accessibilityLabel }: ActionTabItemProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 60, bounciness: 4 }).start();
  };
  const handlePressOut = (): void => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={[{ flex: 1.1, transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={accessibilityLabel}
        style={[
          tabStyles.actionTab,
          { backgroundColor: isFocused ? theme.colors.primaryDark : theme.colors.primary },
          theme.shadow.lg,
        ]}
      >
        <Ionicons
          name={isFocused ? tabCfg.icon.filled : tabCfg.icon.outline}
          size={24}
          color="#FFFFFF"
        />
        <AppText variant="micro" color="#FFFFFF" style={tabStyles.actionLabel} numberOfLines={1}>
          {t(tabCfg.labelKey, tabCfg.labelKey)}
        </AppText>
      </Pressable>
    </Animated.View>
  );
};

// ── Custom Tab Bar ─────────────────────────────────────────────────────────────
const CustomTabBar = ({ state, descriptors, navigation, tabConfigs }: BottomTabBarProps & { tabConfigs: TabConfig[] }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.mode === 'dark';
  const qc = useQueryClient();

  const getTabBadge = (tabCfg: TabConfig): number => {
    if (!tabCfg.badgeKey) return 0;
    if (tabCfg.badgeKey === 'notifications') {
      const cached = qc.getQueryData<{ unreadCount?: number }>(['notifications']);
      return cached?.unreadCount ?? 0;
    }
    return 0;
  };

  return (
    <View
      style={[
        tabStyles.container,
        {
          backgroundColor: theme.colors.tabBarBg,
          borderTopColor: isDark ? theme.colors.border : '#E8EEF8',
          paddingBottom: Math.max(insets.bottom, 4) + 2,
        },
        !isDark && tabStyles.shadow,
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const tabCfg = tabConfigs.find((t) => t.name === route.name);
        const isFocused = state.index === index;
        const isAction = tabCfg?.isAction ?? false;
        const accessibilityLabel = options.tabBarAccessibilityLabel ?? (tabCfg?.labelKey ?? route.name);

        const onPress = (): void => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (!tabCfg) return null;

        if (isAction) {
          return (
            <ActionTabItem
              key={route.key}
              routeKey={route.key}
              tabCfg={tabCfg}
              isFocused={isFocused}
              onPress={onPress}
              accessibilityLabel={accessibilityLabel}
            />
          );
        }

        return (
          <TabItem
            key={route.key}
            routeKey={route.key}
            tabCfg={tabCfg}
            isFocused={isFocused}
            badgeCount={getTabBadge(tabCfg)}
            onPress={onPress}
            accessibilityLabel={accessibilityLabel}
          />
        );
      })}
    </View>
  );
};

// ── Navigator ─────────────────────────────────────────────────────────────────
interface RoleTabsNavigatorProps {
  role: AppRole;
}

export const RoleTabsNavigator = ({ role }: RoleTabsNavigatorProps): React.JSX.Element => {
  const tabs = roleTabConfigs[role] ?? roleTabConfigs.worker;

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} tabConfigs={tabs} />}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ title: tab.labelKey }}
        />
      ))}
    </Tab.Navigator>
  );
};

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 6,
    minHeight: Platform.OS === 'ios' ? 72 : 62,
  },
  shadow: {
    shadowColor: '#1B4FD8',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 14,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    paddingTop: 6,
    gap: 3,
    position: 'relative',
    minHeight: 52,
  },

  activeDot: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 3,
    borderRadius: 2,
  },

  activePill: {
    position: 'absolute',
    top: 4,
    borderRadius: 12,
    width: 40,
    height: 30,
  },

  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },

  label: {
    letterSpacing: 0.1,
    marginTop: 1,
  },

  actionTab: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 8,
    marginHorizontal: 4,
    marginBottom: 4,
    gap: 2,
    minHeight: 52,
  },
  actionLabel: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
