import '../styles/globals.css';

import { MeshApp } from '@uniformdev/mesh-sdk-react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // /dev-preview renders the toolkit with mocked data outside the dashboard
  // iframe (MeshApp would wait forever for the SDK there). Dev-only.
  if (process.env.NODE_ENV === 'development' && pathname === '/dev-preview') {
    return <Component {...pageProps} />;
  }

  return (
    // The <MeshApp> component must wrap the entire app to provide Uniform Mesh SDK services
    <MeshApp>
      <Component {...pageProps} />
    </MeshApp>
  );
}

export default MyApp;
