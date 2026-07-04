import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createHotel,
  createReport,
  filterHotels,
  getHotelWithReports,
  listHotelsWithReports,
  normalizeSearchText
} from './lib/api.js';
import { calculateBaconStatus, formatDate, todayISO } from './lib/status.js';
import { compressImage, blobToDataUrl } from './lib/image.js';
import { uploadReportPhoto } from './lib/r2.js';
import { getScoutId } from './lib/scout.js';

const LazyBaconMap = lazy(() => import('./MapViews.jsx').then((module) => ({ default: module.BaconMap })));
const LazyPinPicker = lazy(() => import('./MapViews.jsx').then((module) => ({ default: module.PinPicker })));

const screens = {
  home: 'home',
  search: 'search',
  add: 'add',
  report: 'report',
  detail: 'detail',
  map: 'map',
  you: 'you'
};

const statusFilters = [
  { key: 'all', label: 'All' },
  { key: 'bacon_confirmed', label: '🥓 Confirmed' },
  { key: 'contested', label: '⚠️ Contested' },
  { key: 'no_bacon_reported', label: '🌵 No bacon' },
  { key: 'unscouted', label: '🕵️ Unscouted' }
];

function matchesStatusFilter(hotel, filterKey) {
  if (filterKey === 'all') return true;

  const statusKey = calculateBaconStatus(hotel.reports).key;
  if (filterKey === 'contested') return statusKey === 'contested' || statusKey === 'uncertain';
  return statusKey === filterKey;
}

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 300000
};
const HOTEL_SEARCH_LIMIT = 6;

function toUserLocation(position) {
  return {
    latitude: Number(position.coords.latitude.toFixed(6)),
    longitude: Number(position.coords.longitude.toFixed(6))
  };
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toUserLocation(position)),
      reject,
      GEOLOCATION_OPTIONS
    );
  });
}

async function getLocationIfAllowed() {
  if (!navigator.geolocation || !navigator.permissions) return null;

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state !== 'granted') return null;
    return await getCurrentLocation();
  } catch {
    return null;
  }
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceBetweenKm(pointA, pointB) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(pointB.latitude - pointA.latitude);
  const lonDelta = toRadians(pointB.longitude - pointA.longitude);
  const latA = toRadians(pointA.latitude);
  const latB = toRadians(pointB.latitude);
  const angle = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
}

function formatDistance(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function moreCompleteHotel(hotel, override) {
  if (!hotel) return override || null;
  if (!override) return hotel;
  const hotelReportCount = hotel.reports?.length || 0;
  const overrideReportCount = override.reports?.length || 0;
  return overrideReportCount >= hotelReportCount ? override : hotel;
}

function firstValue(...values) {
  return values.find((value) => String(value || '').trim()) || '';
}

function formatAddressLine(address = {}) {
  const road = firstValue(address.road, address.pedestrian, address.footway, address.street);
  const houseNumber = String(address.house_number || '').trim();
  if (road && houseNumber) return `${road} ${houseNumber}`;
  return firstValue(road, address.neighbourhood, address.suburb, address.city_district);
}

function placeCity(address = {}) {
  return firstValue(address.city, address.town, address.village, address.municipality, address.county, address.state);
}

function placeName(place) {
  const address = place.address || {};
  return firstValue(
    place.namedetails?.name,
    place.namedetails?.['name:en'],
    place.name,
    address.hotel,
    address.tourism,
    address.amenity,
    String(place.display_name || '').split(',')[0]
  );
}

function toHotelPlace(place) {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = place.address || {};
  const name = placeName(place);
  if (!name) return null;

  return {
    id: String(place.place_id || `${latitude},${longitude}`),
    name,
    address: formatAddressLine(address),
    city: placeCity(address),
    country: firstValue(address.country),
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    displayName: place.display_name || [name, placeCity(address), address.country].filter(Boolean).join(', '),
    type: firstValue(place.type, place.category, place.class)
  };
}

async function searchHotelsOnMap(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    addressdetails: '1',
    namedetails: '1',
    extratags: '1',
    dedupe: '1',
    limit: String(HOTEL_SEARCH_LIMIT)
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) throw new Error('Could not search the map.');

  const data = await response.json();
  return data.map(toHotelPlace).filter(Boolean);
}

function useHotels(refreshKey) {
  const [hotels, setHotels] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listHotelsWithReports()
      .then((data) => {
        if (active) {
          setHotels(data);
          setError('');
        }
      })
      .catch((error) => {
        if (active) setError(error.message || 'Could not load bacon data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  return { hotels, error, loading };
}

function App() {
  const [screen, setScreen] = useState(screens.home);
  const [selectedHotelId, setSelectedHotelId] = useState(null);
  const [hotelOverrides, setHotelOverrides] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const { hotels, error, loading } = useHotels(refreshKey);

  useEffect(() => {
    if (!window.history.state?.screen) {
      window.history.replaceState({ screen: screens.home, hotelId: null }, '');
    }

    function handlePopState(event) {
      const state = event.state || { screen: screens.home, hotelId: null };
      setSelectedHotelId(state.hotelId || null);
      setScreen(state.screen || screens.home);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function go(next, hotelId) {
    setSelectedHotelId(hotelId || null);
    setScreen(next);
    window.history.pushState({ screen: next, hotelId: hotelId || null }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  const rememberHotel = useCallback((hotel) => {
    if (!hotel?.id) return;
    setHotelOverrides((current) => (
      current[hotel.id] === hotel ? current : { ...current, [hotel.id]: hotel }
    ));
  }, []);

  const selectedHotel = selectedHotelId
    ? moreCompleteHotel(
      hotels.find((hotel) => hotel.id === selectedHotelId),
      hotelOverrides[selectedHotelId]
    )
    : null;

  return (
    <div className="app-shell">
      <main className="app-column">
        <section className="app-content">
          {screen === screens.home && <Home hotels={hotels} error={error} loading={loading} go={go} />}
          {screen === screens.search && <Search hotels={hotels} error={error} loading={loading} go={go} />}
          {screen === screens.add && <AddHotel hotels={hotels} go={go} refresh={refresh} />}
          {screen === screens.report && <Report hotel={selectedHotel} hotelId={selectedHotelId} go={go} refresh={refresh} rememberHotel={rememberHotel} />}
          {screen === screens.detail && <HotelDetail hotel={selectedHotel} hotelId={selectedHotelId} go={go} rememberHotel={rememberHotel} />}
          {screen === screens.map && (
            <Suspense fallback={<MapLoading />}>
              <LazyBaconMap
                hotels={hotels}
                go={go}
                screens={screens}
                statusFilters={statusFilters}
                matchesStatusFilter={matchesStatusFilter}
                getLocationIfAllowed={getLocationIfAllowed}
              />
            </Suspense>
          )}
          {screen === screens.you && <You go={go} />}
        </section>

        <nav className="bottom-nav" aria-label="Main navigation">
          <button className={screen === screens.home ? 'nav-item active' : 'nav-item'} onClick={() => go(screens.home)}><span>⌂</span><small>Home</small></button>
          <button className={screen === screens.search ? 'nav-item active' : 'nav-item'} onClick={() => go(screens.search)}><span>⌕</span><small>Search</small></button>
          <button className="nav-scout" onClick={() => go(screens.add)} aria-label="Add hotel">🥓</button>
          <button className={screen === screens.map ? 'nav-item active' : 'nav-item'} onClick={() => go(screens.map)}><span>⌖</span><small>Map</small></button>
          <button className={screen === screens.you ? 'nav-item active' : 'nav-item'} onClick={() => go(screens.you)}><span>◡</span><small>You</small></button>
        </nav>
      </main>
    </div>
  );
}

function MapLoading({ compact = false }) {
  return (
    <div className={compact ? 'pin-picker-frame map-loading' : 'map-screen map-loading'}>
      Loading map...
    </div>
  );
}

function Home({ hotels, error, loading, go }) {
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationMessage, setLocationMessage] = useState('');

  const stats = useMemo(() => {
    if (loading) return { reportCount: '...', percent: '...' };

    const reportCount = hotels.reduce((sum, hotel) => sum + hotel.reports.length, 0);
    const confirmed = hotels.filter((hotel) => calculateBaconStatus(hotel.reports).key === 'bacon_confirmed').length;
    const percent = hotels.length ? Math.round((confirmed / hotels.length) * 100) : 0;
    return {
      reportCount: reportCount.toLocaleString('en-US'),
      percent: `${percent}%`
    };
  }, [hotels, loading]);

  const visible = useMemo(() => {
    if (!userLocation) return hotels.slice(0, 3).map((hotel) => ({ hotel, distanceKm: null }));

    return hotels
      .map((hotel) => {
        const latitude = Number(hotel.latitude);
        const longitude = Number(hotel.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        return {
          hotel,
          distanceKm: distanceBetweenKm(userLocation, { latitude, longitude })
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [hotels, userLocation]);

  useEffect(() => {
    let active = true;

    getLocationIfAllowed()
      .then((location) => {
        if (!active || !location) return;
        setUserLocation(location);
        setLocationStatus('ready');
        setLocationMessage('Showing hotels closest to you.');
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  function useLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage('Location is not available on this device.');
      return;
    }

    setLocationStatus('loading');
    setLocationMessage('Checking your location...');
    getCurrentLocation()
      .then((location) => {
        setUserLocation(location);
        setLocationStatus('ready');
        setLocationMessage('Showing hotels closest to you.');
      })
      .catch((locationError) => {
        setLocationStatus('error');
        setLocationMessage(locationError.code === 1
          ? 'Location permission was not allowed.'
          : 'Could not get your location.');
      });
  }

  return (
    <>
      <TopBrand go={go} />

      <button className="search-pill search-hero-pill" onClick={() => go(screens.search)}>
        <span>⌕</span>
        <span>Search any hotel…</span>
      </button>

      <section className="hero-card">
        <p className="hero-kicker">Today's mission</p>
        <h1>Scout breakfast before you book.</h1>
        <div className="actions hero-actions">
          <button className="button inverted" onClick={() => go(screens.add)}>Add hotel manually</button>
          <button className="button subtle-inverted" onClick={() => go(screens.search)}>Search hotel</button>
        </div>
      </section>

      <div className="stat-strip">
        <div className="stat-card">
          <div className="stat-number">{stats.reportCount}</div>
          <div className="stat-label">breakfasts scouted</div>
        </div>
        <div className="stat-card">
          <div className="stat-number accent">{stats.percent}</div>
          <div className="stat-label">had the bacon</div>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="section-row">
        <div className="section-title-group">
          <h3>Near you</h3>
          {locationMessage && <p>{locationMessage}</p>}
        </div>
        <div className="section-actions">
          <button className="section-link" onClick={useLocation} disabled={locationStatus === 'loading'}>
            {locationStatus === 'loading' ? 'Locating...' : (userLocation ? 'Refresh' : 'Use location')}
          </button>
          <button className="section-link" onClick={() => go(screens.search)}>See all</button>
        </div>
      </div>

      <div className="tight-stack">
        {loading ? (
          <div className="notice">
            <strong>Loading breakfast intel...</strong>
            <p className="muted small">Fetching the latest hotel reports.</p>
          </div>
        ) : visible.length ? visible.map(({ hotel, distanceKm }) => (
          <HotelCard key={hotel.id} hotel={hotel} go={go} distanceKm={distanceKm} />
        )) : (
          <div className="notice">
            <strong>Uncharted bacon territory.</strong>
            <p className="muted small">Add the first breakfast target yourself.</p>
            <div className="actions">
              <button className="button" onClick={() => go(screens.add)}>Add hotel</button>
            </div>
          </div>
        )}

        <button className="add-manual-card" onClick={() => go(screens.add)}>
          <span className="add-manual-icon">+</span>
          <span><strong>Can't find your hotel?</strong><br /><span className="muted small">Add it manually and start the bacon trail.</span></span>
        </button>
      </div>
    </>
  );
}

function TopBrand({ go }) {
  return (
    <div className="top-bar">
      <div className="brand-mini">
        <span className="brand-dot">🥓</span>
        <div>
          <div className="brand-title">Do They Have Bacon?</div>
          <div className="brand-sub">📍 Global bacon scouts</div>
        </div>
      </div>
      <button className="round-icon" onClick={() => go(screens.you)} aria-label="Open profile">👤</button>
    </div>
  );
}

function HotelCard({ hotel, go, distanceKm = null }) {
  const summary = calculateBaconStatus(hotel.reports);
  const distance = formatDistance(distanceKm);

  return (
    <button className="card hotel-card" onClick={() => go(screens.detail, hotel.id)}>
      <span className="hotel-thumb">🏨</span>
      <span className="hotel-main">
        <span className="hotel-title">{hotel.name}</span>
        <span className="hotel-meta">{hotel.city}, {hotel.country}{distance ? ` · ${distance}` : ''}</span>
        <span className={`status-badge ${summary.key}`}>{summary.emoji} {summary.label}</span>
      </span>
      <span className="chevron">›</span>
    </button>
  );
}

function Search({ hotels, error, loading, go }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const results = useMemo(() => (
    filterHotels(hotels, query).filter((hotel) => matchesStatusFilter(hotel, statusFilter))
  ), [hotels, query, statusFilter]);

  const message = useMemo(() => {
    if (loading) return 'Loading hotels...';
    if (error) return error;
    if (query.trim() || statusFilter !== 'all') {
      return results.length ? `${results.length} hotels found` : 'No hotels match your filters.';
    }
    return hotels.length ? `${hotels.length} hotels available` : 'No hotels found yet.';
  }, [error, hotels.length, loading, query, results.length, statusFilter]);

  function submit(event) {
    event.preventDefault();
  }

  return (
    <>
      <ContextHeader title="Find a hotel" onBack={() => go(screens.home)} />
      <form className="tight-stack search-card" onSubmit={submit}>
        <label className="search-pill">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search any hotel…" autoComplete="off" />
        </label>
        <div className="chips">
          {statusFilters.map((filter) => (
            <button
              className={statusFilter === filter.key ? 'chip active' : 'chip'}
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </form>

      <p className="results-label">{message}</p>

      <div className="tight-stack">
        {results.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} go={go} />)}
        <button className="add-manual-card" onClick={() => go(screens.add)}>
          <span className="add-manual-icon">+</span>
          <span><strong>Can't find it?</strong><br /><span className="muted small">Add the hotel manually</span></span>
        </button>
      </div>
    </>
  );
}

function findDuplicateHotel(hotels, form) {
  const name = normalizeSearchText(form.name);
  const city = normalizeSearchText(form.city);
  const country = normalizeSearchText(form.country);
  const address = normalizeSearchText(form.address);

  if (!name || !city || !country) return null;

  return hotels.find((hotel) => {
    const existingAddress = normalizeSearchText(hotel.address);
    const sameIdentity = normalizeSearchText(hotel.name) === name
      && normalizeSearchText(hotel.city) === city
      && normalizeSearchText(hotel.country) === country;
    const sameOrUnknownAddress = !address || !existingAddress || existingAddress === address;
    return sameIdentity && sameOrUnknownAddress;
  }) || null;
}

function AddHotel({ hotels = [], go, refresh }) {
  const [form, setForm] = useState({
    name: '',
    city: '',
    country: '',
    address: '',
    latitude: 59.9139,
    longitude: 10.7522,
    source: 'manual'
  });
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeSearchStatus, setPlaceSearchStatus] = useState('idle');
  const [placeMessage, setPlaceMessage] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [duplicateHotel, setDuplicateHotel] = useState(null);

  function update(key, value) {
    setDuplicateHotel(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function searchForHotel() {
    const query = placeQuery.trim();
    if (query.length < 2) {
      setPlaceResults([]);
      setPlaceMessage('Type at least two characters to search the map.');
      return;
    }

    setError('');
    setPlaceSearchStatus('loading');
    setPlaceMessage('Searching the map...');

    try {
      const results = await searchHotelsOnMap(query);
      setPlaceResults(results);
      setPlaceMessage(results.length ? `${results.length} map matches found.` : 'No map matches found.');
    } catch (searchError) {
      setPlaceResults([]);
      setPlaceMessage('');
      setError(searchError.message || 'Could not search the map right now.');
    } finally {
      setPlaceSearchStatus('idle');
    }
  }

  function selectPlace(place) {
    const nextForm = {
      ...form,
      name: place.name,
      address: place.address,
      city: place.city,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      source: 'osm'
    };

    setForm(nextForm);
    setSelectedPlaceId(place.id);
    setDuplicateHotel(findDuplicateHotel(hotels, nextForm));
    setLocationStatus('ready');
    setLocationMessage('Pin placed from the selected map result.');
    setError(!nextForm.city || !nextForm.country
      ? 'The map result is missing city or country. Add the missing detail below.'
      : '');
  }

  useEffect(() => {
    let active = true;

    getLocationIfAllowed()
      .then((location) => {
        if (!active || !location) return;
        setForm((current) => ({
          ...current,
          latitude: location.latitude,
          longitude: location.longitude
        }));
        setLocationStatus('ready');
        setLocationMessage('Pin placed at your current location.');
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not available on this device.');
      return;
    }

    setError('');
    setLocationStatus('loading');
    try {
      const location = await getCurrentLocation();
      setForm((current) => ({
        ...current,
        latitude: location.latitude,
        longitude: location.longitude
      }));
      setLocationStatus('ready');
      setLocationMessage('Pin placed at your current location.');
    } catch (locationError) {
      setLocationStatus('error');
      setError(locationError.code === 1
        ? 'Location permission was not allowed.'
        : 'Could not get your location.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setDuplicateHotel(null);

    const duplicate = findDuplicateHotel(hotels, form);
    if (duplicate) {
      setDuplicateHotel(duplicate);
      return;
    }

    setSaving(true);
    try {
      const hotel = await createHotel(form);
      refresh();
      go(screens.report, hotel.id);
    } catch (error) {
      setError(error.message || 'Could not create hotel.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ContextHeader title="Add hotel" onBack={() => go(screens.search)} />
      <div className="intro-card">
        <p className="hero-kicker">Uncharted breakfast territory</p>
        <h2>Search for the hotel on the map.</h2>
        <p className="hotel-meta">Choose the place, confirm the pin, then submit the first scout report.</p>
      </div>

      <form className="form" onSubmit={submit}>
        <div className="hotel-lookup">
          <label className="lookup-label" htmlFor="hotel-map-search">Find hotel</label>
          <div className="search-pill hotel-lookup-row">
            <span>⌕</span>
            <input
              id="hotel-map-search"
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  searchForHotel();
                }
              }}
              placeholder="Search hotel name or address"
              autoComplete="off"
            />
            <button className="button secondary lookup-button" type="button" onClick={searchForHotel} disabled={placeSearchStatus === 'loading'}>
              {placeSearchStatus === 'loading' ? '...' : 'Search'}
            </button>
          </div>

          {placeMessage && <p className="results-label">{placeMessage}</p>}

          {placeResults.length > 0 && (
            <div className="place-results">
              {placeResults.map((place) => (
                <button
                  className={selectedPlaceId === place.id ? 'place-result-card active' : 'place-result-card'}
                  key={place.id}
                  type="button"
                  onClick={() => selectPlace(place)}
                >
                  <span className="place-result-icon">⌖</span>
                  <span className="hotel-main">
                    <span className="hotel-title">{place.name}</span>
                    <span className="hotel-meta">{place.displayName}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {form.name && (
          <div className="selected-place-card">
            <span className="selected-place-mark">✓</span>
            <span className="hotel-main">
              <span className="hotel-title">{form.name}</span>
              <span className="hotel-meta">{[form.address, form.city, form.country].filter(Boolean).join(', ')}</span>
            </span>
          </div>
        )}

        <Field label="Hotel name *"><input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Grand Hotel Breakfastland" /></Field>
        <div className="grid-2">
          <Field label="City *"><input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Oslo" /></Field>
          <Field label="Country *"><input className="input" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="Norway" /></Field>
        </div>
        <Field label="Address, if known"><input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street, district, anything useful" /></Field>

        {duplicateHotel && (
          <div className="notice">
            <strong>This hotel already exists.</strong>
            <p className="muted small">{duplicateHotel.name}, {duplicateHotel.city}, {duplicateHotel.country}</p>
            <button className="button secondary" type="button" onClick={() => go(screens.detail, duplicateHotel.id)}>Open existing hotel</button>
          </div>
        )}

        <div className="notice">
          <strong>Place the breakfast target</strong>
          <p className="muted small">{locationMessage || 'Tap the map to move the bacon pin.'}</p>
          <button className="button secondary" type="button" onClick={useMyLocation} disabled={locationStatus === 'loading'}>
            {locationStatus === 'loading' ? 'Locating...' : 'Use my location'}
          </button>
        </div>

        <Suspense fallback={<MapLoading compact />}>
          <LazyPinPicker
            lat={form.latitude}
            lng={form.longitude}
            onChange={(coords) => {
              setForm((current) => ({ ...current, latitude: coords.lat, longitude: coords.lng }));
              setLocationMessage('Pin moved manually.');
            }}
          />
        </Suspense>

        {error && <p className="error">{error}</p>}
        <button className="button submit-wide" disabled={saving}>{saving ? 'Saving...' : 'Add this hotel and report bacon'}</button>
      </form>
    </>
  );
}

function Report({ hotel, hotelId, go, refresh, rememberHotel }) {
  const [loadedHotel, setLoadedHotel] = useState(hotel);
  const [status, setStatus] = useState('yes');
  const [observedDate, setObservedDate] = useState(todayISO());
  const [breakfastContext, setBreakfastContext] = useState('buffet');
  const [note, setNote] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loadedHotel || !hotelId) return;
    getHotelWithReports(hotelId).then(setLoadedHotel).catch(() => {});
  }, [hotelId, loadedHotel]);

  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const blob = await compressImage(file);
      setPhotoBlob(blob);
      setPhotoPreview(await blobToDataUrl(blob));
    } catch (error) {
      setError(error.message || 'Could not prepare photo.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!loadedHotel) return;
    setSaving(true);
    setError('');

    try {
      let photoUrl = '';
      if (photoBlob) {
        photoUrl = await uploadReportPhoto(photoBlob);
      }
      await createReport({
        hotelId: loadedHotel.id,
        status,
        observedDate,
        breakfastContext,
        note,
        photoUrl
      });
      const updatedHotel = await getHotelWithReports(loadedHotel.id);
      if (updatedHotel) rememberHotel(updatedHotel);
      refresh();
      go(screens.detail, loadedHotel.id);
    } catch (error) {
      setError(error.message || 'Could not save report.');
    } finally {
      setSaving(false);
    }
  }

  if (!loadedHotel) {
    return (
      <>
        <ContextHeader title="Scout report" onBack={() => go(screens.home)} />
        <div className="notice">Loading hotel...</div>
      </>
    );
  }

  const today = todayISO();

  return (
    <>
      <ContextHeader title="Scout report" onBack={() => go(screens.detail, loadedHotel.id)} />
      <form className="form report-form" onSubmit={submit}>
        <div className="intro-card report-intro">
          <p className="hero-kicker">Scout report</p>
          <h2>Did they have bacon?</h2>
          <p className="hotel-meta">Reporting for <strong>{loadedHotel.name}</strong>, {loadedHotel.city}. No sign-in needed.</p>
        </div>

        <div className="choice-row">
          <Choice active={status === 'yes'} emoji="🥓" title="Yes — bacon spotted" text="The buffet delivered the goods." onClick={() => setStatus('yes')} />
          <Choice active={status === 'no'} emoji="🌵" title="No bacon" text="Only sadness and scrambled eggs." onClick={() => setStatus('no')} />
          <Choice active={status === 'unsure'} emoji="🤔" title="Not sure" text="Couldn't tell / didn't check." onClick={() => setStatus('unsure')} />
        </div>

        <Field label="When did you see this?">
          <div className="segmented">
            <button className={observedDate === today ? 'segment active' : 'segment'} type="button" onClick={() => setObservedDate(today)}>Today</button>
          </div>
          <input className="input" type="date" value={observedDate} max={today} onChange={(e) => setObservedDate(e.target.value)} />
        </Field>

        <Field label="Breakfast setup">
          <select className="select" value={breakfastContext} onChange={(e) => setBreakfastContext(e.target.value)}>
            <option value="buffet">Breakfast buffet</option>
            <option value="other">Other breakfast setup</option>
          </select>
        </Field>

        <Field label="Photo evidence (optional)">
          <label className="photo-upload-card">
            <span className="photo-upload-icon">📷</span>
            <span><strong>{photoPreview ? 'Photo attached' : 'Snap the buffet'}</strong><small>{photoPreview ? 'Tap to replace photo' : 'Tap to add a photo'}</small></span>
            <input className="hidden-input" type="file" accept="image/*" capture="environment" onChange={choosePhoto} />
          </label>
          {photoPreview && <img className="report-photo" src={photoPreview} alt="Selected bacon evidence" />}
        </Field>

        <Field label="Add a note (optional)">
          <textarea className="textarea" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} placeholder="Crispy or chewy? Refilled often? Spill the details…" />
          <p className="muted small">{note.length}/280</p>
        </Field>

        {error && <p className="error">{error}</p>}
        <button className="button submit-wide" disabled={saving}>{saving ? 'Submitting…' : 'Submit bacon report →'}</button>
      </form>
    </>
  );
}

function Choice({ active, emoji, title, text, onClick }) {
  return (
    <button type="button" className="report-choice" aria-pressed={active} onClick={onClick}>
      <span className="choice-emoji">{emoji}</span>
      <span className="choice-label"><strong>{title}</strong><small>{text}</small></span>
      {active && <span className="choice-check">✓</span>}
    </button>
  );
}

function HotelDetail({ hotel, hotelId, go, rememberHotel }) {
  const [loadedHotel, setLoadedHotel] = useState(hotel);

  useEffect(() => {
    if (hotel?.id !== hotelId) return;
    setLoadedHotel((current) => moreCompleteHotel(current, hotel));
  }, [hotel, hotelId]);

  useEffect(() => {
    if (!hotelId) return;
    let active = true;

    getHotelWithReports(hotelId)
      .then((freshHotel) => {
        if (!active || !freshHotel) return;
        setLoadedHotel(freshHotel);
        rememberHotel(freshHotel);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [hotelId, rememberHotel]);

  if (!loadedHotel) {
    return (
      <>
        <ContextHeader title="Hotel" onBack={() => go(screens.search)} />
        <div className="notice">Loading bacon intel…</div>
      </>
    );
  }

  const summary = calculateBaconStatus(loadedHotel.reports);

  return (
    <>
      <div className="hotel-photo-hero">
        <button className="round-icon overlay-left" onClick={() => go(screens.search)}>‹</button>
        <button className="round-icon overlay-right" onClick={() => go(screens.map)}>↗</button>
        <div className="hotel-hero-copy"><span>🏨</span><p>Breakfast target</p></div>
      </div>

      <div className="detail-card">
        <h1>{loadedHotel.name}</h1>
        <p className="hotel-meta">📍 {loadedHotel.address ? `${loadedHotel.address}, ` : ''}{loadedHotel.city}, {loadedHotel.country}</p>

        <div className={`status-hero ${summary.key}`}>
          <span className="status-hero-emoji">{summary.emoji}</span>
          <div>
            <div className="status-hero-title">{summary.label}</div>
            <div className="status-hero-desc">{summary.description}</div>
          </div>
        </div>

        <div className="counts">
          <div className="count-card"><div className="count-number">{summary.yes}</div><div className="count-label">🥓 Yes</div></div>
          <div className="count-card"><div className="count-number muted-dark">{summary.no}</div><div className="count-label">🌵 No</div></div>
          <div className="count-card"><div className="count-number warning">{summary.unsure}</div><div className="count-label">🤔 Unsure</div></div>
        </div>
      </div>

      <div className="actions detail-actions">
        <button className="button" onClick={() => go(screens.report, loadedHotel.id)}>Report bacon here</button>
        <button className="button secondary" onClick={() => go(screens.map)}>View on map</button>
      </div>

      <div className="section-row">
        <h3>Recent reports</h3>
        <span className="section-link">Last seen {formatDate(summary.last)}</span>
      </div>

      <section className="card stack">
        {loadedHotel.reports.length ? loadedHotel.reports.map((report) => (
          <article className="report-item" key={report.id}>
            <h3 className="hotel-title">{report.status === 'yes' ? '🥓 Yes' : report.status === 'no' ? '🌵 No' : '🤔 Not sure'} — {formatDate(report.observed_date)}</h3>
            <p className="hotel-meta">{report.breakfast_context === 'buffet' ? 'Breakfast buffet' : 'Other breakfast setup'}</p>
            {report.note && <p>“{report.note}”</p>}
            {report.photo_url && <img className="report-photo" src={report.photo_url} alt="Bacon report evidence" />}
          </article>
        )) : (
          <div className="notice">
            <strong>No reports yet.</strong>
            <p className="muted small">Uncharted breakfast territory. Be the first bacon scout.</p>
          </div>
        )}
      </section>
    </>
  );
}

function You({ go }) {
  return (
    <>
      <ContextHeader title="You" onBack={() => go(screens.home)} />
      <div className="you-card">
        <span className="you-avatar">🕵️</span>
        <div>
          <h2>Anonymous bacon scout</h2>
          <p className="hotel-meta">Rank: Breakfast Witness</p>
        </div>
      </div>

      <div className="tight-stack">
        <div className="intro-card">
          <p className="hero-kicker">Scout profile</p>
          <h2>Your bacon trail starts here.</h2>
          <p className="hotel-meta">You can report bacon without an account. Install the app from your browser menu to keep it on your home screen.</p>
        </div>

        <div className="notice">
          <strong>Scout ID</strong>
          <p className="muted small">{getScoutId()}</p>
        </div>

        <button className="add-manual-card" onClick={() => go(screens.add)}>
          <span className="add-manual-icon">🥓</span>
          <span><strong>Report a breakfast</strong><br /><span className="muted small">Add a hotel and submit the bacon truth.</span></span>
        </button>

        <button className="add-manual-card" onClick={() => go(screens.map)}>
          <span className="add-manual-icon">⌖</span>
          <span><strong>Open bacon map</strong><br /><span className="muted small">See where scouts have already found evidence.</span></span>
        </button>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function ContextHeader({ title, onBack }) {
  return (
    <div className="context-header">
      <button className="round-icon" onClick={onBack} aria-label="Back">‹</button>
      <h1>{title}</h1>
      <span className="header-spacer" />
    </div>
  );
}

export default App;
