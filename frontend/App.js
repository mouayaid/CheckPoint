import React, { useCallback } from "react";
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
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import {
  NotificationsProvider,
  useNotifications,
} from "./src/context/NotificationsContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { typography } from "./src/theme/theme";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import DeskScreen from "./src/screens/DeskScreen";
import RoomReservationScreen from "./src/screens/RoomReservationScreen";
import LeaveRequestScreen from "./src/screens/LeaveRequestScreen";
import EventsScreen from "./src/screens/EventsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import PendingRoomReservationsScreen from "./src/screens/PendingRoomReservationsScreen";
import PendingLeaveRequestsScreen from "./src/screens/PendingLeaveRequestScreen";
import ManageAnnouncementsScreen from "./src/screens/hr/ManageAnnouncementsScreen";
import ManageEventsScreen from "./src/screens/hr/ManageEventsScreen";
import DepartmentChannelScreen from "./src/screens/DepartmentChannelScreen";
import ApprovalsScreen from "./src/screens/approvals/ApprovalsScreen";
import UserManagementScreen from "./src/screens/admin/UserManagementScreen";
import RoomManagementScreen from "./src/screens/admin/RoomManagementScreen";
import SeatManagementScreen from "./src/screens/admin/SeatManagementScreen";
import { DepartmentChannelProvider } from "./src/context/DepartmentChannelContext";
import { useDepartmentChannel } from "./src/context/DepartmentChannelContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HeaderActions() {
  const navigation = useNavigation();
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();

  return (
    <View style={styles.headerActions}>
      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={() => navigation.navigate("Notifications")}
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

function HomeTabs() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { channelUnreadCount, refreshChannelInfo } = useDepartmentChannel();

  useFocusEffect(
    useCallback(() => {
      refreshChannelInfo();
    }, [refreshChannelInfo]),
  );

  const isAdmin = user?.role === "Admin" || user?.role === 3;
  const isHR = user?.role === "HR" || user?.role === 4;

  const canReviewRequests = isAdmin || isHR;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <HeaderActions />,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case "Home":
              iconName = focused ? "home" : "home-outline";
              break;
            case "Channel":
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
              break;
            case "Approvals":
              iconName = focused
                ? "checkmark-circle"
                : "checkmark-circle-outline";
              break;
            default:
              iconName = "help-outline";
          }

          return (
            <View style={styles.tabIconWrapper}>
              <Ionicons name={iconName} size={size} color={color} />
              {route.name === "Channel" && channelUnreadCount > 0 ? (
                <View style={styles.tabDot} />
              ) : null}
            </View>
          );
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: typography.medium,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: typography.semibold,
          fontSize: typography.lg,
        },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ title: "Accueil" }}
      />

      <Tab.Screen
        name="Channel"
        component={DepartmentChannelScreen}
        options={{
          title: "Canal"
        }}
      />

      {canReviewRequests && (
        <Tab.Screen
          name="Approvals"
          component={ApprovalsScreen}
          options={{ title: "Approbations" }}
        />
      )}

      <Tab.Screen
        name="Desk"
        component={DeskScreen}
        options={{
          title: "Réservation Bureau",
          tabBarButton: () => null,
        }}
      />

      <Tab.Screen
        name="Rooms"
        component={RoomReservationScreen}
        options={{
          title: "Réservation Salle",
          tabBarButton: () => null,
        }}
      />

      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{
          title: "Événements",
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { colors, darkMode } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Chargement…
        </Text>
      </View>
    );
  }

  return (
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
      <Stack.Navigator>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen
              name="HomeTabs"
              component={HomeTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LeaveRequest"
              component={LeaveRequestScreen}
              options={{ title: "Demandes Congé" }}
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
              name="PendingRoomReservations"
              component={PendingRoomReservationsScreen}
              options={{ title: "Demandes Salles En Attente" }}
            />
            <Stack.Screen
              name="ManageAnnouncements"
              component={ManageAnnouncementsScreen}
              options={{ title: "Gérer Annonces" }}
            />
            <Stack.Screen
              name="ManageEvents"
              component={ManageEventsScreen}
              options={{ title: "Créer un événement" }}
            />
            <Stack.Screen
              name="PendingLeaveRequests"
              component={PendingLeaveRequestsScreen}
              options={{ title: "Demandes Congé En Attente" }}
            />
            <Stack.Screen
              name="UserManagement"
              component={UserManagementScreen}
              options={{ title: "Gestion des Utilisateurs" }}
            />
            <Stack.Screen
              name="RoomManagement"
              component={RoomManagementScreen}
              options={{ title: "Gestion des Salles" }}
            />
            <Stack.Screen
              name="SeatManagement"
              component={SeatManagementScreen}
              options={{ title: "Gestion des Sièges" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function RootApp() {
  const { colors, darkMode } = useTheme();

  return (
    <>
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: "#F4F6F8" }]}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootApp />
      </ThemeProvider>
    </SafeAreaProvider>
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
    borderColor: "#fff", // change if dark theme
  },
  headerIconButton: {
    marginLeft: 14,
    position: "relative",
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
