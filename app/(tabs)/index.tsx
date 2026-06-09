import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type CaptureRow = {
  id: number;
  image_path: string;
  image_url: string;
  latitude: number;
  longitude: number;
  captured_at: string;
};

const Index = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [captures, setCaptures] = useState<CaptureRow[]>([]);

  useEffect(() => {
    void loadCaptures();
  }, []);

  const loadCaptures = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('camera_captures')
        .select('id, image_path, image_url, latitude, longitude, captured_at')
        .order('captured_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      setCaptures(data ?? []);
    } catch (error: any) {
      Alert.alert(
        'Gagal Memuat Data',
        error?.message ??
          'Data capture dari Supabase tidak bisa dimuat. Periksa nama tabel dan policy.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const captureAndSave = async () => {
    try {
      setIsSaving(true);

      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        throw new Error('Izin kamera wajib diberikan.');
      }

      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (!locationPermission.granted) {
        throw new Error('Izin lokasi wajib diberikan.');
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled) {
        return;
      }

      const uri = result.assets[0]?.uri;
      if (!uri) {
        throw new Error('File foto tidak ditemukan.');
      }

      const locationResult = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const coords = locationResult.coords;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      const arrayBuffer = decode(base64);

      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL from Supabase storage.');
      }

      const { error: insertError } = await supabase.from('camera_captures').insert([
        {
          image_path: fileName,
          image_url: publicUrlData.publicUrl,
          latitude: coords.latitude,
          longitude: coords.longitude,
          captured_at: new Date().toISOString(),
        },
      ]);
      if (insertError) throw insertError;

      setPhotoUri(uri);
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });
      await loadCaptures();
      Alert.alert('Sukses', `Foto tersimpan dengan lokasi ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}.`);
    } catch (error: any) {
      Alert.alert('Gagal', error?.message ?? 'Terjadi kesalahan saat menyimpan foto.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={captures}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadCaptures} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Camera Capture to Supabase</Text>
            <Text style={styles.description}>
              Ambil foto, simpan ke Supabase Storage, lalu catat latitude dan longitude ke tabel `camera_captures`.
            </Text>

            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.preview} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Belum ada foto baru pada sesi ini</Text>
              </View>
            )}

            {location ? (
              <View style={styles.locationCard}>
                <Text style={styles.locationLabel}>Lokasi terakhir</Text>
                <Text style={styles.locationText}>
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.button, isSaving && styles.buttonDisabled]}
              onPress={captureAndSave}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Ambil Foto dan Simpan</Text>
              )}
            </Pressable>

            <Text style={styles.sectionTitle}>Riwayat Capture Terbaru</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.captureCard}>
            <Image source={{ uri: item.image_url }} style={styles.captureImage} />
            <View style={styles.captureMeta}>
              <Text style={styles.captureTime}>
                {new Date(item.captured_at).toLocaleString('id-ID')}
              </Text>
              <Text style={styles.captureCoords}>
                {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
              </Text>
              <Text numberOfLines={1} style={styles.capturePath}>
                {item.image_path}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color="#0f766e" style={styles.loader} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Belum ada data</Text>
              <Text style={styles.emptyText}>
                Pastikan bucket `photos`, tabel `camera_captures`, dan policy Supabase sudah dibuat.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

export default Index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f8f7',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    marginBottom: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
    color: '#475569',
    lineHeight: 24,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    marginBottom: 16,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: '#dbe7e4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    padding: 24,
  },
  placeholderText: {
    color: '#51646a',
    fontSize: 16,
    textAlign: 'center',
  },
  locationCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#dff4ef',
  },
  locationLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: '#0f766e',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#134e4a',
  },
  loader: {
    marginTop: 24,
  },
  button: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  captureCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  captureImage: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  captureMeta: {
    flex: 1,
  },
  captureTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  captureCoords: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 6,
  },
  capturePath: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
  },
});
