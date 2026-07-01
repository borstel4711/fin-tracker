import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { ImportProfile, ImportResult } from '../types';
import Dialog from '../components/Dialog';
import FormField from '../components/FormField';
import MdiIcon from '../components/MdiIcon';
import styles from './ImportPage.module.css';

type ProfileForm = Omit<ImportProfile, 'id'>;

const emptyProfile: ProfileForm = {
  name: '',
  delimiter: ';',
  encoding: 'latin1',
  date_format: 'DD.MM.YYYY',
  decimal_comma: 1,
  skip_rows: 0,
  col_date: '',
  col_value_date: '',
  col_amount: '',
  col_debit: '',
  col_credit: '',
  col_counterparty: '',
  col_purpose: '',
  col_balance: '',
};

export default function ImportPage() {
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [newProfile, setNewProfile] = useState<ProfileForm>(emptyProfile);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);

  const loadProfiles = () => api.get<ImportProfile[]>('/profiles').then(setProfiles).catch(() => {});

  useEffect(() => {
    loadProfiles();
  }, []);

  const submitImport = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!file || !profileId) {
      setError('Bitte Profil und Datei wählen.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile_id', profileId);
    try {
      const res = await api.upload<ImportResult>('/import', formData);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...newProfile,
      decimal_comma: Number(newProfile.decimal_comma),
      skip_rows: Number(newProfile.skip_rows),
    };
    if (editingProfileId !== null) {
      await api.patch(`/profiles/${editingProfileId}`, payload);
    } else {
      await api.post('/profiles', payload);
    }
    cancelProfileForm();
    loadProfiles();
  };

  const startEditProfile = (p: ImportProfile) => {
    setEditingProfileId(p.id);
    setNewProfile({
      name: p.name,
      delimiter: p.delimiter,
      encoding: p.encoding,
      date_format: p.date_format,
      decimal_comma: p.decimal_comma,
      skip_rows: p.skip_rows,
      col_date: p.col_date,
      col_value_date: p.col_value_date ?? '',
      col_amount: p.col_amount ?? '',
      col_debit: p.col_debit ?? '',
      col_credit: p.col_credit ?? '',
      col_counterparty: p.col_counterparty ?? '',
      col_purpose: p.col_purpose ?? '',
      col_balance: p.col_balance ?? '',
    });
    setShowProfileForm(true);
  };

  const cancelProfileForm = () => {
    setEditingProfileId(null);
    setNewProfile(emptyProfile);
    setShowProfileForm(false);
  };

  const removeProfile = async (id: number) => {
    await api.delete(`/profiles/${id}`);
    if (editingProfileId === id) cancelProfileForm();
    loadProfiles();
  };

  return (
    <div className={styles.page}>
      <section className={`card ${styles.section}`}>
        <h2 className={styles.title}>CSV importieren</h2>
        <form onSubmit={submitImport} className={styles.form}>
          <select
            className={`input ${styles.fullWidth}`}
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            <option value="">Importprofil wählen…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit" className="button buttonPrimary">
            Importieren
          </button>
        </form>
        {error && <p className={styles.error}>{error}</p>}
        {result && (
          <p className={styles.result}>
            {result.inserted} neu, {result.skipped} Dubletten übersprungen
            {result.value_date_filled > 0 && `, ${result.value_date_filled} Wertstellung(en) nachgetragen`} (von{' '}
            {result.row_count} Zeilen).
          </p>
        )}
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Importprofile</h2>
          {!showProfileForm && (
            <button type="button" className="button buttonPrimary" onClick={() => setShowProfileForm(true)}>
              <MdiIcon name="plus" color="#ffffff" size={16} />
              Neues Profil
            </button>
          )}
        </div>

        <ul className={styles.profileList}>
          {profiles.map((p) => (
            <li key={p.id} className={styles.profileItem}>
              <span>
                <span className={styles.profileName}>{p.name}</span>{' '}
                <span className={styles.profileMeta}>
                  ({p.delimiter} · {p.encoding} · {p.date_format})
                </span>
              </span>
              <span className={styles.profileActions}>
                <button
                  className="iconButton"
                  title="Bearbeiten"
                  aria-label="Bearbeiten"
                  onClick={() => startEditProfile(p)}
                >
                  <MdiIcon name="pencil-outline" variant="accent" />
                </button>
                <button
                  className="iconButton"
                  title="Löschen"
                  aria-label="Löschen"
                  onClick={() => removeProfile(p.id)}
                >
                  <MdiIcon name="delete-outline" variant="danger" />
                </button>
              </span>
            </li>
          ))}
        </ul>

        <Dialog
          open={showProfileForm}
          onClose={cancelProfileForm}
          title={editingProfileId !== null ? 'Profil bearbeiten' : 'Neues Profil'}
        >
          <form onSubmit={submitProfile} className={styles.profileForm}>
            <FormField label="Name">
              <input
                className="input"
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Trennzeichen">
              <input
                className="input"
                value={newProfile.delimiter}
                onChange={(e) => setNewProfile({ ...newProfile, delimiter: e.target.value })}
              />
            </FormField>
            <FormField label="Encoding (latin1/utf8)">
              <input
                className="input"
                value={newProfile.encoding}
                onChange={(e) =>
                  setNewProfile({ ...newProfile, encoding: e.target.value as ImportProfile['encoding'] })
                }
              />
            </FormField>
            <FormField label="Datumsformat">
              <input
                className="input"
                value={newProfile.date_format}
                onChange={(e) => setNewProfile({ ...newProfile, date_format: e.target.value })}
              />
            </FormField>
            <FormField label="Dezimalkomma (1/0)">
              <input
                className="input"
                value={String(newProfile.decimal_comma)}
                onChange={(e) => setNewProfile({ ...newProfile, decimal_comma: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Müllzeilen vor Header">
              <input
                className="input"
                value={String(newProfile.skip_rows)}
                onChange={(e) => setNewProfile({ ...newProfile, skip_rows: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Spalte Datum (Buchung)">
              <input
                className="input"
                value={newProfile.col_date}
                onChange={(e) => setNewProfile({ ...newProfile, col_date: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Spalte Wertstellungsdatum">
              <input
                className="input"
                value={newProfile.col_value_date ?? ''}
                onChange={(e) => setNewProfile({ ...newProfile, col_value_date: e.target.value })}
              />
            </FormField>
            <FormField label="Spalte Betrag">
              <input
                className="input"
                value={newProfile.col_amount ?? ''}
                onChange={(e) => setNewProfile({ ...newProfile, col_amount: e.target.value })}
              />
            </FormField>
            <FormField label="Spalte Soll">
              <input
                className="input"
                value={newProfile.col_debit ?? ''}
                onChange={(e) => setNewProfile({ ...newProfile, col_debit: e.target.value })}
              />
            </FormField>
            <FormField label="Spalte Haben">
              <input
                className="input"
                value={newProfile.col_credit ?? ''}
                onChange={(e) => setNewProfile({ ...newProfile, col_credit: e.target.value })}
              />
            </FormField>
            <FormField label="Spalte Empfänger">
              <input
                className="input"
                value={newProfile.col_counterparty ?? ''}
                onChange={(e) => setNewProfile({ ...newProfile, col_counterparty: e.target.value })}
              />
            </FormField>
            <FormField label="Spalte Zweck">
              <input
                className="input"
                value={newProfile.col_purpose ?? ''}
                onChange={(e) => setNewProfile({ ...newProfile, col_purpose: e.target.value })}
              />
            </FormField>
            <FormField label="Spalte Saldo">
              <input
                className="input"
                value={newProfile.col_balance ?? ''}
                onChange={(e) => setNewProfile({ ...newProfile, col_balance: e.target.value })}
              />
            </FormField>
            <div className={styles.fieldSpan}>
              <button type="submit" className="button buttonPrimary">
                {editingProfileId !== null ? 'Speichern' : 'Profil speichern'}
              </button>
              <button type="button" className="button buttonSecondary" onClick={cancelProfileForm}>
                Abbrechen
              </button>
            </div>
          </form>
        </Dialog>
      </section>
    </div>
  );
}
