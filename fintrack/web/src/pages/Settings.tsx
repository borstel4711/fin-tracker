import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { AppSettings } from '../types';
import styles from './Settings.module.css';

export default function Settings() {
  const [buffer, setBuffer] = useState('0');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<AppSettings>('/settings')
      .then((s) => setBuffer(String(s.buffer)))
      .catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const s = await api.put<AppSettings>('/settings', { buffer: Number(buffer) });
      setBuffer(String(s.buffer));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Einstellungen</h2>

      <form onSubmit={submit} className={`card ${styles.form}`}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Puffer</span>
          <input
            type="number"
            step="0.01"
            className="input"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
        </label>
        <button type="submit" className="button buttonPrimary">
          Speichern
        </button>
        {saved && <span className={styles.saved}>Gespeichert</span>}
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
