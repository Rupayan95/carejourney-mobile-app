import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { UserProvider } from '../src/context/UserContext';
import { colors, font } from '../src/theme';

const queryClient = new QueryClient();

const headerScreen = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.white,
  headerTitleStyle: { fontFamily: font.semibold },
} as const;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="patient/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="create-appointment"
            options={{ title: 'New Appointment', ...headerScreen }}
          />
          <Stack.Screen name="live-consultation/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="consultation-review/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="consultation/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="register/methods" options={{ headerShown: false }} />
          <Stack.Screen name="register/manual" options={{ headerShown: false }} />
          <Stack.Screen name="register/live-intake" options={{ headerShown: false }} />
          <Stack.Screen name="register/doc-ocr" options={{ headerShown: false }} />
          <Stack.Screen name="create-invoice" options={{ headerShown: false }} />
          <Stack.Screen
            name="prescription/[id]"
            options={{ title: 'Prescription', ...headerScreen }}
          />
        </Stack>
      </UserProvider>
    </QueryClientProvider>
  );
}
