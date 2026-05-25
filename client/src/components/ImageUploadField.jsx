import { useState, useRef } from 'react';
import api from '../api';

export default function ImageUploadField({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload/image', fd);
      onChange(data.url);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      // reset so same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="image-upload-row">
        <button
          type="button"
          className="btn-upload"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Enviando...' : 'Escolher arquivo'}
        </button>
        <span className="upload-or">ou</span>
        <input
          type="url"
          className="upload-url-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://exemplo.com/foto.jpg"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>
      {uploadError && <p className="upload-error">{uploadError}</p>}
      {value && <img src={value} alt="Preview" className="img-preview" />}
    </div>
  );
}
