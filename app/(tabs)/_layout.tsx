import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser, isDoctor, isLabTech, isPharmacist, isBilling, isAdmin } from '../../src/context/UserContext';
import { colors, font } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size ?? 22} color={color} />
  );
}

export default function TabsLayout() {
  const { user } = useUser();
  const role = user?.role ?? '';

  const showConsultations = isDoctor(role) || isAdmin(role);
  const showPrescriptions = isDoctor(role) || isPharmacist(role) || isAdmin(role);
  const showLab = isLabTech(role) || isDoctor(role) || isAdmin(role);
  const showBilling = isBilling(role) || isAdmin(role);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontFamily: font.semibold },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', headerShown: false, tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="patients" options={{ title: 'Patients', tabBarIcon: tabIcon('people') }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="consultations" options={{ title: 'Consults', href: showConsultations ? undefined : null, tabBarIcon: tabIcon('medkit') }} />
      <Tabs.Screen name="prescriptions" options={{ title: 'Rx', href: showPrescriptions ? undefined : null, tabBarIcon: tabIcon('medical') }} />
      <Tabs.Screen name="lab" options={{ title: 'Lab', href: showLab ? undefined : null, tabBarIcon: tabIcon('flask') }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing', href: showBilling ? undefined : null, tabBarIcon: tabIcon('card') }} />
    </Tabs>
  );
}
