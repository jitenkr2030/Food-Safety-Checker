import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  AppState,
  Alert,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Navigation
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Store
import { store, persistor } from './src/store/store';
import { PersistGate } from 'redux-persist/integration/react';

// Services
import { AuthService } from './src/services/authService';
import { NotificationService } from './src/services/notificationService';
import { AnalyticsService } from './src/services/analyticsService';

// Screens
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AnalysisDetailScreen from './src/screens/AnalysisDetailScreen';
import CameraScreen from './src/screens/CameraScreen';
import UploadScreen from './src/screens/UploadScreen';

// Components
import LoadingScreen from './src/components/LoadingScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Colors } from './src/constants';

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Custom query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Load fonts
      await Font.loadAsync({
        'Inter-Regular': require('./src/assets/fonts/Inter-Regular.ttf'),
        'Inter-Medium': require('./src/assets/fonts/Inter-Medium.ttf'),
        'Inter-SemiBold': require('./src/assets/fonts/Inter-SemiBold.ttf'),
        'Inter-Bold': require('./src/assets/fonts/Inter-Bold.ttf'),
      });

      // Check if it's the first launch
      const hasLaunched = await AsyncStorage.getItem('hasLaunched');
      if (hasLaunched === null) {
        setIsFirstLaunch(true);
        await AsyncStorage.setItem('hasLaunched', 'true');
      } else {
        setIsFirstLaunch(false);
      }

      // Initialize services
      await initializeServices();

      // Check authentication
      await checkAuthentication();

      // Setup notification listeners
      setupNotificationListeners();

      // Setup analytics
      AnalyticsService.initialize();

      setIsLoading(false);
      SplashScreen.hideAsync();
    } catch (error) {
      console.error('App initialization error:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please restart.',
        [{ text: 'OK', onPress: () => SplashScreen.hideAsync() }]
      );
    }
  };

  const initializeServices = async () => {
    // Initialize authentication service
    AuthService.initialize();

    // Initialize notification service
    NotificationService.initialize();

    // Setup app state change listener
    AppState.addEventListener('change', handleAppStateChange);
  };

  const checkAuthentication = async () => {
    try {
      const token = await AuthService.getStoredToken();
      if (token) {
        // Verify token with backend
        const isValid = await AuthService.verifyToken();
        setIsAuthenticated(isValid);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    }
  };

  const setupNotificationListeners = async () => {
    // Register for push notifications
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications to receive important food safety alerts.'
        );
        return;
      }

      const expoPushToken = await Notifications.getExpoPushTokenAsync();
      await AuthService.updatePushToken(expoPushToken.data);
    }

    // Handle notification received
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      AnalyticsService.trackEvent('notification_received', {
        notification_type: notification.request.content.data?.type,
      });
    });

    // Handle notification response
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      const { type, analysisId } = response.notification.request.content.data || {};

      switch (type) {
        case 'analysis_complete':
          // Navigate to analysis detail
          break;
        case 'safety_alert':
          // Show alert or navigate
          break;
        default:
          break;
      }

      AnalyticsService.trackEvent('notification_opened', {
        notification_type: type,
      });
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  };

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      // App became active
      AnalyticsService.trackEvent('app_opened');
    } else if (nextAppState === 'background') {
      // App went to background
      AnalyticsService.trackEvent('app_closed');
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={<LoadingScreen />} persistor={persistor}>
          <QueryClientProvider client={queryClient}>
            <NavigationContainer>
              <SafeAreaView style={styles.container}>
                <StatusBar 
                  barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
                  backgroundColor={Colors.primary}
                />
                
                {isAuthenticated ? (
                  <AppNavigator />
                ) : (
                  <AuthNavigator isFirstLaunch={isFirstLaunch} />
                )}
              </SafeAreaView>
            </NavigationContainer>
          </QueryClientProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

// Main app navigator with bottom tabs
function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: 'black' }
        }}
      />
      <Stack.Screen 
        name="Upload" 
        component={UploadScreen}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: 'black' }
        }}
      />
      <Stack.Screen 
        name="AnalysisDetail" 
        component={AnalysisDetailScreen}
        options={{
          headerTitle: 'Analysis Details',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
        }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          headerTitle: 'Settings',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
        }}
      />
    </Stack.Navigator>
  );
}

// Authentication navigator
function AuthNavigator({ isFirstLaunch }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="Auth" 
        component={AuthScreen}
        initialParams={{ isFirstLaunch }}
      />
    </Stack.Navigator>
  );
}

// Main tab navigator
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Analysis':
              iconName = focused ? 'analytics' : 'analytics-outline';
              break;
            case 'History':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return (
            <Ionicons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.lightGray,
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: Colors.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.lightGray,
        },
        headerTintColor: Colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Home',
          headerTitle: 'FoodSafe AI',
        }}
      />
      <Tab.Screen 
        name="Analysis" 
        component={AnalysisScreen}
        options={{
          title: 'Analyze',
          headerTitle: 'Food Analysis',
        }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen}
        options={{
          title: 'History',
          headerTitle: 'Analysis History',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
        }}
      />
    </Tab.Navigator>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

export default App;