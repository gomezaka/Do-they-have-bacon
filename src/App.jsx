import { useEffect, useMemo, useState } from 'react';
import {
  approveFacilityReport,
  approveReview,
  approveVenueRequest,
  fetchPendingModeration,
  fetchReviews,
  fetchVenues,
  getDemoUser,
  getSession,
  hasSupabaseConfig,
  hideReview,
  listenToAuth,
  rejectFacilityReport,
  rejectReview,
  rejectVenueRequest,
  signInWithEmail,
  signOut,
  submitFacilityReport,
  submitReview,
  submitVenueRequest,
} from './lib/api';
import { categories } from './lib/demoData';

function makeEmptyReview() {
  return {
    venue_id: '',
    tribunesliter_minutes: 25,
    comfort_score: 3,
    view_score: 3,
    temperature_score: 3,
    accessibility_score: 3,
    event_type: 'Kamp',
    visit_date: new Date().toISOString().slice(0, 10),
    comment: '',
    facility_seating_type: 'Trebenk',
    facility_seat_comfort: 3,
    facility_has_backrest: false,
    facility_heating_level: 3,
    facility_toilet_quality: 3,
    facility_kiosk_status: 'Ukjent',
    facility_parking: 'Ukjent',
    facility_accessibility: 3,
    facility_roof_cover: false,
    facility_garderobe_quality: 3,
    facility_shower_quality: 3,
    facility_view_quality: 3,
    facility_noise_level: 3,
    facility_notes: '',
  };
}

function makeFacilityReportFromVenue(venue) {
  const facilities = venue?.facilities || {};
  return {
    venue_id: venue?.id || '',
    venue_name: venue?.name || '',
    facility_seating_type: facilities.seating_type || 'Trebenk',
    facility_seat_comfort: Number(facilities.seat_comfort || 3),
    facility_has_backrest: Boolean(facilities.has_backrest),
    facility_heating_level: Number(facilities.heating_level || 3),
    facility_toilet_quality: Number(facilities.toilet_quality || 3),
    facility_kiosk_status: facilities.kiosk_status || 'Ukjent',
    facility_parking: facilities.parking || 'Ukjent',
    facility_accessibility: Number(facilities.accessibility || 3),
    facility_roof_cover: Boolean(facilities.roof_cover),
    facility_garderobe_quality: Number(facilities.garderobe_quality || 3),
    facility_shower_quality: Number(facilities.shower_quality || 3),
    facility_view_quality: Number(facilities.view_quality || 3),
    facility_noise_level: Number(facilities.noise_level || 3),
    facility_notes: facilities.notes || '',
  };
}

const emptyVenueRequest = {
  name: '',
  municipality: '',
  address: '',
  venue_type: 'Flerbrukshall',
  is_outdoor: false,
  notes: '',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function shortDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('no-NO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

function scoreLabel(value) {
  const number = Number(value || 0);
  if (!number) return 'Ikke registrert';
  if (number <= 2) return 'Svakt';
  if (number === 3) return 'Middels';
  return 'Bra';
}

function yesNo(value) {
  if (value === true) return 'Ja';
  if (value === false) return 'Nei';
  return 'Ukjent';
}

function stars(value) {
  const number = Math.max(0, Math.min(5, Number(value || 0)));
  if (!number) return 'Ikke registrert';
  return '★'.repeat(number) + '☆'.repeat(5 - number);
}

function deriveTribunesliterLabel(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 'Ingen rumperapporter ennå.';
  if (value <= 15) return 'Putealarm. Dette er karakterbyggende.';
  if (value <= 25) return 'Kort kamp går fint. Cup blir risikosport.';
  if (value <= 40) return 'Godkjent sitteplass for vanlige folk.';
  return 'Luksusnivå. Her kan besteforeldre overleve sluttspill.';
}

function scoreFromMinutes(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 0;
  return Math.max(18, Math.min(96, Math.round((value / 55) * 100)));
}

function primarySport(venue) {
  return venue?.sport_tags?.[0] || 'Idrett ikke registrert';
}

function cushionAlarm(venue) {
  const facilities = venue?.facilities || {};
  return Number(venue?.tribunesliter_minutes || 0) <= 24 || Number(facilities.seat_comfort || 0) <= 2 || /trebenk|betong|stå|ingen/i.test(facilities.seating_type || '');
}

function venueTone(venue) {
  return venue?.is_outdoor ? 'blue' : cushionAlarm(venue) ? 'amber' : 'green';
}

function statusLines(venue) {
  const facilities = venue?.facilities || {};
  const lines = [];
  if (cushionAlarm(venue)) lines.push('🪑 Pute anbefalt');
  else lines.push('✅ Snill mot rumpa');
  if (venue?.is_outdoor) lines.push('🧥 Kle deg for sidelinje');
  else if ((facilities.kiosk_status || '').toLowerCase().includes('kiosk') || facilities.kiosk_status) lines.push('🧇 Kiosk');
  if (Number(venue?.tribunesliter_minutes || 0)) lines.push(`Holder ~${venue.tribunesliter_minutes} min`);
  else lines.push('Mangler rapporter');
  return lines.slice(0, 3);
}

function facilityEmoji(label) {
  const key = label.toLowerCase();
  if (key.includes('tribune')) return '🪑';
  if (key.includes('rygg')) return '🧍';
  if (key.includes('tak')) return '☔';
  if (key.includes('sitte')) return '🍑';
  if (key.includes('varme')) return '🌡️';
  if (key.includes('kiosk')) return '🧇';
  if (key.includes('parkering')) return '🅿️';
  if (key.includes('toalett')) return '🚻';
  if (key.includes('tilgjeng')) return '♿';
  if (key.includes('garderobe')) return '🎽';
  if (key.includes('dusj')) return '🚿';
  if (key.includes('sikt')) return '👀';
  if (key.includes('støy')) return '🔊';
  return '•';
}

function canModerate(profile, mode) {
  return mode === 'demo' || profile?.role === 'moderator' || profile?.role === 'admin';
}

const quickTags = ['🪑 Ta med pute', '🧥 Kle deg varmt', '🧇 Kiosk verdt køen', '🥶 Kaldere enn forventet', '👀 God sikt', '🅿️ Lett parkering'];
const SAVED_VENUES_KEY = 'tribunesliter.savedVenues.v1';
const INSTALL_HINT_DISMISSED_KEY = 'tribunesliter.installHint.dismissed.v1';

export default function App() {
  const [view, setView] = useState('home');
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [sortMode, setSortMode] = useState('score');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState(hasSupabaseConfig ? 'supabase' : 'demo');
  const [reviewForm, setReviewForm] = useState(makeEmptyReview);
  const [facilityForm, setFacilityForm] = useState(() => makeFacilityReportFromVenue(null));
  const [venueRequest, setVenueRequest] = useState(emptyVenueRequest);
  const [moderation, setModeration] = useState({ reviews: [], approvedReviews: [], facilityReports: [], venueRequests: [] });
  const [adminBusy, setAdminBusy] = useState('');
  const [savedVenueIds, setSavedVenueIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem(SAVED_VENUES_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installHintDismissed, setInstallHintDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) === '1';
  });

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const [session, venueRows] = await Promise.all([getSession(), fetchVenues()]);
        if (!mounted) return;
        setUser(session.user || getDemoUser());
        setProfile(session.profile || null);
        setMode(session.mode);
        setVenues(venueRows);
        setSelectedVenueId((current) => current || venueRows[0]?.id || null);
      } catch (error) {
        setNotice(error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let unlisten = () => {};
    listenToAuth(({ user: nextUser, profile: nextProfile }) => {
      setUser(nextUser);
      setProfile(nextProfile);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_VENUES_KEY, JSON.stringify(savedVenueIds));
    } catch {
      // localStorage may be unavailable in private browsing. Saved venues are optional.
    }
  }, [savedVenueIds]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === selectedVenueId) || venues[0],
    [venues, selectedVenueId]
  );

  const savedVenues = useMemo(
    () => venues.filter((venue) => savedVenueIds.includes(venue.id)),
    [venues, savedVenueIds]
  );

  const municipalities = useMemo(
    () => [...new Set(venues.map((venue) => venue.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nb')),
    [venues]
  );

  const sports = useMemo(
    () => [...new Set(venues.flatMap((venue) => venue.sport_tags || []))].sort((a, b) => a.localeCompare(b, 'nb')),
    [venues]
  );

  const filteredVenues = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return venues
      .filter((venue) => {
        const matchesFilter =
          filter === 'all' ||
          (filter === 'indoor' && !venue.is_outdoor) ||
          (filter === 'outdoor' && venue.is_outdoor) ||
          (filter === 'rated' && Number(venue.review_count || 0) > 0) ||
          (filter === 'needsData' && Number(venue.review_count || 0) === 0) ||
          (filter === 'cushion' && cushionAlarm(venue)) ||
          (filter === 'kiosk' && Boolean(venue.facilities?.kiosk_status));
        const matchesMunicipality = municipalityFilter === 'all' || venue.municipality === municipalityFilter;
        const matchesSport = sportFilter === 'all' || (venue.sport_tags || []).includes(sportFilter);
        const searchable = [venue.name, venue.municipality, venue.address, venue.venue_type, ...(venue.sport_tags || [])]
          .join(' ')
          .toLowerCase();
        return matchesFilter && matchesMunicipality && matchesSport && (!normalizedQuery || searchable.includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sortMode === 'score') return scoreFromMinutes(b.tribunesliter_minutes) - scoreFromMinutes(a.tribunesliter_minutes);
        if (sortMode === 'reviews') return Number(b.review_count || 0) - Number(a.review_count || 0);
        if (sortMode === 'municipality') return `${a.municipality} ${a.name}`.localeCompare(`${b.municipality} ${b.name}`, 'nb');
        return a.name.localeCompare(b.name, 'nb');
      });
  }, [venues, query, filter, municipalityFilter, sportFilter, sortMode]);

  useEffect(() => {
    if (!selectedVenue?.id) return;
    fetchReviews(selectedVenue.id)
      .then(setReviews)
      .catch((error) => setNotice(error.message));
  }, [selectedVenue?.id]);

  function go(nextView, venueId) {
    if (venueId) setSelectedVenueId(venueId);
    setNotice('');
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleSavedVenue(venueId) {
    if (!venueId) return;
    setSavedVenueIds((current) => {
      const exists = current.includes(venueId);
      const next = exists ? current.filter((id) => id !== venueId) : [...current, venueId];
      const venueName = venues.find((venue) => venue.id === venueId)?.name || 'Anlegget';
      setNotice(exists ? `${venueName} er fjernet fra lagret.` : `${venueName} er lagret på denne enheten.`);
      return next;
    });
  }

  async function shareVenue(venue) {
    if (!venue) return;
    const url = window.location.href.split('#')[0];
    const text = `${venue.name} på Tribunesliter · ${deriveTribunesliterLabel(venue.tribunesliter_minutes || 0)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Tribunesliter: ${venue.name}`, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNotice('Lenke kopiert.');
    } catch {
      setNotice('Deling ble avbrutt.');
    }
  }

  async function installApp() {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      setInstallPrompt(null);
      setNotice('Installasjonsvinduet er åpnet.');
      return;
    }
    setNotice('På iPhone: åpne i Safari → Del → Legg til på Hjem-skjerm. På Android: menyen i nettleseren → Installer app / Legg til på startskjerm.');
  }

  function dismissInstallHint() {
    setInstallHintDismissed(true);
    window.localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, '1');
  }

  async function refreshVenues() {
    const rows = await fetchVenues();
    setVenues(rows);
    return rows;
  }

  async function refreshModeration() {
    const rows = await fetchPendingModeration();
    setModeration(rows);
    return rows;
  }

  async function handleLogin(email) {
    try {
      const result = await signInWithEmail(email);
      if (result.demo) {
        setUser(result.user);
        setProfile(result.profile);
      }
      setNotice(hasSupabaseConfig ? 'Sjekk e-posten din for innloggingslenke.' : 'Demo-innlogging aktivert lokalt.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
    setProfile(null);
    setNotice('Du er logget ut.');
  }

  async function handleSubmitReview(event) {
    event.preventDefault();
    const targetVenueId = reviewForm.venue_id || selectedVenue?.id;
    if (!targetVenueId) {
      setNotice('Velg anlegg først.');
      return;
    }
    if (!user && hasSupabaseConfig) {
      setNotice('Du må logge inn før du kan bidra.');
      go('profile');
      return;
    }

    try {
      await submitReview({ ...reviewForm, venue_id: targetVenueId });
      await refreshVenues();
      setSelectedVenueId(targetVenueId);
      setReviewForm(makeEmptyReview());
      setNotice(hasSupabaseConfig ? 'Vurderingen er sendt til moderering.' : 'Vurderingen er lagt i modereringskø i demoen.');
      go('thanks', targetVenueId);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleSubmitFacilityReport(event) {
    event.preventDefault();
    const targetVenueId = facilityForm.venue_id || selectedVenue?.id;
    if (!targetVenueId) {
      setNotice('Velg anlegg først.');
      return;
    }
    if (!user && hasSupabaseConfig) {
      setNotice('Du må logge inn før du kan rapportere fasilitetsinfo.');
      go('profile');
      return;
    }

    try {
      await submitFacilityReport({ ...facilityForm, venue_id: targetVenueId, venue_name: selectedVenue?.name || facilityForm.venue_name });
      setFacilityForm(makeFacilityReportFromVenue(selectedVenue));
      setNotice('Fasilitetsrapporten er sendt til moderering.');
      go('venue', targetVenueId);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleSubmitVenueRequest(event) {
    event.preventDefault();
    if (!user && hasSupabaseConfig) {
      setNotice('Du må logge inn før du kan foreslå nytt anlegg.');
      go('profile');
      return;
    }

    try {
      await submitVenueRequest(venueRequest);
      setVenueRequest(emptyVenueRequest);
      setNotice('Forslaget er lagret og må godkjennes før det vises offentlig.');
      go('home');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function loadModeration() {
    if (!canModerate(profile, mode)) {
      setNotice('Du må ha moderator- eller adminrolle for å åpne moderering.');
      return;
    }
    try {
      await refreshModeration();
      go('admin');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function runAdminAction(key, action, successMessage) {
    try {
      setAdminBusy(key);
      await action();
      await refreshModeration();
      await refreshVenues();
      if (selectedVenue?.id) setReviews(await fetchReviews(selectedVenue.id));
      setNotice(successMessage);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setAdminBusy('');
    }
  }

  const isDetail = ['venue', 'rate', 'facility', 'newVenue', 'admin', 'thanks'].includes(view);

  return (
    <main className="app-shell">
      <section className={cx('phone-frame', isDetail && 'phone-frame--detail')} aria-label="Tribunesliter mobilapp">
        <Header user={user} profile={profile} mode={mode} onHome={() => go('home')} onProfile={() => go('profile')} />

        {notice && (
          <button className="notice" type="button" onClick={() => setNotice('')}>
            {notice}
          </button>
        )}

        {loading ? (
          <LoadingView />
        ) : (
          <>
            {view === 'home' && (
              <HomeView
                venues={filteredVenues}
                allVenueCount={venues.length}
                query={query}
                filter={filter}
                municipalityFilter={municipalityFilter}
                sportFilter={sportFilter}
                sortMode={sortMode}
                municipalities={municipalities}
                sports={sports}
                user={user}
                onQuery={setQuery}
                onFilter={setFilter}
                onMunicipalityFilter={setMunicipalityFilter}
                onSportFilter={setSportFilter}
                onSortMode={setSortMode}
                onVenue={(id) => go('venue', id)}
                onNewVenue={() => go('newVenue')}
              />
            )}
            {view === 'explore' && (
              <ExploreView
                venues={venues}
                municipalities={municipalities}
                onVenue={(id) => go('venue', id)}
                onNewVenue={() => go('newVenue')}
              />
            )}
            {view === 'saved' && (
              <SavedView
                venues={savedVenues}
                savedCount={savedVenueIds.length}
                onVenue={(id) => go('venue', id)}
                onExplore={() => go('explore')}
              />
            )}
            {view === 'venue' && selectedVenue && (
              <VenueView
                venue={selectedVenue}
                reviews={reviews}
                onBack={() => go('home')}
                onRate={() => {
                  setReviewForm((form) => ({ ...form, venue_id: selectedVenue.id }));
                  go('rate', selectedVenue.id);
                }}
                onReportFacility={() => {
                  setFacilityForm(makeFacilityReportFromVenue(selectedVenue));
                  go('facility', selectedVenue.id);
                }}
                isSaved={savedVenueIds.includes(selectedVenue.id)}
                onToggleSaved={() => toggleSavedVenue(selectedVenue.id)}
                onShare={() => shareVenue(selectedVenue)}
              />
            )}
            {view === 'rate' && (
              <RateView
                venues={venues}
                selectedVenue={selectedVenue}
                form={reviewForm}
                setForm={setReviewForm}
                onSubmit={handleSubmitReview}
                onBack={() => go(selectedVenue ? 'venue' : 'home', selectedVenue?.id)}
              />
            )}
            {view === 'facility' && (
              <FacilityReportView
                selectedVenue={selectedVenue}
                form={facilityForm}
                setForm={setFacilityForm}
                onSubmit={handleSubmitFacilityReport}
                onBack={() => go(selectedVenue ? 'venue' : 'home', selectedVenue?.id)}
              />
            )}
            {view === 'thanks' && <ThanksView venue={selectedVenue} onHome={() => go('home')} onVenue={() => go('venue', selectedVenue?.id)} />}
            {view === 'profile' && (
              <ProfileView
                user={user}
                profile={profile}
                mode={mode}
                canModerate={canModerate(profile, mode)}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onAdmin={loadModeration}
                onInstall={installApp}
                canInstall={Boolean(installPrompt)}
                installHintDismissed={installHintDismissed}
                onDismissInstall={dismissInstallHint}
              />
            )}
            {view === 'newVenue' && (
              <NewVenueView
                form={venueRequest}
                setForm={setVenueRequest}
                onSubmit={handleSubmitVenueRequest}
                onBack={() => go('home')}
              />
            )}
            {view === 'admin' && (
              <AdminView
                moderation={moderation}
                busy={adminBusy}
                onBack={() => go('profile')}
                onRefresh={refreshModeration}
                onApproveReview={(id) => runAdminAction(`approve-review-${id}`, () => approveReview(id), 'Vurderingen er godkjent.')}
                onRejectReview={(id) => runAdminAction(`reject-review-${id}`, () => rejectReview(id), 'Vurderingen er avvist.')}
                onHideReview={(id) => runAdminAction(`hide-review-${id}`, () => hideReview(id), 'Vurderingen er skjult.')}
                onApproveFacility={(id) => runAdminAction(`approve-facility-${id}`, () => approveFacilityReport(id), 'Fasilitetsrapporten er godkjent.')}
                onRejectFacility={(id) => runAdminAction(`reject-facility-${id}`, () => rejectFacilityReport(id), 'Fasilitetsrapporten er avvist.')}
                onApproveVenue={(request) => runAdminAction(`approve-venue-${request.id}`, () => approveVenueRequest(request), 'Anlegget er godkjent og publisert.')}
                onRejectVenue={(id) => runAdminAction(`reject-venue-${id}`, () => rejectVenueRequest(id), 'Anleggsforslaget er avvist.')}
              />
            )}
          </>
        )}

        <BottomNav active={view} onNav={go} selectedVenue={selectedVenue} savedCount={savedVenueIds.length} />
      </section>
    </main>
  );
}

function Header({ user, profile, mode, onHome, onProfile }) {
  const initials = (profile?.display_name || user?.email || 'TS')
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TS';
  const label = mode === 'demo' ? 'DEMO' : user ? (profile?.role || 'BRUKER') : 'LOGG INN';
  return (
    <header className="topbar">
      <button className="region-pill" type="button" onClick={onHome} aria-label="Til forsiden">
        <span>Tribunesliter</span>
        <strong>Viken</strong>
      </button>
      <button className="avatar-pill" type="button" onClick={onProfile} title={label}>
        {initials}
      </button>
    </header>
  );
}

function LoadingView() {
  return (
    <section className="screen center-screen">
      <div className="loader skeleton-peach">🍑</div>
      <h1>Laster Tribunesliter</h1>
      <p>Henter haller, tribuner og rumpe-rapporter.</p>
      <div className="skeleton-list" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}

function HomeView({
  venues,
  allVenueCount,
  query,
  filter,
  municipalityFilter,
  sportFilter,
  sortMode,
  municipalities,
  sports,
  user,
  onQuery,
  onFilter,
  onMunicipalityFilter,
  onSportFilter,
  onSortMode,
  onVenue,
  onNewVenue,
}) {
  return (
    <section className="screen home-screen">
      <div className="home-title-block">
        <span className="subtle-label">Din tribuneguide</span>
        <h1>Finn ut om rumpa overlever kampen.</h1>
        <p>Fasiliteter, putealarm og ekte erfaringer fra folk som faktisk har sittet der.</p>
      </div>

      <label className="searchbox">
        <Icon name="search" />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Søk hall, bane eller kommune…" />
      </label>

      <div className="filter-row" aria-label="Hurtigfilter">
        {[
          ['all', 'Alle'],
          ['indoor', 'Innendørs'],
          ['outdoor', 'Utendørs'],
          ['cushion', 'Putealarm 🪑'],
          ['kiosk', 'Kiosk'],
          ['rated', 'Har data'],
          ['needsData', 'Mangler data'],
        ].map(([key, label]) => (
          <button key={key} className={cx('chip', filter === key && 'chip--active')} type="button" onClick={() => onFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="filter-panel app-card app-card--soft">
        <label>
          Kommune
          <select value={municipalityFilter} onChange={(event) => onMunicipalityFilter(event.target.value)}>
            <option value="all">Alle kommuner</option>
            {municipalities.map((municipality) => <option value={municipality} key={municipality}>{municipality}</option>)}
          </select>
        </label>
        <label>
          Idrett
          <select value={sportFilter} onChange={(event) => onSportFilter(event.target.value)}>
            <option value="all">Alle idretter</option>
            {sports.map((sport) => <option value={sport} key={sport}>{sport}</option>)}
          </select>
        </label>
      </div>

      <div className="list-meta">
        <span>{venues.length} av {allVenueCount} anlegg</span>
        <label>
          <span>Sorter</span>
          <select value={sortMode} onChange={(event) => onSortMode(event.target.value)}>
            <option value="score">Snillest mot rumpa</option>
            <option value="reviews">Flest rapporter</option>
            <option value="municipality">Kommune</option>
            <option value="name">Navn</option>
          </select>
        </label>
      </div>

      <div className="venue-list">
        {venues.length === 0 ? (
          <EmptyState
            title="Ingen anlegg traff søket"
            text="Prøv et annet filter, eller foreslå hallen hvis den mangler. Rumpa trenger data."
            action="Foreslå anlegg"
            onAction={onNewVenue}
          />
        ) : venues.map((venue) => <VenueCard venue={venue} key={venue.id} onClick={() => onVenue(venue.id)} />)}
      </div>

      <button className="floating-new-venue" type="button" onClick={onNewVenue}>
        + Foreslå nytt anlegg
      </button>
      {!user && <p className="micro-copy">Alle kan lese. Logg inn når du vil bidra med rumpedata.</p>}
    </section>
  );
}


function ExploreView({ venues, municipalities, onVenue, onNewVenue }) {
  const grouped = municipalities.map((municipality) => ({
    municipality,
    venues: venues.filter((venue) => venue.municipality === municipality),
  })).filter((group) => group.venues.length);
  const outdoorCount = venues.filter((venue) => venue.is_outdoor).length;
  const ratedCount = venues.filter((venue) => Number(venue.review_count || 0) > 0).length;

  return (
    <section className="screen explore-screen">
      <div className="home-title-block">
        <span className="subtle-label">Utforsk</span>
        <h1>Kart, kommuner og anlegg.</h1>
        <p>Rask oversikt for beta-testing. Kartlenker åpnes i Google Maps når adresse finnes.</p>
      </div>

      <div className="stat-grid app-card">
        <InfoCell label="Anlegg" value={venues.length} />
        <InfoCell label="Kommuner" value={municipalities.length} />
        <InfoCell label="Utendørs" value={outdoorCount} />
        <InfoCell label="Med rapporter" value={ratedCount} />
      </div>

      {grouped.length === 0 ? (
        <EmptyState title="Ingen anlegg ennå" text="Legg inn første hall, så får utforsk-visningen innhold." action="Foreslå anlegg" onAction={onNewVenue} />
      ) : (
        <div className="municipality-list">
          {grouped.map((group) => (
            <section className="municipality-card app-card" key={group.municipality}>
              <div className="municipality-card__head">
                <div>
                  <span className="eyebrow">Kommune</span>
                  <h2>{group.municipality}</h2>
                </div>
                <strong>{group.venues.length}</strong>
              </div>
              <div className="map-venue-list">
                {group.venues.map((venue) => {
                  const mapQuery = [venue.name, venue.address, venue.municipality].filter(Boolean).join(', ');
                  return (
                    <article className="map-venue-row" key={venue.id}>
                      <button type="button" onClick={() => onVenue(venue.id)}>
                        <strong>{venue.name}</strong>
                        <span>{venue.venue_type} · {primarySport(venue)}</span>
                      </button>
                      {mapQuery && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer" aria-label={`Åpne kart for ${venue.name}`}>
                          <Icon name="map" />
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function SavedView({ venues, savedCount, onVenue, onExplore }) {
  return (
    <section className="screen saved-screen">
      <div className="home-title-block">
        <span className="subtle-label">Lagret</span>
        <h1>Dine faste tribuner.</h1>
        <p>Lagret lokalt på denne enheten, så du raskt finner igjen haller før kamp og cup.</p>
      </div>

      {venues.length === 0 ? (
        <EmptyState
          title="Ingen lagrede haller"
          text={savedCount ? 'Noen lagrede anlegg finnes ikke lenger i datasettet.' : 'Åpne en hall og trykk hjertet for å lagre den her.'}
          action="Utforsk anlegg"
          onAction={onExplore}
        />
      ) : (
        <div className="venue-list">
          {venues.map((venue) => <VenueCard venue={venue} key={venue.id} isSaved onClick={() => onVenue(venue.id)} />)}
        </div>
      )}
    </section>
  );
}

function VenueCard({ venue, onClick, isSaved = false }) {
  const score = scoreFromMinutes(venue.tribunesliter_minutes);
  const tone = venueTone(venue);
  return (
    <button className="venue-card" type="button" onClick={onClick}>
      <div className={cx('score-badge', `score-badge--${tone}`)}>
        <b>{score || '–'}</b>
        <span>Score</span>
      </div>
      <div className="venue-card__body">
        <strong>{venue.name}</strong>
        <span>{venue.municipality} · {venue.address || venue.venue_type}</span>
        <div className="tag-row">
          <small className={cx('tag', venue.is_outdoor ? 'tag--blue' : 'tag--green')}>{venue.is_outdoor ? 'Utendørs' : 'Innendørs'}</small>
          <small className="tag tag--neutral">{primarySport(venue)}</small>
          <small className="tag tag--amber">★ {venue.review_count || 0}</small>
          {isSaved && <small className="tag tag--green">Lagret</small>}
        </div>
        <div className="venue-card__foot">
          {statusLines(venue).map((line) => <em key={line}>{line}</em>)}
        </div>
      </div>
    </button>
  );
}

function VenueView({ venue, reviews, onBack, onRate, onReportFacility, isSaved, onToggleSaved, onShare }) {
  const facilities = venue.facilities || {};
  const mapQuery = [venue.name, venue.address, venue.municipality].filter(Boolean).join(', ');
  const score = scoreFromMinutes(venue.tribunesliter_minutes);
  const progressStyle = { '--score': `${score}%` };
  const facilityRows = [
    ['Tribune', facilities.seating_type || 'Ikke registrert'],
    ['Ryggstøtte', yesNo(facilities.has_backrest)],
    ['Tak/overbygg', yesNo(facilities.roof_cover)],
    ['Sittekomfort', scoreLabel(facilities.seat_comfort)],
    ['Varme', scoreLabel(facilities.heating_level)],
    ['Kiosk', facilities.kiosk_status || 'Ukjent'],
    ['Parkering', facilities.parking || 'Ukjent'],
    ['Toalett', scoreLabel(facilities.toilet_quality)],
    ['Tilgjengelighet', scoreLabel(facilities.accessibility)],
    ['Garderobe', scoreLabel(facilities.garderobe_quality)],
    ['Dusj', scoreLabel(facilities.shower_quality)],
    ['Sikt til banen', scoreLabel(facilities.view_quality)],
    ['Støynivå', scoreLabel(facilities.noise_level)],
  ];

  return (
    <section className="screen detail-screen">
      <div className="detail-topbar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Tilbake"><Icon name="back" /></button>
        <div className="detail-actions">
          <button className="icon-button" type="button" aria-label="Del" onClick={onShare}><Icon name="share" /></button>
          <button className={cx('icon-button', isSaved && 'icon-button--active')} type="button" aria-label={isSaved ? 'Fjern fra lagret' : 'Lagre'} onClick={onToggleSaved}><Icon name="heart" /></button>
        </div>
      </div>

      <article className="venue-hero-card app-card">
        <div className="tag-row tag-row--top">
          <span className={cx('tag', venue.is_outdoor ? 'tag--blue' : 'tag--green')}>{venue.is_outdoor ? 'Utendørs' : 'Innendørs'}</span>
          <span className="tag tag--neutral">{venue.venue_type}</span>
          {venue.sport_tags?.slice(0, 2).map((tag) => <span className="tag tag--neutral" key={tag}>{tag}</span>)}
        </div>
        <h1>{venue.name}</h1>
        <p>{venue.municipality} · {venue.address || 'Adresse ikke registrert'}</p>

        <div className="score-hero">
          <div className="score-ring" style={progressStyle}>
            <strong>{score || '–'}</strong>
            <span>/100</span>
          </div>
          <div>
            <span className="caps-label">Tribunesliter-score</span>
            <h2>Rumpa holder ~{venue.tribunesliter_minutes || '–'} min 🍑</h2>
            <p>{venue.summary || deriveTribunesliterLabel(venue.tribunesliter_minutes || 0)}</p>
            <small>★ {reviews.length || venue.review_count || 0} rumpa-rapporter</small>
          </div>
        </div>
      </article>

      {cushionAlarm(venue) && (
        <div className="alert-card alert-card--amber">
          <strong>🪑 Putealarm</strong>
          <span>{deriveTribunesliterLabel(venue.tribunesliter_minutes || 0)}</span>
        </div>
      )}

      <div className="subscore-row">
        <SubScore label="Rumpe-komfort" value={facilities.seat_comfort} emoji="🍑" />
        <SubScore label="Sikt" value={facilities.view_quality} emoji="👀" />
        <SubScore label="Kiosk" value={facilities.kiosk_status ? 4 : 1} emoji="🧇" />
      </div>

      <section className="panel app-card compact-info-grid">
        <InfoCell label="Type" value={venue.venue_type} />
        <InfoCell label="Underlag" value={venue.is_outdoor ? 'Ute' : 'Inne'} />
        <InfoCell label="Idrett" value={venue.sport_tags?.join(', ') || 'Ukjent'} />
        <InfoCell label="Sist bekreftet" value={venue.facility_reported_at ? shortDate(venue.facility_reported_at) : 'Mangler'} />
        {mapQuery && (
          <a className="map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer">
            <Icon name="map" /> Åpne kart
          </a>
        )}
      </section>

      <section className="panel app-card">
        <SectionHeader title="Fasiliteter" action="Rett info" onAction={onReportFacility} />
        <div className="facility-grid">
          {facilityRows.map(([label, value]) => (
            <div className="facility-row" key={label}>
              <span className="facility-row__icon">{facilityEmoji(label)}</span>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {facilities.notes && <p className="facility-note">{facilities.notes}</p>}
      </section>

      <section className="panel app-card panel--amber-soft">
        <h2>Pakkeliste</h2>
        <div className="pack-row">
          {(venue.packlist || []).length ? (venue.packlist || []).map((item) => <span key={item}>{item}</span>) : <span>🪑 Ta med pute</span>}
        </div>
      </section>

      <section className="panel app-card">
        <SectionHeader title="Siste rumpe-rapporter" action="Legg inn" onAction={onRate} />
        <div className="review-list">
          {reviews.length === 0 ? (
            <EmptyState title="Ingen rumpe-rapporter enda" text="Bli første sliter som logger hvor lenge setet faktisk holder." action="Rate rumpa 🍑" onAction={onRate} />
          ) : (
            reviews.map((review) => <ReviewCard review={review} key={review.id} />)
          )}
        </div>
      </section>

      <div className="sticky-actions">
        <button className="secondary-action" type="button" onClick={onReportFacility}>Rett info</button>
        <button className="primary-action" type="button" onClick={onRate}>Rate rumpa 🍑</button>
      </div>
    </section>
  );
}

function SubScore({ label, value, emoji }) {
  const number = Math.max(1, Math.min(5, Number(value || 1)));
  return (
    <div className="subscore-card">
      <span>{emoji}</span>
      <strong>{number}/5</strong>
      <small>{label}</small>
      <i style={{ '--bar': `${number * 20}%` }} />
    </div>
  );
}

function InfoCell({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="section-title section-title--inside">
      <h2>{title}</h2>
      {action && <button type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <article className="review-card">
      <div className="review-card__top">
        <div className="review-avatar">{(review.user_name || review.display_name || 'B')[0]}</div>
        <div>
          <strong>{review.user_name || review.display_name || 'Innlogget bruker'}</strong>
          <small>{review.event_type} · {shortDate(review.visit_date)}</small>
        </div>
        <span>{review.tribunesliter_minutes} min</span>
      </div>
      <p>{review.comment || 'Ingen kommentar. Men rumpa har talt.'}</p>
      <div className="review-actions">Nyttig · {Math.max(1, Number(review.comfort_score || 1) * 2)}</div>
    </article>
  );
}

function RateView({ venues, selectedVenue, form, setForm, onSubmit, onBack }) {
  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function addTag(tag) {
    setForm((current) => {
      const existing = current.comment || '';
      return { ...current, comment: existing.includes(tag) ? existing : `${existing}${existing ? ' ' : ''}${tag}` };
    });
  }

  return (
    <section className="screen detail-screen form-screen">
      <FormHeader title="Rate rumpa" step="Steg 2 av 3" onBack={onBack} />
      <form className="form-stack" onSubmit={onSubmit}>
        <section className="form-card app-card form-card--dark">
          <span className="caps-label">Rumpe-o-meter</span>
          <div className="rumpe-meter">
            <strong>{form.tribunesliter_minutes}</strong>
            <span>minutter</span>
          </div>
          <p>{deriveTribunesliterLabel(form.tribunesliter_minutes)}</p>
          <label className="range-label range-label--hero">
            <span>0 ståplass</span><span>90 sofa</span>
            <input
              type="range"
              min="5"
              max="90"
              value={form.tribunesliter_minutes}
              onChange={(event) => update('tribunesliter_minutes', event.target.value)}
            />
          </label>
        </section>

        <section className="form-card app-card">
          <SectionHeader title="Besøk" />
          <label>
            Anlegg
            <select value={form.venue_id || selectedVenue?.id || ''} onChange={(event) => update('venue_id', event.target.value)} required>
              <option value="">Velg anlegg</option>
              {venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}
            </select>
          </label>
          <div className="two-cols">
            <label>
              Type besøk
              <select value={form.event_type} onChange={(event) => update('event_type', event.target.value)}>
                <option>Kamp</option>
                <option>Cup</option>
                <option>Trening</option>
                <option>Turnering</option>
                <option>Annet</option>
              </select>
            </label>
            <label>
              Dato
              <input type="date" value={form.visit_date} onChange={(event) => update('visit_date', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="form-card app-card">
          <SectionHeader title="Terningkast" />
          <div className="dice-grid">
            {categories.map((category) => (
              <DiceRating
                key={category.key}
                icon={category.icon}
                label={category.label}
                value={Number(form[category.key])}
                onChange={(value) => update(category.key, value)}
              />
            ))}
          </div>
        </section>

        <section className="form-card app-card">
          <SectionHeader title="Fasiliteter" />
          <div className="two-cols">
            <label>
              Sitteplass
              <select value={form.facility_seating_type} onChange={(event) => update('facility_seating_type', event.target.value)}>
                <option>Trebenk</option>
                <option>Plastseter</option>
                <option>Betongtribune</option>
                <option>Ståtribune</option>
                <option>Ingen tribune</option>
                <option>Annet</option>
              </select>
            </label>
            <label>
              Kiosk
              <select value={form.facility_kiosk_status} onChange={(event) => update('facility_kiosk_status', event.target.value)}>
                <option>Ukjent</option>
                <option>Ingen kiosk</option>
                <option>Ofte dugnadskiosk</option>
                <option>Åpen ved kamper</option>
                <option>Åpen ved cuper</option>
              </select>
            </label>
          </div>
          <div className="toggle-row">
            <Toggle checked={form.facility_has_backrest} onChange={(checked) => update('facility_has_backrest', checked)} label="Ryggstøtte" />
            <Toggle checked={form.facility_roof_cover} onChange={(checked) => update('facility_roof_cover', checked)} label="Tak/overbygg" />
          </div>
          <div className="category-sliders compact">
            <FacilitySlider label="Sittekomfort" value={form.facility_seat_comfort} onChange={(value) => update('facility_seat_comfort', value)} />
            <FacilitySlider label="Varme" value={form.facility_heating_level} onChange={(value) => update('facility_heating_level', value)} />
            <FacilitySlider label="Toalett" value={form.facility_toilet_quality} onChange={(value) => update('facility_toilet_quality', value)} />
            <FacilitySlider label="Tilgjengelighet" value={form.facility_accessibility} onChange={(value) => update('facility_accessibility', value)} />
            <FacilitySlider label="Garderobe" value={form.facility_garderobe_quality} onChange={(value) => update('facility_garderobe_quality', value)} />
            <FacilitySlider label="Dusj" value={form.facility_shower_quality} onChange={(value) => update('facility_shower_quality', value)} />
            <FacilitySlider label="Sikt til banen" value={form.facility_view_quality} onChange={(value) => update('facility_view_quality', value)} />
            <FacilitySlider label="Støynivå" value={form.facility_noise_level} onChange={(value) => update('facility_noise_level', value)} />
          </div>
          <label>
            Parkering
            <input value={form.facility_parking} onChange={(event) => update('facility_parking', event.target.value)} placeholder="F.eks. god, trang, gateparkering" />
          </label>
          <label>
            Fasilitetsnotat
            <textarea rows="3" value={form.facility_notes} onChange={(event) => update('facility_notes', event.target.value)} placeholder="Noe praktisk om tribune, toalett, kiosk, inngang, parkering eller vær?" />
          </label>
        </section>

        <section className="form-card app-card">
          <SectionHeader title="Kommentar" />
          <textarea rows="5" value={form.comment} onChange={(event) => update('comment', event.target.value)} placeholder="Hva bør andre vite før de setter seg her?" />
          <div className="quick-tags">
            {quickTags.map((tag) => <button type="button" key={tag} onClick={() => addTag(tag)}>{tag}</button>)}
          </div>
        </section>

        <div className="sticky-actions sticky-actions--single">
          <button className="primary-action" type="submit">Send inn rapport 🍑</button>
        </div>
      </form>
    </section>
  );
}

function DiceRating({ icon, label, value, onChange }) {
  return (
    <div className="dice-rating">
      <span>{icon} {label}</span>
      <div>
        {[1, 2, 3, 4, 5].map((number) => (
          <button key={number} type="button" className={cx(number <= value && 'selected')} onClick={() => onChange(number)}>
            {number}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className={cx('toggle-card', checked && 'toggle-card--on')}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{checked ? '✓' : '+'}</span>
      {label}
    </label>
  );
}

function FacilitySlider({ label, value, onChange }) {
  return (
    <label className="facility-slider">
      <span>{label}<b>{value}/5</b></span>
      <input type="range" min="1" max="5" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FormHeader({ title, step, onBack }) {
  return (
    <div className="form-header">
      <button className="icon-button" type="button" onClick={onBack} aria-label="Tilbake"><Icon name="close" /></button>
      <div>
        <strong>{title}</strong>
        <span>{step}</span>
      </div>
      <i aria-hidden="true" />
    </div>
  );
}

function FacilityReportView({ selectedVenue, form, setForm, onSubmit, onBack }) {
  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const currentFacilities = selectedVenue?.facilities || {};

  return (
    <section className="screen detail-screen form-screen">
      <FormHeader title="Rett info" step="Forslag til moderator" onBack={onBack} />
      <div className="alert-card alert-card--blue">
        <strong>Informasjon sjekkes av moderator</strong>
        <span>Du foreslår endringer. Offisiell hallinfo oppdateres først når forslaget godkjennes.</span>
      </div>

      <form className="form-stack" onSubmit={onSubmit}>
        <section className="compare-grid">
          <div className="compare-card compare-card--old">
            <span>Offisiell info nå</span>
            <strong>{currentFacilities.seating_type || 'Ikke registrert'}</strong>
            <p>Kiosk: {currentFacilities.kiosk_status || 'Ukjent'}</p>
            <p>Tak: {yesNo(currentFacilities.roof_cover)}</p>
          </div>
          <div className="compare-card compare-card--new">
            <span>Ditt forslag</span>
            <strong>{form.facility_seating_type || 'Ikke registrert'}</strong>
            <p>Kiosk: {form.facility_kiosk_status || 'Ukjent'}</p>
            <p>Tak: {yesNo(form.facility_roof_cover)}</p>
          </div>
        </section>

        <section className="form-card app-card">
          <SectionHeader title="Tribune og sitteplass" />
          <label>
            Sitteplass
            <select value={form.facility_seating_type} onChange={(event) => update('facility_seating_type', event.target.value)}>
              <option>Trebenk</option>
              <option>Plastseter</option>
              <option>Betongtribune</option>
              <option>Ståtribune</option>
              <option>Ingen tribune</option>
              <option>Annet</option>
            </select>
          </label>
          <div className="toggle-row">
            <Toggle checked={form.facility_has_backrest} onChange={(checked) => update('facility_has_backrest', checked)} label="Ryggstøtte" />
            <Toggle checked={form.facility_roof_cover} onChange={(checked) => update('facility_roof_cover', checked)} label="Tak/overbygg" />
          </div>
          <div className="category-sliders compact">
            <FacilitySlider label="Sittekomfort" value={form.facility_seat_comfort} onChange={(value) => update('facility_seat_comfort', value)} />
            <FacilitySlider label="Varme" value={form.facility_heating_level} onChange={(value) => update('facility_heating_level', value)} />
            <FacilitySlider label="Sikt til banen" value={form.facility_view_quality} onChange={(value) => update('facility_view_quality', value)} />
            <FacilitySlider label="Støynivå" value={form.facility_noise_level} onChange={(value) => update('facility_noise_level', value)} />
          </div>
        </section>

        <section className="form-card app-card">
          <SectionHeader title="Praktisk" />
          <div className="two-cols">
            <label>
              Kiosk
              <select value={form.facility_kiosk_status} onChange={(event) => update('facility_kiosk_status', event.target.value)}>
                <option>Ukjent</option>
                <option>Ingen kiosk</option>
                <option>Ofte dugnadskiosk</option>
                <option>Åpen ved kamper</option>
                <option>Åpen ved cuper</option>
              </select>
            </label>
            <label>
              Parkering
              <input value={form.facility_parking} onChange={(event) => update('facility_parking', event.target.value)} placeholder="F.eks. god, trang, gateparkering" />
            </label>
          </div>
          <div className="category-sliders compact">
            <FacilitySlider label="Toalett" value={form.facility_toilet_quality} onChange={(value) => update('facility_toilet_quality', value)} />
            <FacilitySlider label="Tilgjengelighet" value={form.facility_accessibility} onChange={(value) => update('facility_accessibility', value)} />
            <FacilitySlider label="Garderobe" value={form.facility_garderobe_quality} onChange={(value) => update('facility_garderobe_quality', value)} />
            <FacilitySlider label="Dusj" value={form.facility_shower_quality} onChange={(value) => update('facility_shower_quality', value)} />
          </div>
          <label>
            Begrunnelse
            <textarea rows="5" value={form.facility_notes} onChange={(event) => update('facility_notes', event.target.value)} placeholder="Hva er feil eller mangler? Skriv konkret, så moderator kan godkjenne raskt." />
          </label>
        </section>

        <div className="sticky-actions sticky-actions--single">
          <button className="primary-action" type="submit">Send forslag til moderator</button>
        </div>
      </form>
    </section>
  );
}

function ThanksView({ venue, onHome, onVenue }) {
  return (
    <section className="screen center-screen">
      <div className="success-card app-card">
        <div className="thanks-icon">🍑</div>
        <span className="tag tag--green">🏅 +10 sliter-poeng</span>
        <h1>Numsen din er logget!</h1>
        <p>{venue ? `Bidraget ditt ligger til moderering for ${venue.name}.` : 'Bidraget ditt ligger til moderering.'}</p>
        <button className="primary-action" type="button" onClick={onVenue}>Se anlegget</button>
        <button className="secondary-action" type="button" onClick={onHome}>Til forsiden</button>
      </div>
    </section>
  );
}

function ProfileView({ user, profile, mode, canModerate, onLogin, onLogout, onAdmin, onInstall, canInstall, installHintDismissed, onDismissInstall }) {
  const [email, setEmail] = useState('');

  return (
    <section className="screen">
      <div className="profile-card app-card">
        <p className="eyebrow">Min profil</p>
        <h1>{user ? 'Du er klar til å bidra' : 'Logg inn for å bidra'}</h1>
        <p>Alle kan lese. Innlogging kreves for vurderinger og nye anlegg, slik at innhold kan modereres.</p>
        <div className="mode-card">
          <strong>{mode === 'demo' ? 'Demo uten backend' : 'Supabase aktiv'}</strong>
          <span>{mode === 'demo' ? 'Vurderinger lagres bare på denne enheten.' : 'Vurderinger lagres i felles database.'}</span>
        </div>
        {user && (
          <div className="role-card">
            <span>Rolle</span>
            <strong>{mode === 'demo' ? 'admin-demo' : profile?.role || 'user'}</strong>
          </div>
        )}
      </div>

      {!installHintDismissed && (
        <div className="install-card app-card">
          <div>
            <span className="eyebrow">Mobilapp</span>
            <h2>Legg Tribunesliter på hjemskjermen</h2>
            <p>Android viser ofte egen installer-knapp. På iPhone bruker du Safari → Del → Legg til på Hjem-skjerm.</p>
          </div>
          <div className="install-actions">
            <button className="primary-action" type="button" onClick={onInstall}>{canInstall ? 'Installer app' : 'Vis installasjonstips'}</button>
            <button className="secondary-action" type="button" onClick={onDismissInstall}>Skjul</button>
          </div>
        </div>
      )}

      {user ? (
        <div className="form-card app-card">
          <p>Innlogget som <strong>{user.email || user.user_metadata?.display_name || profile?.display_name || 'demo-bruker'}</strong></p>
          <button className="secondary-action" type="button" onClick={onLogout}>Logg ut</button>
          {canModerate ? (
            <button className="primary-action" type="button" onClick={onAdmin}>Åpne moderering</button>
          ) : (
            <p className="muted">Denne brukeren kan bidra, men har ikke moderatorrolle.</p>
          )}
        </div>
      ) : (
        <form className="form-card app-card" onSubmit={(event) => { event.preventDefault(); onLogin(email); }}>
          <label>
            E-post
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="navn@eksempel.no" required />
          </label>
          <button className="primary-action" type="submit">Send innloggingslenke</button>
        </form>
      )}
    </section>
  );
}

function NewVenueView({ form, setForm, onSubmit, onBack }) {
  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="screen detail-screen form-screen">
      <FormHeader title="Foreslå anlegg" step="Nytt sted" onBack={onBack} />
      <form className="form-card app-card" onSubmit={onSubmit}>
        <p className="eyebrow">Mangler hallen?</p>
        <h1>Legg den i køen</h1>
        <p>Forslaget kan godkjennes av moderator før det vises offentlig.</p>
        <label>
          Navn
          <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
        </label>
        <label>
          Kommune
          <input value={form.municipality} onChange={(event) => update('municipality', event.target.value)} required />
        </label>
        <label>
          Adresse
          <input value={form.address} onChange={(event) => update('address', event.target.value)} />
        </label>
        <div className="two-cols">
          <label>
            Type
            <select value={form.venue_type} onChange={(event) => update('venue_type', event.target.value)}>
              <option>Flerbrukshall</option>
              <option>Idrettshall</option>
              <option>Utendørsbane</option>
              <option>Stadion</option>
              <option>Skolegymsal</option>
            </select>
          </label>
          <Toggle checked={form.is_outdoor} onChange={(checked) => update('is_outdoor', checked)} label="Utendørs" />
        </div>
        <label>
          Notat
          <textarea rows="4" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Tribune, kiosk, parkering, vær, annet…" />
        </label>
        <button className="primary-action" type="submit">Send forslag</button>
      </form>
    </section>
  );
}

function AdminView({
  moderation,
  busy,
  onBack,
  onRefresh,
  onApproveReview,
  onRejectReview,
  onHideReview,
  onApproveFacility,
  onRejectFacility,
  onApproveVenue,
  onRejectVenue,
}) {
  const [venueDrafts, setVenueDrafts] = useState({});
  const pendingCount = moderation.reviews.length + (moderation.facilityReports?.length || 0) + moderation.venueRequests.length;

  useEffect(() => {
    const nextDrafts = {};
    for (const request of moderation.venueRequests) {
      nextDrafts[request.id] = { ...request };
    }
    setVenueDrafts(nextDrafts);
  }, [moderation.venueRequests]);

  function updateDraft(id, key, value) {
    setVenueDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  }

  return (
    <section className="screen detail-screen admin-screen">
      <FormHeader title="Moderator" step="Rydd før publisering" onBack={onBack} />
      <div className="admin-hero app-card">
        <span className="eyebrow">Moderator</span>
        <h1>Hold hallkulturen ryddig.</h1>
        <p>Godkjenn ekte bidrag, avvis tull og redd andre foreldre fra dårlige benker.</p>
        <button className="secondary-action" type="button" onClick={onRefresh}>Oppdater kø</button>
      </div>

      <div className="stat-row">
        <span className="stat-pill stat-pill--amber">Venter {pendingCount}</span>
        <span className="stat-pill stat-pill--green">Godkjent {moderation.approvedReviews.length}</span>
        <span className="stat-pill stat-pill--red">Skjul ved behov</span>
      </div>

      <section className="panel app-card">
        <SectionHeader title={`Ventende vurderinger · ${moderation.reviews.length}`} />
        {moderation.reviews.length === 0 ? (
          <p className="muted">Ingen ventende vurderinger.</p>
        ) : (
          <div className="review-list">
            {moderation.reviews.map((review) => (
              <ModerationReviewCard key={review.id} review={review} busy={busy} onApprove={() => onApproveReview(review.id)} onReject={() => onRejectReview(review.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="panel app-card">
        <SectionHeader title={`Fasilitetsrapporter · ${moderation.facilityReports?.length || 0}`} />
        {!moderation.facilityReports?.length ? (
          <p className="muted">Ingen ventende fasilitetsrapporter.</p>
        ) : (
          <div className="review-list">
            {moderation.facilityReports.map((report) => (
              <ModerationFacilityCard key={report.id} report={report} busy={busy} onApprove={() => onApproveFacility(report.id)} onReject={() => onRejectFacility(report.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="panel app-card">
        <SectionHeader title={`Nye anleggsforslag · ${moderation.venueRequests.length}`} />
        {moderation.venueRequests.length === 0 ? (
          <p className="muted">Ingen ventende anlegg.</p>
        ) : (
          <div className="review-list">
            {moderation.venueRequests.map((request) => {
              const draft = venueDrafts[request.id] || request;
              return (
                <article className="mod-card mod-card--blue" key={request.id}>
                  <div className="mod-card__top"><span className="tag tag--blue">Nytt anlegg</span><small>{request.municipality}</small></div>
                  <h3>{request.name}</h3>
                  <p>{request.notes || request.address || 'Ingen notat.'}</p>
                  <div className="admin-edit-grid">
                    <label>Navn<input value={draft.name || ''} onChange={(event) => updateDraft(request.id, 'name', event.target.value)} /></label>
                    <label>Kommune<input value={draft.municipality || ''} onChange={(event) => updateDraft(request.id, 'municipality', event.target.value)} /></label>
                    <label>Adresse<input value={draft.address || ''} onChange={(event) => updateDraft(request.id, 'address', event.target.value)} /></label>
                    <label>Type<select value={draft.venue_type || 'Flerbrukshall'} onChange={(event) => updateDraft(request.id, 'venue_type', event.target.value)}><option>Flerbrukshall</option><option>Idrettshall</option><option>Utendørsbane</option><option>Stadion</option><option>Skolegymsal</option></select></label>
                    <Toggle checked={Boolean(draft.is_outdoor)} onChange={(checked) => updateDraft(request.id, 'is_outdoor', checked)} label="Utendørs" />
                  </div>
                  <div className="mini-actions"><button type="button" disabled={Boolean(busy)} onClick={() => onApproveVenue(draft)}>{busy === `approve-venue-${request.id}` ? 'Publiserer…' : 'Godkjenn'}</button><button type="button" disabled={Boolean(busy)} onClick={() => onRejectVenue(request.id)}>Avvis</button></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel app-card">
        <SectionHeader title={`Synlige vurderinger · ${moderation.approvedReviews.length}`} />
        {moderation.approvedReviews.length === 0 ? (
          <p className="muted">Ingen synlige vurderinger å vise.</p>
        ) : (
          <div className="review-list">
            {moderation.approvedReviews.map((review) => <ModerationReviewCard key={review.id} review={review} busy={busy} visible onHide={() => onHideReview(review.id)} />)}
          </div>
        )}
      </section>
    </section>
  );
}

function ModerationFacilityCard({ report, busy, onApprove, onReject }) {
  const rows = [
    ['Sitteplass', report.seating_type || 'Ukjent'],
    ['Ryggstøtte', yesNo(report.has_backrest)],
    ['Tak', yesNo(report.roof_cover)],
    ['Sittekomfort', report.seat_comfort],
    ['Varme', report.heating_level],
    ['Toalett', report.toilet_quality],
    ['Tilgjengelighet', report.accessibility],
    ['Garderobe', report.garderobe_quality],
    ['Dusj', report.shower_quality],
    ['Sikt', report.view_quality],
    ['Støy', report.noise_level],
  ];
  return (
    <article className="mod-card mod-card--green">
      <div className="mod-card__top"><span className="tag tag--green">Fasilitetsrapport</span><small>{shortDate(report.created_at)}</small></div>
      <h3>{report.venue_name || report.venues?.name || 'Ukjent anlegg'}</h3>
      <p>{report.notes || 'Ingen notat.'}</p>
      <div className="score-row score-row--wrap">{rows.map(([label, value]) => <span key={label}>{label}: {value ?? '–'}</span>)}</div>
      <div className="mini-actions"><button type="button" disabled={Boolean(busy)} onClick={onApprove}>{busy === `approve-facility-${report.id}` ? 'Godkjenner…' : 'Godkjenn info'}</button><button type="button" disabled={Boolean(busy)} onClick={onReject}>Avvis</button></div>
    </article>
  );
}

function ModerationReviewCard({ review, visible = false, busy, onApprove, onReject, onHide }) {
  return (
    <article className={cx('mod-card', visible ? 'mod-card--green' : 'mod-card--amber')}>
      <div className="mod-card__top"><span className="tag tag--amber">Vurdering</span><small>{review.tribunesliter_minutes} min</small></div>
      <h3>{review.venue_name || review.venues?.name || 'Ukjent anlegg'}</h3>
      <p>{review.comment || 'Ingen kommentar.'}</p>
      <div className="score-row"><span>Sittekomfort {review.comfort_score}</span><span>Sikt {review.view_score}</span><span>Temp {review.temperature_score}</span><span>Tilgang {review.accessibility_score}</span></div>
      <small>{review.event_type} · {shortDate(review.visit_date)}</small>
      <div className="mini-actions">
        {visible ? <button type="button" disabled={Boolean(busy)} onClick={onHide}>{busy === `hide-review-${review.id}` ? 'Skjuler…' : 'Skjul'}</button> : <><button type="button" disabled={Boolean(busy)} onClick={onApprove}>{busy === `approve-review-${review.id}` ? 'Godkjenner…' : 'Godkjenn'}</button><button type="button" disabled={Boolean(busy)} onClick={onReject}>Avvis</button></>}
      </div>
    </article>
  );
}

function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <div>🍑</div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && <button type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function BottomNav({ active, onNav, selectedVenue, savedCount }) {
  return (
    <nav className="bottom-nav" aria-label="Hovedmeny">
      <button className={cx(active === 'home' && 'active')} type="button" onClick={() => onNav('home')}><Icon name="home" /><span>Haller</span></button>
      <button className={cx(active === 'explore' && 'active')} type="button" onClick={() => onNav('explore')}><Icon name="map" /><span>Kart</span></button>
      <button className="nav-fab" type="button" onClick={() => onNav('rate', selectedVenue?.id)} aria-label="Bidra"><span><Icon name="plus" /></span></button>
      <button className={cx(active === 'saved' && 'active')} type="button" onClick={() => onNav('saved')}><Icon name="heart" /><span>Lagret{savedCount ? ` ${savedCount}` : ''}</span></button>
      <button className={cx(active === 'profile' && 'active')} type="button" onClick={() => onNav('profile')}><Icon name="user" /><span>Profil</span></button>
    </nav>
  );
}

function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.15, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>;
    case 'home': return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>;
    case 'map': return <svg {...common}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>;
    case 'heart': return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>;
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case 'plus': return <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case 'back': return <svg {...common}><polyline points="15 18 9 12 15 6" /></svg>;
    case 'close': return <svg {...common}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case 'share': return <svg {...common}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /></svg>;
    default: return null;
  }
}
