'use client';

import { useEffect, useState, useCallback } from 'react';

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

interface CreateKeyResponse {
  key: ApiKey;
  rawKey: string;
  warning: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreateKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/api-keys');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to fetch API keys');
      }
      const data = await res.json();
      setKeys(data.keys);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    try {
      setIsCreating(true);
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          description: newKeyDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to create API key');
      }

      const data: CreateKeyResponse = await res.json();
      setNewlyCreatedKey(data);
      setNewKeyName('');
      setNewKeyDescription('');
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (newlyCreatedKey) {
      await navigator.clipboard.writeText(newlyCreatedKey.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggle = async (key: ApiKey) => {
    try {
      setTogglingKey(key.id);
      const res = await fetch(`/api/admin/api-keys/${key.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !key.enabled }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to update API key');
      }

      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to revoke API key');
      }

      setConfirmRevoke(null);
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">API Keys</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Manage API keys for external integrations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90"
        >
          Create API Key
        </button>
      </div>

      {/* Security Warning */}
      <div className="rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 flex-shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-medium text-yellow-500">Security Notice</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              API keys provide full access to all admin functionality. Keep them secure and never share them publicly.
              Keys are only shown once at creation time.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-600/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Active Keys */}
      <div className="space-y-4">
        <h2 id="active-keys-heading" className="text-lg font-semibold text-[var(--color-text)]">Active Keys</h2>
        {isLoading ? (
          <div className="text-[var(--color-text-muted)]">Loading...</div>
        ) : activeKeys.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
            <p className="text-[var(--color-text-muted)]">No API keys created yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]" role="region" aria-label="Active API keys">
            <table className="w-full" aria-describedby="active-keys-heading">
              <thead className="bg-[var(--color-card)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Name</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Key Prefix</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Created</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Last Used</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {activeKeys.map((key) => (
                  <tr key={key.id} className="bg-[var(--color-bg)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-text)]">{key.name}</div>
                      {key.description && (
                        <div className="text-xs text-[var(--color-text-muted)]">{key.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm text-[var(--color-text-muted)]">{key.keyPrefix}...</code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          key.enabled
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {key.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggle(key)}
                          disabled={togglingKey === key.id}
                          aria-label={key.enabled ? `Disable API key ${key.name}` : `Enable API key ${key.name}`}
                          className="rounded px-2 py-1 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-text)] disabled:opacity-50"
                        >
                          {key.enabled ? 'Disable' : 'Enable'}
                        </button>
                        {confirmRevoke === key.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRevoke(key.id)}
                              className="rounded bg-red-600 px-2 py-1 text-sm text-white hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(null)}
                              className="rounded px-2 py-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRevoke(key.id)}
                            aria-label={`Revoke API key ${key.name}`}
                            className="rounded px-2 py-1 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Revoked Keys</h2>
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full">
              <thead className="bg-[var(--color-card)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Key Prefix</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">Revoked At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {revokedKeys.map((key) => (
                  <tr key={key.id} className="bg-[var(--color-bg)] opacity-60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-text)]">{key.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm text-[var(--color-text-muted)]">{key.keyPrefix}...</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      {key.revokedAt ? formatDate(key.revokedAt) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Create API Key</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              The API key will only be shown once after creation.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)]">Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., OpenClaw Production"
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)]">
                  Description <span className="text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <textarea
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  placeholder="What this key is used for..."
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName('');
                  setNewKeyDescription('');
                }}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newKeyName.trim() || isCreating}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Display Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">API Key Created</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Copy your API key now. You will not be able to see it again.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--color-text)]">Your API Key</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] break-all">
                  {newlyCreatedKey.rawKey}
                </code>
                <button
                  onClick={handleCopyKey}
                  className="flex-shrink-0 rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                  {copied ? (
                    <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-3">
              <p className="text-sm text-yellow-400">{newlyCreatedKey.warning}</p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setNewlyCreatedKey(null);
                  setShowCreateModal(false);
                }}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
