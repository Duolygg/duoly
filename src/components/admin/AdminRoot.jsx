import React from 'react';
import AdminApp from './AdminApp';
import AdminErrorBoundary from './AdminErrorBoundary';

/** The island Astro mounts: the admin shell inside an error boundary. */
export default function AdminRoot(props) {
  return (
    <div translate="no" className="notranslate">
      <AdminErrorBoundary>
        <AdminApp {...props} />
      </AdminErrorBoundary>
    </div>
  );
}
