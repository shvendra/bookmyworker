import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../../state/auth/AuthContext';
import { updateProfile } from '../../../core/api/endpoints/authApi';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { useAppTheme } from '../../../core/theme';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'EditProfile'>;

const editProfileSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  bankName: z.string().optional(),
  oldPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Min 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional(),
}).refine((d) => {
  if (d.newPassword && d.newPassword !== d.confirmPassword) return false;
  return true;
}, { message: 'Passwords do not match', path: ['confirmPassword'] });

type EditProfileValues = z.infer<typeof editProfileSchema>;

export const EditProfileScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state, updateProfile: updateAuthProfile } = useAuth();
  const user = state.session?.user;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [stateVal, setStateVal] = useState(user?.state ?? '');
  const [districtVal, setDistrictVal] = useState(user?.district ?? '');
  const [blockVal, setBlockVal] = useState('');

  const { control, handleSubmit } = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: user?.fullName ?? '',
      email: user?.email ?? '',
      address: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const pickPhoto = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library permission is required.'); return; }
    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } finally { setPhotoLoading(false); }
  };

  const takePhoto = async (): Promise<void> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Camera permission is required.'); return; }
    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } finally { setPhotoLoading(false); }
  };

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', values.name);
      if (values.email) formData.append('email', values.email);
      if (stateVal) formData.append('state', stateVal);
      if (districtVal) formData.append('district', districtVal);
      if (blockVal) formData.append('block', blockVal);
      if (values.address) formData.append('address', values.address);
      if (values.accountNumber) formData.append('accountNumber', values.accountNumber);
      if (values.ifscCode) formData.append('ifscCode', values.ifscCode);
      if (values.bankName) formData.append('bankName', values.bankName);
      if (values.oldPassword && values.newPassword) {
        formData.append('oldPassword', values.oldPassword);
        formData.append('newPassword', values.newPassword);
      }
      if (photoUri) {
        const filename = photoUri.split('/').pop() ?? 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        formData.append('profilePhoto', { uri: photoUri, name: filename, type: match ? `image/${match[1]}` : 'image/jpeg' } as unknown as Blob);
      }
      const updatedUser = await updateProfile(formData);
      await updateAuthProfile({
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        state: updatedUser.state,
        district: updatedUser.district,
        profileImage: updatedUser.profileImage,
      });
      Alert.alert('Success', 'Profile updated successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  });

  const currentPhotoUri = photoUri ?? user?.profileImage;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="title">Edit Profile</AppText>
      <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
        Update your personal information
      </AppText>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        {currentPhotoUri ? (
          <Image source={{ uri: currentPhotoUri }} style={styles.avatar} />
        ) : (
          <Avatar name={user?.fullName ?? 'User'} size={88} />
        )}
        {photoLoading && (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
        <View style={styles.photoButtons}>
          <TouchableOpacity onPress={pickPhoto} style={[styles.photoBtn, { backgroundColor: theme.colors.primary }]}>
            <AppText variant="caption" color="#fff">📷 Gallery</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={takePhoto} style={[styles.photoBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
            <AppText variant="caption" color={theme.colors.text}>📸 Camera</AppText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Read-only */}
      <View style={[styles.readOnlyRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <AppText variant="caption" color={theme.colors.mutedText}>Mobile Number</AppText>
        <AppText variant="body">+91 {user?.phone}</AppText>
      </View>
      <View style={[styles.readOnlyRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <AppText variant="caption" color={theme.colors.mutedText}>Role</AppText>
        <AppText variant="body" style={styles.capitalize}>{user?.role}</AppText>
      </View>

      {/* BASIC INFO */}
      <SectionLabel label="BASIC INFO" theme={theme} />
      <FormInput control={control} name="name" label="Full Name *" placeholder="Your full name" />
      <FormInput control={control} name="email" label="Email Address" placeholder="example@email.com" keyboardType="email-address" />
      <FormInput control={control} name="address" label="Village / Town / Address" placeholder="Your local address" />

      {/* LOCATION */}
      <SectionLabel label="LOCATION" theme={theme} />
      <LocationSelector
        state={stateVal}
        district={districtVal}
        block={blockVal}
        onStateChange={(v) => { setStateVal(v); setDistrictVal(''); setBlockVal(''); }}
        onDistrictChange={(v) => { setDistrictVal(v); setBlockVal(''); }}
        onBlockChange={setBlockVal}
        required={false}
        blockLabel="Block / Tehsil"
      />

      {/* CHANGE PASSWORD */}
      <SectionLabel label="CHANGE PASSWORD" theme={theme} />
      <AppCard style={styles.card}>
        <AppText variant="caption" color={theme.colors.mutedText} style={styles.cardHint}>
          Leave blank to keep your current password.
        </AppText>
        <FormInput control={control} name="oldPassword" label="Current Password" placeholder="Enter current password" secureTextEntry />
        <FormInput control={control} name="newPassword" label="New Password" placeholder="Min 6 characters" secureTextEntry />
        <FormInput control={control} name="confirmPassword" label="Confirm New Password" placeholder="Re-enter new password" secureTextEntry />
      </AppCard>

      {error ? (
        <AppText variant="caption" color={theme.colors.danger} style={styles.error}>{error}</AppText>
      ) : null}

      <AppButton title="Save Changes" onPress={onSubmit} loading={loading} style={styles.saveBtn} />
    </ScrollView>
    </View>
  );
};

const SectionLabel = ({ label, theme }: { label: string; theme: ReturnType<typeof useAppTheme>['theme'] }): React.JSX.Element => (
  <AppText variant="label" style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>{label}</AppText>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  subtitle: { marginTop: 4, marginBottom: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarOverlay: {
    position: 'absolute', top: 0, width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  photoButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  photoBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  readOnlyRow: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, gap: 2,
  },
  sectionLabel: {
    marginTop: 20, marginBottom: 8,
    textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8, fontWeight: '700',
  },
  card: { marginBottom: 4 },
  cardHint: { marginBottom: 12 },
  capitalize: { textTransform: 'capitalize' },
  error: { marginTop: 8 },
  saveBtn: { marginTop: 20 },
});
