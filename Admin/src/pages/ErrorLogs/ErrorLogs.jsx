import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './ErrorLogs.css';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const ErrorLogs = ({ url }) => {
    const { t } = useTranslation();
    const [errorLogs, setErrorLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedError, setSelectedError] = useState(null);
    const [stats, setStats] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    });

    // Filters
    const [filters, setFilters] = useState({
        level: '',
        source: '',
        resolved: '',
        search: ''
    });

    const fetchErrorLogs = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('adminToken');

            const queryParams = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...Object.fromEntries(
                    Object.entries(filters).filter(([_, v]) => v !== '')
                )
            });

            const response = await axios.get(
                `${url}/api/error-logs/list?${queryParams}`,
                { headers: { token } }
            );

            if (response.data.success) {
                setErrorLogs(response.data.data);
                setFilteredLogs(response.data.data);
                setPagination(prev => ({
                    ...prev,
                    ...response.data.pagination
                }));
            }
        } catch (error) {
            console.error('Failed to fetch error logs:', error);
            toast.error(t('errorLogs.fetchError') || 'Failed to fetch error logs');
        } finally {
            setLoading(false);
        }
    }, [url, pagination.page, pagination.limit, filters, t]);

    const fetchStats = useCallback(async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${url}/api/error-logs/stats`, {
                headers: { token }
            });

            if (response.data.success) {
                setStats(response.data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, [url]);

    useEffect(() => {
        fetchErrorLogs();
        fetchStats();
    }, [fetchErrorLogs, fetchStats]);

    const handleResolve = async (id) => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.patch(
                `${url}/api/error-logs/${id}/resolve`,
                {},
                { headers: { token } }
            );

            if (response.data.success) {
                toast.success(t('errorLogs.resolved') || 'Error marked as resolved');
                fetchErrorLogs();
                fetchStats();
            }
        } catch (error) {
            console.error('Failed to resolve error:', error);
            toast.error(t('errorLogs.resolveError') || 'Failed to resolve error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('errorLogs.deleteConfirm') || 'Delete this error log?')) {
            return;
        }

        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.delete(
                `${url}/api/error-logs/${id}`,
                { headers: { token } }
            );

            if (response.data.success) {
                toast.success(t('errorLogs.deleted') || 'Error log deleted');
                fetchErrorLogs();
                fetchStats();
            }
        } catch (error) {
            console.error('Failed to delete error:', error);
            toast.error(t('errorLogs.deleteError') || 'Failed to delete error log');
        }
    };

    const getLevelColor = (level) => {
        switch (level) {
            case 'error':
                return '#ef4444';
            case 'warning':
                return '#f59e0b';
            case 'info':
                return '#3b82f6';
            default:
                return '#64748b';
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString();
    };

    return (
        <div className="error-logs-container">
            <div className="error-logs-header">
                <div>
                    <h1>{t('errorLogs.title') || 'Error Logs'}</h1>
                    <p className="subtitle">{t('errorLogs.subtitle') || 'Monitor and manage system errors'}</p>
                </div>
                <button onClick={fetchErrorLogs} className="refresh-btn">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                    </svg>
                    {t('common.refresh') || 'Refresh'}
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-label">{t('errorLogs.totalErrors') || 'Total Errors'}</div>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">{t('errorLogs.unresolved') || 'Unresolved'}</div>
                        <div className="stat-value error">{stats.unresolved}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">{t('errorLogs.byLevel.error') || 'Errors'}</div>
                        <div className="stat-value" style={{ color: '#ef4444' }}>{stats.byLevel?.error || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">{t('errorLogs.byLevel.warning') || 'Warnings'}</div>
                        <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.byLevel?.warning || 0}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-bar">
                <select
                    value={filters.level}
                    onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                >
                    <option value="">{t('errorLogs.allLevels') || 'All Levels'}</option>
                    <option value="error">{t('errorLogs.error') || 'Error'}</option>
                    <option value="warning">{t('errorLogs.warning') || 'Warning'}</option>
                    <option value="info">{t('errorLogs.info') || 'Info'}</option>
                </select>

                <select
                    value={filters.source}
                    onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                >
                    <option value="">{t('errorLogs.allSources') || 'All Sources'}</option>
                    <option value="backend">{t('errorLogs.backend') || 'Backend'}</option>
                    <option value="frontend">{t('errorLogs.frontend') || 'Frontend'}</option>
                    <option value="admin">{t('errorLogs.admin') || 'Admin'}</option>
                </select>

                <select
                    value={filters.resolved}
                    onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
                >
                    <option value="">{t('errorLogs.allStatus') || 'All Status'}</option>
                    <option value="false">{t('errorLogs.unresolvedOnly') || 'Unresolved'}</option>
                    <option value="true">{t('errorLogs.resolvedOnly') || 'Resolved'}</option>
                </select>

                <input
                    type="text"
                    placeholder={t('errorLogs.search') || 'Search...'}
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
            </div>

            {/* Error Logs Table */}
            <div className="table-container">
                {loading ? (
                    <div className="loading">{t('common.loading') || 'Loading...'}</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="no-data">{t('errorLogs.noErrors') || 'No error logs found'}</div>
                ) : (
                    <table className="error-logs-table">
                        <thead>
                            <tr>
                                <th>{t('errorLogs.time') || 'Time'}</th>
                                <th>{t('errorLogs.level') || 'Level'}</th>
                                <th>{t('errorLogs.source') || 'Source'}</th>
                                <th>{t('errorLogs.message') || 'Message'}</th>
                                <th>{t('errorLogs.url') || 'URL/Path'}</th>
                                <th>{t('errorLogs.status') || 'Status'}</th>
                                <th>{t('common.actions') || 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((error) => (
                                <tr key={error._id} onClick={() => setSelectedError(error)}>
                                    <td data-label={t('errorLogs.time') || 'Time'}>{formatDate(error.createdAt)}</td>
                                    <td data-label={t('errorLogs.level') || 'Level'}>
                                        <span className="level-badge" style={{ backgroundColor: getLevelColor(error.level) }}>
                                            {error.level}
                                        </span>
                                    </td>
                                    <td data-label={t('errorLogs.source') || 'Source'}>{error.source}</td>
                                    <td data-label={t('errorLogs.message') || 'Message'} className="message-cell">{error.message}</td>
                                    <td data-label={t('errorLogs.url') || 'URL/Path'} className="url-cell">{error.url || '-'}</td>
                                    <td data-label={t('errorLogs.status') || 'Status'}>
                                        <span className={`status-badge ${error.resolved ? 'resolved' : 'unresolved'}`}>
                                            {error.resolved ? t('errorLogs.resolved') || 'Resolved' : t('errorLogs.unresolved') || 'Unresolved'}
                                        </span>
                                    </td>
                                    <td data-label={t('common.actions') || 'Actions'}>
                                        <div className="action-buttons">
                                            {!error.resolved && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleResolve(error._id);
                                                    }}
                                                    className="btn-resolve"
                                                    title={t('errorLogs.markResolved') || 'Mark as resolved'}
                                                >
                                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(error._id);
                                                }}
                                                className="btn-delete"
                                                title={t('common.delete') || 'Delete'}
                                            >
                                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="pagination">
                    <button
                        onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                        disabled={pagination.page === 1}
                    >
                        {t('common.previous') || 'Previous'}
                    </button>
                    <span>
                        {t('common.page') || 'Page'} {pagination.page} {t('common.of') || 'of'} {pagination.pages}
                    </span>
                    <button
                        onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                        disabled={pagination.page === pagination.pages}
                    >
                        {t('common.next') || 'Next'}
                    </button>
                </div>
            )}

            {/* Error Detail Modal */}
            {selectedError && (
                <div className="modal-overlay" onClick={() => setSelectedError(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('errorLogs.errorDetails') || 'Error Details'}</h2>
                            <button onClick={() => setSelectedError(null)} className="close-btn">×</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row">
                                <strong>{t('errorLogs.time') || 'Time'}:</strong>
                                <span>{formatDate(selectedError.createdAt)}</span>
                            </div>
                            <div className="detail-row">
                                <strong>{t('errorLogs.level') || 'Level'}:</strong>
                                <span className="level-badge" style={{ backgroundColor: getLevelColor(selectedError.level) }}>
                                    {selectedError.level}
                                </span>
                            </div>
                            <div className="detail-row">
                                <strong>{t('errorLogs.source') || 'Source'}:</strong>
                                <span>{selectedError.source}</span>
                            </div>
                            <div className="detail-row">
                                <strong>{t('errorLogs.message') || 'Message'}:</strong>
                                <span>{selectedError.message}</span>
                            </div>
                            {selectedError.url && (
                                <div className="detail-row">
                                    <strong>{t('errorLogs.url') || 'URL'}:</strong>
                                    <span>{selectedError.url}</span>
                                </div>
                            )}
                            {selectedError.method && (
                                <div className="detail-row">
                                    <strong>{t('errorLogs.method') || 'Method'}:</strong>
                                    <span>{selectedError.method}</span>
                                </div>
                            )}
                            {selectedError.userAgent && (
                                <div className="detail-row">
                                    <strong>{t('errorLogs.userAgent') || 'User Agent'}:</strong>
                                    <span className="user-agent">{selectedError.userAgent}</span>
                                </div>
                            )}
                            {selectedError.stack && (
                                <div className="detail-row stack-trace">
                                    <strong>{t('errorLogs.stackTrace') || 'Stack Trace'}:</strong>
                                    <pre>{selectedError.stack}</pre>
                                </div>
                            )}
                            {selectedError.additionalData && Object.keys(selectedError.additionalData).length > 0 && (
                                <div className="detail-row">
                                    <strong>{t('errorLogs.additionalData') || 'Additional Data'}:</strong>
                                    <pre>{JSON.stringify(selectedError.additionalData, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

ErrorLogs.propTypes = {
    url: PropTypes.string.isRequired
};

export default ErrorLogs;
