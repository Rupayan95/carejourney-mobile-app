import { useState } from 'react';
import { View, Image, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../../src/lib/api';
import { colors, spacing, radius, font, shadow } from '../../src/theme';
import { AppText, Button, Icon, ScreenHeader } from '../../src/components/ui';

interface PickedFile { uri: string; name: string; type: string; isImage: boolean }

export default function DocOcrScreen() {
  const router = useRouter();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickPdf() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setFile({ uri: a.uri, name: a.name ?? 'document.pdf', type: a.mimeType ?? 'application/pdf', isImage: false });
    }
  }

  async function pickImage(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', `Allow ${source} access.`); return; }
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setFile({ uri: a.uri, name: a.fileName ?? 'scan.jpg', type: a.mimeType ?? 'image/jpeg', isImage: true });
    }
  }

  async function extract() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
      const res = await api.post('/documents/quick-extract', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });
      router.replace({ pathname: '/register/manual', params: { prefill: JSON.stringify(res.data.data) } });
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Extraction failed', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? e?.message ?? 'Could not read the document.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Document & OCR" subtitle="Extract from a PDF or scan" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {file ? (
          <View style={styles.previewWrap}>
            {file.isImage ? (
              <Image source={{ uri: file.uri }} style={styles.preview} resizeMode="contain" />
            ) : (
              <View style={styles.pdfPreview}>
                <Icon name="document-text" size={48} color={colors.danger} />
                <AppText style={styles.pdfName} numberOfLines={2}>{file.name}</AppText>
                <AppText style={styles.pdfTag}>PDF document</AppText>
              </View>
            )}
            <TouchableOpacity style={styles.clearBtn} onPress={() => setFile(null)} hitSlop={8}>
              <Icon name="close-circle" size={26} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dropZone}>
            <Icon name="document-attach-outline" size={40} color={colors.inkFaint} />
            <AppText style={styles.dropText}>No document selected</AppText>
            <AppText style={styles.dropHint}>Choose a PDF of the patient registration form, or scan a photo. PDF / JPEG / PNG.</AppText>
          </View>
        )}

        {/* PDF is the primary path */}
        <Button label="Choose PDF" icon="document-outline" onPress={pickPdf} style={{ marginTop: spacing.lg }} />
        <View style={styles.pickRow}>
          <Button label="Camera" icon="camera-outline" variant="outline" fullWidth={false} onPress={() => pickImage('camera')} style={{ flex: 1 }} />
          <Button label="Gallery" icon="image-outline" variant="outline" fullWidth={false} onPress={() => pickImage('library')} style={{ flex: 1 }} />
        </View>

        <Button
          label={busy ? 'Reading document…' : 'Extract & Continue'}
          icon={busy ? undefined : 'scan-outline'}
          onPress={extract}
          loading={busy}
          disabled={!file}
          style={{ marginTop: spacing.md }}
        />

        <AppText style={styles.note}>
          AI reads the document and opens the registration form pre-filled for your review — always verify the extracted details before saving.
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    alignItems: 'center', gap: spacing.sm, paddingVertical: 48,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  dropText: { fontFamily: font.semibold, fontSize: 15, color: colors.inkSoft },
  dropHint: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, textAlign: 'center', paddingHorizontal: spacing.xl },
  previewWrap: { position: 'relative', ...shadow.card },
  preview: { width: '100%', height: 320, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  pdfPreview: {
    height: 200, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg,
  },
  pdfName: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, textAlign: 'center' },
  pdfTag: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint },
  clearBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.white, borderRadius: 14 },
  pickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  note: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, lineHeight: 18, marginTop: spacing.lg },
});
