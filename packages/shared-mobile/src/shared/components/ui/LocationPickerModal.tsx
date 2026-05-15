/**
 * LocationPickerModal
 *
 * Mirrors CRM's GoogleMapPicker — user can either:
 *   1. Type a search query → Nominatim forward-geocoding results list
 *   2. Tap "Use Current Location" → GPS + Nominatim reverse geocoding
 *
 * No react-native-maps or WebView required.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PickedLocation {
  address: string;        // human-readable display address
  lat: number;
  lng: number;
  state?: string;
  district?: string;
  tehsil?: string;
  pinCode?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    state?: string;
    state_district?: string;
    district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    suburb?: string;
    road?: string;
    postcode?: string;
  };
}

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (loc: PickedLocation) => void;
  title?: string;
}

// ─── Nominatim helpers ────────────────────────────────────────────────────────
const NOMINATIM_HEADERS = {
  'Accept-Language': 'en',
  'User-Agent': 'BookMyWorker/1.0 (mobile)',
};

async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=in&addressdetails=1&limit=7`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error('Search failed');
  return (await res.json()) as NominatimResult[];
}

async function reverseNominatim(lat: number, lng: number): Promise<NominatimResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error('Reverse geocoding failed');
  return (await res.json()) as NominatimResult;
}

function toPickedLocation(r: NominatimResult): PickedLocation {
  const a = r.address ?? {};
  const localParts = [a.road, a.suburb, a.village ?? a.town ?? a.city].filter(Boolean);
  const dist = a.district ?? a.state_district ?? a.county ?? a.city ?? a.town ?? '';
  const state = a.state ?? '';
  const humanAddress = localParts.length
    ? `${localParts.join(', ')}, ${dist}, ${state}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',')
    : r.display_name.split(',').slice(0, 4).join(',').trim();
  return {
    address: humanAddress,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    state: state || undefined,
    district: dist || undefined,
    tehsil: undefined,
    pinCode: a.postcode || undefined,
  };
}

// ─── Main Modal ────────────────────────────────────────────────────────────────
export const LocationPickerModal = ({
  visible,
  onClose,
  onPick,
  title = 'Pick Location',
}: LocationPickerModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((text: string): void => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchNominatim(text.trim());
        setResults(data);
      } catch {
        // silently ignore network errors during search
      } finally {
        setSearching(false);
      }
    }, 500);
  }, []);

  const handleSelect = (result: NominatimResult): void => {
    const loc = toPickedLocation(result);
    onPick(loc);
    setQuery('');
    setResults([]);
    onClose();
  };

  const handleGPS = (): void => {
    if (!navigator.geolocation) {
      Alert.alert('Not available', 'Location services are not available on this device.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await reverseNominatim(pos.coords.latitude, pos.coords.longitude);
          handleSelect(result);
        } catch {
          const loc: PickedLocation = {
            address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          onPick(loc);
          onClose();
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        Alert.alert(
          'Location Error',
          err.code === 1
            ? 'Location permission denied. Please enable location access in Settings.'
            : 'Could not get your location. Please search manually.'
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handleClose = (): void => {
    setQuery('');
    setResults([]);
    onClose();
  };

  const shortAddress = (r: NominatimResult): string => {
    const parts = r.display_name.split(',');
    return parts.slice(0, 4).join(',').trim();
  };

  const subAddress = (r: NominatimResult): string => {
    const parts = r.display_name.split(',');
    return parts.slice(4, 7).join(',').trim();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <AppText variant="title" style={styles.headerTitle}>{title}</AppText>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <AppText style={[styles.closeBtn, { color: theme.colors.mutedText }]}>✕</AppText>
          </TouchableOpacity>
        </View>

        {/* ── GPS button ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleGPS}
          activeOpacity={0.8}
          disabled={gpsLoading}
          style={[styles.gpsBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '0E' }]}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <AppText style={styles.gpsIcon}>📍</AppText>
          )}
          <AppText style={[styles.gpsBtnText, { color: theme.colors.primary }]}>
            {gpsLoading ? 'Detecting your location…' : 'Use Current Location (GPS)'}
          </AppText>
        </TouchableOpacity>

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        <View style={[styles.searchWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
          <AppText style={styles.searchIcon}>🔍</AppText>
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search city, village, address…"
            placeholderTextColor={theme.colors.mutedText}
            style={[styles.searchInput, { color: theme.colors.text }]}
            autoFocus
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={theme.colors.mutedText} style={{ marginRight: 10 }} />}
          {query.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <AppText style={{ color: theme.colors.mutedText, paddingRight: 12, fontSize: 16 }}>✕</AppText>
            </TouchableOpacity>
          )}
        </View>

        <AppText variant="caption" color={theme.colors.mutedText} style={styles.hint}>
          {query.length < 3 && results.length === 0
            ? 'Type at least 3 characters to search for a location'
            : `${results.length} results found`}
        </AppText>

        {/* ── Results ────────────────────────────────────────────────────── */}
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.place_id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              activeOpacity={0.75}
              style={[styles.resultItem, { borderBottomColor: theme.colors.border }]}
            >
              <View style={[styles.resultPin, { backgroundColor: theme.colors.primary + '18' }]}>
                <AppText style={styles.resultPinIcon}>📍</AppText>
              </View>
              <View style={styles.resultText}>
                <AppText variant="body" color={theme.colors.text} style={styles.resultMain} numberOfLines={1}>
                  {shortAddress(item)}
                </AppText>
                {subAddress(item) ? (
                  <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1}>
                    {subAddress(item)}
                  </AppText>
                ) : null}
              </View>
              <AppText style={[styles.resultArrow, { color: theme.colors.mutedText }]}>›</AppText>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.length >= 3 && !searching ? (
              <View style={styles.emptyWrap}>
                <AppText style={styles.emptyIcon}>🗺</AppText>
                <AppText variant="body" color={theme.colors.mutedText} style={styles.emptyText}>
                  No results for "{query}"
                </AppText>
                <AppText variant="caption" color={theme.colors.mutedText}>
                  Try a different spelling or broader search term
                </AppText>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18 },
  closeBtn: { fontSize: 18, fontWeight: '600' },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  gpsIcon: { fontSize: 20 },
  gpsBtnText: { fontWeight: '600', fontSize: 14 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  searchIcon: { fontSize: 18, paddingLeft: 12 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15 },
  hint: { marginHorizontal: 20, marginTop: 8, marginBottom: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  resultPin: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  resultPinIcon: { fontSize: 18 },
  resultText: { flex: 1, gap: 2 },
  resultMain: { fontWeight: '600' },
  resultArrow: { fontSize: 20 },
  emptyWrap: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontWeight: '600' },
});
