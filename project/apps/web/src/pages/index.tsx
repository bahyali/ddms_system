import Head from 'next/head';
import styles from '~/styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>DDMS</title>
        <meta name="description" content="Dynamic Data Management System" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to DDMS
        </h1>

        <p className={styles.description}>
          Get started by editing{' '}
          <code className={styles.code}>src/pages/index.tsx</code>
        </p>
      </main>
    </div>
  );
}