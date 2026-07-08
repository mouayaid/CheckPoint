import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  NavigationContainer,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from "react-native";

import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { E2eModeProvider, useE2eMode } from "./src/context/E2eModeContext";
import {
  NotificationsProvider,
  useNotifications,
} from "./src/context/NotificationsContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { typography } from "./src/theme/theme";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import DeskScreen from "./src/screens/DeskScreen";
import RoomReservationScreen from "./src/screens/RoomReservationScreen";
import MeetingWorkspaceScreen from "./src/screens/MeetingWorkspaceScreen";
import LeaveRequestScreen from "./src/screens/LeaveRequestScreen";
import GeneralRequestScreen from "./src/screens/GeneralRequestScreen";
import DemandMenuScreen from "./src/screens/DemandMenuScreen";
import EventsScreen from "./src/screens/EventsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ManageAnnouncementsScreen from "./src/screens/admin/ManageAnnouncementsScreen";
import DepartmentChannelScreen from "./src/screens/DepartmentChannelScreen";
import ApprovalsScreen from "./src/screens/approvals/ApprovalsScreen";
import UserManagementScreen from "./src/screens/admin/UserManagementScreen";
import SeatManagementScreen from "./src/screens/admin/SeatManagementScreen";
import SplashScreen from "./src/screens/SplashScreen";
import { DepartmentChannelProvider } from "./src/context/DepartmentChannelContext";
import { useDepartmentChannel } from "./src/context/DepartmentChannelContext";
import CustomBottomTabBar from "./src/components/CustomBottomTabBar";
import RoomManagementScreen from "./src/screens/admin/RoomManagementScreen";
import AdminStatisticsScreen from "./src/screens/admin/AdminStatisticsScreen";
import DepartmentManagementScreen from "./src/screens/admin/DepartmentManagementScreen";
import SwipeTabsPager from "./src/components/SwipeTabsPager";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { isE2EMode } from "./src/utils/e2eMode";
import { useRoles } from "./src/hooks/useRoles";

const Stack = createNativeStackNavigator();

const MAIN_ROUTE_TITLES = {
  Home: "Accueil",
  Channel: "Canal",
  Announcements: "Annonces",
  Approvals: "Approbations",
  Statistics: "Statistiques",
};

function HeaderActions() {
  const navigation = useNavigation();
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();

  return (
    <View style={styles.headerActions}>
      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={() => navigation.navigate("Notifications")}
        testID="header.notificationsButton"
      >
        <Ionicons
          name={unreadCount > 0 ? "notifications" : "notifications-outline"}
          size={22}
          color={colors.textPrimary}
        />
        {unreadCount > 0 ? <View style={styles.headerBadge} /> : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={() => navigation.navigate("Profile")}
        testID="header.profileButton"
      >
        <Ionicons
          name="person-circle-outline"
          size={26}
          color={colors.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}

function HomeTabs({ navigation, route }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { refreshChannelInfo } = useDepartmentChannel();
  const { isAdmin } = useRoles(user);
  const [activeRouteName, setActiveRouteName] = useState("Home");
  const [routeParamsByName, setRouteParamsByName] = useState({});

  useFocusEffect(
    useCallback(() => {
      refreshChannelInfo();
    }, [refreshChannelInfo]),
  );

  const visibleSwipeRoutes = useMemo(() => {
    const base = ["Home"];

    if (!isAdmin) {
      base.push("Channel");
    }

    if (isAdmin) {
      base.push("Announcements");
    }

    if (isAdmin) {
      base.push("Statistics");
    }

    return base;
  }, [isAdmin]);

  const availableRouteNames = useMemo(() => {
    return isAdmin ? [...visibleSwipeRoutes, "Approvals"] : visibleSwipeRoutes;
  }, [isAdmin, visibleSwipeRoutes]);

  const pagerRoutes = useMemo(() => {
    if (visibleSwipeRoutes.includes(activeRouteName)) {
      return visibleSwipeRoutes;
    }

    if (availableRouteNames.includes(activeRouteName)) {
      return [...visibleSwipeRoutes, activeRouteName];
    }

    return visibleSwipeRoutes;
  }, [activeRouteName, availableRouteNames, visibleSwipeRoutes]);

  useEffect(() => {
    if (availableRouteNames.includes(activeRouteName)) return;

    setActiveRouteName(visibleSwipeRoutes[0] ?? "Home");
  }, [activeRouteName, availableRouteNames, visibleSwipeRoutes]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerRight: () => <HeaderActions />,
      headerStyle: {
        backgroundColor: colors.surface,
      },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: {
        fontWeight: typography.semibold,
        fontSize: typography.lg,
      },
      headerShadowVisible: false,
      title: MAIN_ROUTE_TITLES[activeRouteName] ?? MAIN_ROUTE_TITLES.Home,
    });
  }, [activeRouteName, colors.surface, colors.textPrimary, navigation]);

  useEffect(() => {
    const requestedRouteName = route.params?.screen;
    const requestedParams = route.params?.params;

    if (
      !requestedRouteName ||
      !availableRouteNames.includes(requestedRouteName)
    ) {
      return;
    }

    if (requestedParams) {
      setRouteParamsByName((prev) => ({
        ...prev,
        [requestedRouteName]: requestedParams,
      }));
    }

    setActiveRouteName(requestedRouteName);
  }, [availableRouteNames, route.params?.params, route.params?.screen]);

  const handleChangeRouteName = useCallback(
    (nextRouteName) => {
      if (!availableRouteNames.includes(nextRouteName)) return;

      setActiveRouteName(nextRouteName);
    },
    [availableRouteNames],
  );

  const renderRoute = useCallback(
    (routeName, isActiveRoute) => {
      switch (routeName) {
        case "Home":
          return <DashboardScreen />;

        case "Channel":
          return <DepartmentChannelScreen isActiveRoute={isActiveRoute} />;

        case "Announcements":
          return <ManageAnnouncementsScreen />;

        case "Statistics":
          return <AdminStatisticsScreen />;

        case "Approvals":
          return <ApprovalsScreen pagerParams={routeParamsByName.Approvals} />;

        default:
          return <DashboardScreen />;
      }
    },
    [routeParamsByName.Approvals],
  );

  return (
    <View
      style={[styles.mainTabsSurface, { backgroundColor: colors.background }]}
    >
      <SwipeTabsPager
        routes={pagerRoutes}
        activeRouteName={activeRouteName}
        onChangeRouteName={handleChangeRouteName}
        renderRoute={renderRoute}
      />

      <CustomBottomTabBar
        routes={visibleSwipeRoutes}
        activeRouteName={activeRouteName}
        onChangeRouteName={handleChangeRouteName}
      />
    </View>
  );
}

function AppNavigator() {
  const { colors, darkMode, themeLoaded } = useTheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isManager } = useRoles(user);
  const isE2e = useE2eMode();

  if ((isLoading || !themeLoaded) && !isE2e) {
    return (
      <View
        testID="bootstrap.loading"
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Chargement...
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer
        theme={{
          dark: darkMode,
          colors: {
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.textPrimary,
            border: colors.border,
            notification: colors.primary,
          },
        }}
      >
        <Stack.Navigator initialRouteName={isE2e ? "Login" : "Splash"}>
          {!isAuthenticated ? (
            <>
              <Stack.Screen
                name="Splash"
                component={SplashScreen}
                options={{ headerShown: false }}
              />

              <Stack.Screen name="Login" component={LoginScreen} />

              <Stack.Screen name="Register" component={RegisterScreen} />

              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: "Mot de passe oublié" }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="HomeTabs"
                component={HomeTabs}
                options={{ headerShown: true, title: MAIN_ROUTE_TITLES.Home }}
              />

              <Stack.Screen
                name="Desk"
                component={DeskScreen}
                options={{ title: "Réservation Bureau" }}
              />

              {isManager && (
                <Stack.Screen
                  name="Rooms"
                  component={RoomReservationScreen}
                  options={{ title: "Réservation Salle" }}
                />
              )}

              <Stack.Screen
                name="Events"
                component={EventsScreen}
                options={{ title: "Événements" }}
              />

              <Stack.Screen
                name="DemandMenu"
                component={DemandMenuScreen}
                options={{ title: "Demandes" }}
              />

              <Stack.Screen
                name="LeaveRequest"
                component={LeaveRequestScreen}
                options={{ title: "Demande de congé" }}
              />

              <Stack.Screen
                name="GeneralRequest"
                component={GeneralRequestScreen}
                options={{ title: "Demande générale" }}
              />

              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ title: "Notifications" }}
              />

              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: "Profil" }}
              />

              <Stack.Screen
                name="ManageAnnouncements"
                component={ManageAnnouncementsScreen}
                options={{ title: "Gérer Annonces" }}
              />

              <Stack.Screen
                name="EventManagement"
                component={
                  require("./src/screens/admin/EventManagementScreen").default
                }
                options={{ title: "Gestion des Événements" }}
              />

              <Stack.Screen
                name="UserManagement"
                component={UserManagementScreen}
                options={{ title: "Gestion des Utilisateurs" }}
              />

              <Stack.Screen
                name="DepartmentManagement"
                component={DepartmentManagementScreen}
                options={{ title: "Gestion des départements" }}
              />

              <Stack.Screen
                name="RoomManagement"
                component={RoomManagementScreen}
                options={{ title: "Gestion des Salles" }}
              />

              <Stack.Screen
                name="SeatManagement"
                component={SeatManagementScreen}
                options={{ title: "Tables et Sièges" }}
              />

              {isManager && (
                <Stack.Screen
                  name="MeetingWorkspace"
                  component={MeetingWorkspaceScreen}
                  options={{ title: "Espace de réunion" }}
                />
              )}
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

function RootApp() {
  const { colors, darkMode } = useTheme();
  const isE2e = useE2eMode();

  return (
    <>
      {isE2e ? (
        <View testID="e2e.modeActive" style={{ width: 0, height: 0 }} />
      ) : null}

      <StatusBar
        barStyle={darkMode ? "light-content" : "dark-content"}
        backgroundColor={colors.surface}
      />

      <AuthProvider>
        <NotificationsProvider>
          <DepartmentChannelProvider>
            <AppNavigator />
          </DepartmentChannelProvider>
        </NotificationsProvider>
      </AuthProvider>
    </>
  );
}

export default function App() {
  const isE2e = isE2EMode();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !isE2e) {
    return (
      <View
        testID="bootstrap.fontsLoading"
        style={[styles.loadingContainer, { backgroundColor: "#F4F6F8" }]}
      >
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <E2eModeProvider>
            <RootApp />
          </E2eModeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sm,
  },
  mainTabsSurface: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  tabDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerIconButton: {
    position: "relative",
    width: 44,
    height: 44,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ef4444",
  },
  tabIconWrapper: {
    position: "relative",
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadge: {
    position: "absolute",
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
