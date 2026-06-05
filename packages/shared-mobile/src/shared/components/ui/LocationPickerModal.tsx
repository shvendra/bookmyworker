/**
 * LocationPickerModal
 *
 * Interactive map picker. The user can:
 *   1. Tap the map (Leaflet / OpenStreetMap in a WebView — no API key, no native
 *      maps dependency) to drop a pin, then drag it to fine-tune.
 *   2. Search by city / village / address (Nominatim forward geocoding) → the map
 *      recenters and the pin moves.
 *   3. Use GPS → the map recenters to the current position.
 * The pinned point is reverse-geocoded (Nominatim) into a human address +
 * state / district / pincode, shown in a confirm card.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { showAlert } from '../../state/alert/AppAlertContext';
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

// ─── Leaflet map (OpenStreetMap) inside a WebView — no API key required ─────────
const INDIA = { lat: 22.5937, lng: 78.9629, zoom: 4 };
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#eef2f7}
  .leaflet-control-attribution{font-size:9px}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var RN = window.ReactNativeWebView;
  function post(o){ if(RN) RN.postMessage(JSON.stringify(o)); }
  var map = L.map('map', { zoomControl: true, attributionControl: true })
    .setView([${INDIA.lat}, ${INDIA.lng}], ${INDIA.zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var marker = null;
  function place(latlng, fly){
    if(!marker){ marker = L.marker(latlng, { draggable: true }).addTo(map);
      marker.on('dragend', function(){ post({ type:'pin', lat: marker.getLatLng().lat, lng: marker.getLatLng().lng }); });
    } else { marker.setLatLng(latlng); }
    if(fly){ map.setView(latlng, Math.max(map.getZoom(), 15)); }
    post({ type:'pin', lat: latlng.lat, lng: latlng.lng });
  }
  map.on('click', function(e){ place(e.latlng, false); });
  // RN -> web bridge
  window.setLoc = function(lat, lng, zoom){ place(L.latLng(lat, lng), true); if(zoom) map.setView([lat,lng], zoom); };
  post({ type:'ready' });
</script>
</body>
</html>`;

// ─── Main Modal ────────────────────────────────────────────────────────────────
export const LocationPickerModal = ({
  visible,
  onClose,
  onPick,
  title,
}: LocationPickerModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [resolving, setResolving] = useState(false);

  const webRef = useRef<WebView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const moveMapTo = useCallback((lat: number, lng: number, zoom = 15): void => {
    webRef.current?.injectJavaScript(`window.setLoc && window.setLoc(${lat}, ${lng}, ${zoom}); true;`);
  }, []);

  // Reverse-geocode the pin (debounced) into a full address.
  const resolvePin = useCallback((lat: number, lng: number): void => {
    if (reverseRef.current) clearTimeout(reverseRef.current);
    setResolving(true);
    reverseRef.current = setTimeout(async () => {
      try {
        const r = await reverseNominatim(lat, lng);
        setPicked(toPickedLocation(r));
      } catch {
        setPicked({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
      } finally {
        setResolving(false);
      }
    }, 600);
  }, []);

  const onWebMessage = useCallback((e: WebViewMessageEvent): void => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { type: string; lat?: number; lng?: number };
      if (data.type === 'pin' && typeof data.lat === 'number' && typeof data.lng === 'number') {
        setPicked((prev) => (prev ? { ...prev, address: t('lp_locating'), lat: data.lat!, lng: data.lng! } : { address: t('lp_locating'), lat: data.lat!, lng: data.lng! }));
        resolvePin(data.lat, data.lng);
      }
    } catch {
      /* ignore malformed messages */
    }
  }, [resolvePin, t]);

  const handleQueryChange = useCallback((text: string): void => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchNominatim(text.trim()));
      } catch {
        /* silently ignore network errors during search */
      } finally {
        setSearching(false);
      }
    }, 500);
  }, []);

  // Picking a search result moves the pin — the user still confirms.
  const selectSearchResult = (result: NominatimResult): void => {
    const loc = toPickedLocation(result);
    setPicked(loc);
    setQuery('');
    setResults([]);
    moveMapTo(loc.lat, loc.lng, 15);
  };

  const handleGPS = async (): Promise<void> => {
    // React Native has no `navigator.geolocation` — use expo-location.
    setGpsLoading(true);
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setGpsLoading(false);
        showAlert(t('lp_gpsUnavailable'), t('lp_gpsServicesOff'));
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setGpsLoading(false);
        showAlert(t('lp_locErrorTitle'), t('lp_permDenied'));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      moveMapTo(latitude, longitude, 16);
      try {
        const r = await reverseNominatim(latitude, longitude);
        setPicked(toPickedLocation(r));
      } catch {
        setPicked({ address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, lat: latitude, lng: longitude });
      }
    } catch {
      showAlert(t('lp_locErrorTitle'), t('lp_locFailed'));
    } finally {
      setGpsLoading(false);
    }
  };

  const reset = (): void => {
    setQuery('');
    setResults([]);
    setPicked(null);
    setResolving(false);
  };

  const handleClose = (): void => { reset(); onClose(); };

  const handleConfirm = (): void => {
    if (!picked) return;
    onPick(picked);
    reset();
    onClose();
  };

  const c = theme.colors;
  const shortAddress = (r: NominatimResult): string => r.display_name.split(',').slice(0, 4).join(',').trim();
  const subAddress = (r: NominatimResult): string => r.display_name.split(',').slice(4, 7).join(',').trim();

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={handleClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 10 }]}>
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <AppText style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>{title ?? t('lp_title')}</AppText>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={[styles.closeBtn, { backgroundColor: c.surface1 }]}>
            <AppText style={[styles.closeTxt, { color: c.text }]}>✕</AppText>
          </TouchableOpacity>
        </View>

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        <View style={styles.searchZone}>
          <View style={[styles.searchWrap, { borderColor: c.border, backgroundColor: c.card }]}>
            <AppText style={styles.searchIcon}>🔍</AppText>
            <TextInput
              value={query}
              onChangeText={handleQueryChange}
              placeholder={t('lp_searchPlaceholder')}
              placeholderTextColor={c.mutedText}
              style={[styles.searchInput, { color: c.text }]}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={c.mutedText} style={{ marginRight: 10 }} />}
            {query.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={{ color: c.mutedText, paddingRight: 12, fontSize: 16 }}>✕</AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* Search results dropdown overlay */}
          {results.length > 0 && (
            <View style={[styles.resultsCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {results.slice(0, 6).map((item) => (
                <TouchableOpacity
                  key={String(item.place_id)}
                  onPress={() => selectSearchResult(item)}
                  activeOpacity={0.75}
                  style={[styles.resultItem, { borderBottomColor: c.border }]}
                >
                  <View style={[styles.resultPin, { backgroundColor: c.primary + '18' }]}>
                    <AppText style={{ fontSize: 15 }}>📍</AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={[styles.resultMain, { color: c.text }]} numberOfLines={1}>{shortAddress(item)}</AppText>
                    {!!subAddress(item) && <AppText style={[styles.resultSub, { color: c.mutedText }]} numberOfLines={1}>{subAddress(item)}</AppText>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {query.length >= 3 && !searching && results.length === 0 && (
            <View style={[styles.resultsCard, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 16, alignItems: 'center' }]}>
              <AppText style={[styles.resultSub, { color: c.mutedText }]}>{t('lp_noResults')}</AppText>
            </View>
          )}
        </View>

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <View style={styles.mapWrap}>
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html: MAP_HTML }}
            onMessage={onWebMessage}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            style={styles.map}
          />

          {/* Centered hint until a pin is dropped */}
          {!picked && (
            <View pointerEvents="none" style={styles.mapHintWrap}>
              <View style={[styles.mapHint, { backgroundColor: c.card }]}>
                <AppText style={[styles.mapHintTxt, { color: c.mutedText }]}>{t('lp_tapHint')}</AppText>
              </View>
            </View>
          )}

          {/* Floating GPS pill */}
          <TouchableOpacity
            onPress={handleGPS}
            disabled={gpsLoading}
            activeOpacity={0.85}
            style={[styles.gpsPill, { backgroundColor: c.card, borderColor: c.border }]}
          >
            {gpsLoading
              ? <ActivityIndicator size="small" color={c.primary} />
              : <AppText style={{ fontSize: 16 }}>📍</AppText>}
            <AppText style={[styles.gpsPillTxt, { color: c.primary }]}>
              {gpsLoading ? t('lp_detecting') : t('lp_useGps')}
            </AppText>
          </TouchableOpacity>
        </View>

        {/* ── Confirm card ───────────────────────────────────────────────── */}
        <View style={[styles.confirmCard, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: insets.bottom + 14 }]}>
          <AppText style={[styles.selLabel, { color: c.mutedText }]}>{t('lp_selectedLabel')}</AppText>
          <View style={styles.selRow}>
            <AppText style={{ fontSize: 18 }}>{picked ? '📌' : '🗺️'}</AppText>
            <View style={{ flex: 1 }}>
              {picked ? (
                <AppText style={[styles.selAddress, { color: c.text }]} numberOfLines={2}>
                  {resolving ? t('lp_locating') : picked.address}
                </AppText>
              ) : (
                <AppText style={[styles.selPlaceholder, { color: c.mutedText }]}>{t('lp_movePin')}</AppText>
              )}
            </View>
            {resolving && <ActivityIndicator size="small" color={c.mutedText} />}
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!picked || resolving}
            activeOpacity={0.9}
            style={[styles.confirmBtn, { backgroundColor: c.primary }, (!picked || resolving) && { opacity: 0.45 }]}
          >
            <AppText style={styles.confirmTxt}>{t('lp_confirm')}</AppText>
          </TouchableOpacity>
        </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Bottom-sheet presentation
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8, marginBottom: 4 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 15, fontWeight: '700' },

  searchZone: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, zIndex: 20 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  searchIcon: { fontSize: 16, paddingLeft: 14 },
  searchInput: { flex: 1, paddingVertical: 13, paddingHorizontal: 10, fontSize: 15 },

  resultsCard: {
    position: 'absolute', top: 60, left: 16, right: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', zIndex: 30,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultPin: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resultMain: { fontSize: 14, fontWeight: '700' },
  resultSub: { fontSize: 11.5, marginTop: 1 },

  mapWrap: { flex: 1, overflow: 'hidden' },
  map: { flex: 1 },
  mapHintWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mapHint: {
    borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18, maxWidth: '70%',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  mapHintTxt: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  gpsPill: {
    position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 5,
  },
  gpsPillTxt: { fontSize: 12.5, fontWeight: '800' },

  confirmCard: {
    paddingHorizontal: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
  selLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, minHeight: 40 },
  selAddress: { fontSize: 14.5, fontWeight: '700', lineHeight: 20 },
  selPlaceholder: { fontSize: 13.5, fontWeight: '500', lineHeight: 19 },
  confirmBtn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#1037A4', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  confirmTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
});
