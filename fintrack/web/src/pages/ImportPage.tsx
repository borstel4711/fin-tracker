import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { ImportProfile, ImportResult } from '../types';
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
          <button
            className="link"
            onClick={() => (showProfileForm ? cancelProfileForm() : setShowProfileForm(true))}
          >
            {showProfileForm ? 'Abbrechen' : '+ Neues Profil'}
          </button>
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
                <button className="link" onClick={() => startEditProfile(p)}>
                  bearbeiten
                </button>
                <button className="deleteLink" onClick={() => removeProfile(p.id)}>
                  löschen
                </button>
              </span>
            </li>
          ))}
        </ul>

        {showProfileForm && (
          <form onSubmit={submitProfile} className={styles.profileForm}>
            <Field label="Name" value={newProfile.name} onChange={(v) => setNewProfile({ ...newProfile, name: v })} required />
            <Field
              label="Trennzeichen"
              value={newProfile.delimiter}
              onChange={(v) => setNewProfile({ ...newProfile, delimiter: v })}
            />
            <Field
              label="Encoding (latin1/utf8)"
              value={newProfile.encoding}
              onChange={(v) => setNewProfile({ ...newProfile, encoding: v as ImportProfile['encoding'] })}
            />
            <Field
              label="Datumsformat"
              value={newProfile.date_format}
              onChange={(v) => setNewProfile({ ...newProfile, date_format: v })}
            />
            <Field
              label="Dezimalkomma (1/0)"
              value={String(newProfile.decimal_comma)}
              onChange={(v) => setNewProfile({ ...newProfile, decimal_comma: Number(v) })}
            />
            <Field
              label="Müllzeilen vor Header"
              value={String(newProfile.skip_rows)}
              onChange={(v) => setNewProfile({ ...newProfile, skip_rows: Number(v) })}
            />
            <Field
              label="Spalte Datum (Buchung)"
              value={newProfile.col_date}
              onChange={(v) => setNewProfile({ ...newProfile, col_date: v })}
              required
            />
            <Field
              label="Spalte Wertstellungsdatum"
              value={newProfile.col_value_date ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_value_date: v })}
            />
            <Field
              label="Spalte Betrag"
              value={newProfile.col_amount ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_amount: v })}
            />
            <Field
              label="Spalte Soll"
              value={newProfile.col_debit ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_debit: v })}
            />
            <Field
              label="Spalte Haben"
              value={newProfile.col_credit ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_credit: v })}
            />
            <Field
              label="Spalte Empfänger"
              value={newProfile.col_counterparty ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_counterparty: v })}
            />
            <Field
              label="Spalte Zweck"
              value={newProfile.col_purpose ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_purpose: v })}
            />
            <Field
              label="Spalte Saldo"
              value={newProfile.col_balance ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_balance: v })}
            />
            <div className={styles.fieldSpan}>
              <button type="submit" className="button buttonPrimary">
                {editingProfileId !== null ? 'Speichern' : 'Profil speichern'}
              </button>
              {editingProfileId !== null && (
                <button type="button" className="button buttonSecondary" onClick={cancelProfileForm}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input className="input" value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
