import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building2, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const api = axios.create({ baseURL: API_BASE_URL });

export default function App() {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHolderId, setLoadingHolderId] = useState(null);
  const [statusNotification, setStatusNotification] = useState(null);

  // Fetch holders from fixed Excel file (data.xlsx) on backend
  const fetchHoldersFromExcel = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/holders');
      if (response.data.success) {
        setHolders(response.data.holders);
      }
    } catch (err) {
      showToast('Failed to load data.xlsx: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldersFromExcel();
  }, []);

  const triggerAutofill = async (holder) => {
    if (!holder.username || !holder.password) {
      showToast(`Holder "${holder.name}" is missing username or password in data.xlsx`, 'error');
      return;
    }

    setLoadingHolderId(holder.id);
    showToast(`Launching browser & auto-filling credentials for ${holder.name}...`, 'loading');

    try {
      const response = await api.post('/api/autofill-login', {
        name: holder.name,
        username: holder.username,
        password: holder.password,
        gstin: holder.gstin
      });

      if (response.data.success) {
        showToast(`✅ Credentials for "${holder.name}" auto-filled! Please enter CAPTCHA to log in.`, 'success');
      } else {
        showToast(response.data.message || 'Auto-fill process completed', 'info');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Server connection failed';
      showToast(msg, 'error');
    } finally {
      setLoadingHolderId(null);
    }
  };

  const showToast = (message, type = 'info') => {
    setStatusNotification({ message, type });
    if (type !== 'loading') {
      setTimeout(() => setStatusNotification(null), 5000);
    }
  };

  return (
    <div className="app-container">
      {/* Ultra-Clean Header */}
      <header className="minimal-header">
        <div className="header-left">
          <Building2 size={24} color="#00d2ff" />
          <h1 className="minimal-title">GST Auto-Fill</h1>
          <span className="count-badge">{holders.length} Clients</span>
        </div>

        <button 
          onClick={fetchHoldersFromExcel} 
          className="btn-icon" 
          title="Reload Excel File (data.xlsx)"
        >
          <RefreshCw size={18} className={loading ? 'spinner' : ''} /> Reload data.xlsx
        </button>
      </header>

      {/* Clean List of GST Holder Names Only */}
      {loading ? (
        <div className="loading-state">
          <Loader2 size={32} className="spinner" color="#00d2ff" />
          <p>Reading data.xlsx...</p>
        </div>
      ) : holders.length > 0 ? (
        <div className="names-list">
          {holders.map((holder) => (
            <div 
              key={holder.id} 
              className={`name-row ${loadingHolderId === holder.id ? 'active' : ''}`}
              onClick={() => triggerAutofill(holder)}
            >
              <div className="name-info">
                <span className="name-text">{holder.name}</span>
                {holder.username && (
                  <span className="username-subtext">(@{holder.username})</span>
                )}
              </div>

              <button 
                className="btn-autofill-simple"
                disabled={loadingHolderId === holder.id}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerAutofill(holder);
                }}
              >
                {loadingHolderId === holder.id ? (
                  <>
                    <Loader2 size={16} className="spinner" /> Auto-Filling...
                  </>
                ) : (
                  <>
                    <Zap size={16} /> Auto-Fill Login
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <AlertCircle size={40} color="#f59e0b" />
          <h3>No GST Holders Found in data.xlsx</h3>
          <p>Add GST Holder rows to <code>/home/cnt/Desktop/ROHITVALA/CLG/PROJECT/gst_Autofill/data.xlsx</code> and click Reload.</p>
        </div>
      )}

      {/* Status Toast Notification Banner */}
      {statusNotification && (
        <div className="toast-banner">
          {statusNotification.type === 'loading' && <Loader2 size={20} className="spinner" color="#00d2ff" />}
          {statusNotification.type === 'success' && <CheckCircle2 size={20} color="#10b981" />}
          {statusNotification.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
          <div style={{ fontSize: '0.9rem' }}>
            {statusNotification.message}
          </div>
        </div>
      )}
    </div>
  );
}
