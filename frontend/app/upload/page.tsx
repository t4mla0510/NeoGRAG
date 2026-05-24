'use client';

import UploadPage from './Upload';
import PrivateRoute from './PrivateRouter';

export default function Upload() {
  return (
    <PrivateRoute>
      <UploadPage />
    </PrivateRoute>
  );
}
